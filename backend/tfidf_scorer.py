"""
TalentLens - TF-IDF Scorer Module

Implements baseline candidate scoring using TF-IDF vectorization
and cosine similarity between job descriptions and resume texts.
This provides a fast, deterministic scoring baseline that complements
the LLM-based semantic scoring.
"""

import logging
import pickle
import os
from typing import Optional

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level vectorizer instance
# ---------------------------------------------------------------------------
_vectorizer: Optional[TfidfVectorizer] = None
_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "artifacts", "tfidf_vectorizer.pkl"
)


def _get_vectorizer() -> TfidfVectorizer:
    """
    Get or create the TF-IDF vectorizer instance.

    If a pre-trained vectorizer exists on disk (from the Colab notebook),
    load it. Otherwise, create a fresh one.

    Returns:
        TfidfVectorizer: Ready-to-use vectorizer.
    """
    global _vectorizer
    if _vectorizer is not None:
        return _vectorizer

    # Try loading a pre-trained vectorizer
    if os.path.exists(_MODEL_PATH):
        try:
            with open(_MODEL_PATH, "rb") as f:
                _vectorizer = pickle.load(f)
            logger.info("Loaded pre-trained TF-IDF vectorizer from %s", _MODEL_PATH)
            return _vectorizer
        except Exception as exc:
            logger.warning("Failed to load vectorizer: %s - creating new one", exc)

    # Create a new vectorizer with sensible defaults for resume matching
    _vectorizer = TfidfVectorizer(
        max_features=10000,
        ngram_range=(1, 2),       # Unigrams + bigrams for phrases like "machine learning"
        stop_words="english",
        sublinear_tf=True,        # Apply sublinear TF scaling (1 + log(tf))
        min_df=1,                 # Accept all terms (small corpus at inference)
        max_df=0.95,              # Ignore terms in >95% of documents
        dtype="float64",
    )
    logger.info("Created new TF-IDF vectorizer (not pre-trained)")
    return _vectorizer


def compute_tfidf_score(
    job_description: str,
    resume_text: str,
) -> dict:
    """
    Compute TF-IDF cosine similarity between a job description and a resume.

    The vectorizer is fit on both texts together (pairwise comparison),
    then cosine similarity is calculated. The resulting score is scaled
    to 0–100 for consistency with the semantic scorer.

    Args:
        job_description: Preprocessed job description text.
        resume_text: Preprocessed resume text.

    Returns:
        dict with keys:
            - tfidf_score (float): Similarity score 0–100.
            - top_matching_terms (list[str]): Top 10 shared high-weight terms.
            - jd_top_terms (list[str]): Top 10 terms from the JD.
    """
    if not job_description.strip() or not resume_text.strip():
        return {
            "tfidf_score": 0.0,
            "top_matching_terms": [],
            "jd_top_terms": [],
        }

    try:
        vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words="english",
            sublinear_tf=True,
            min_df=1,
            max_df=1.0,
        )

        # Fit on both documents together
        corpus = [job_description, resume_text]
        tfidf_matrix = vectorizer.fit_transform(corpus)

        # Cosine similarity between JD (row 0) and resume (row 1)
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

        # Scale to 0–100 and cast to native Python float (fixes psycopg2 InvalidSchemaName error)
        score = float(round(min(similarity * 100, 100.0), 2))

        # Extract top matching terms
        feature_names = vectorizer.get_feature_names_out()
        jd_vector = tfidf_matrix[0].toarray().flatten()
        resume_vector = tfidf_matrix[1].toarray().flatten()

        # Find terms with high weight in BOTH documents
        combined_weight = jd_vector * resume_vector
        top_indices = combined_weight.argsort()[-10:][::-1]
        top_matching_terms = [
            feature_names[i] for i in top_indices if combined_weight[i] > 0
        ]

        # Top terms from JD alone
        jd_top_indices = jd_vector.argsort()[-10:][::-1]
        jd_top_terms = [
            feature_names[i] for i in jd_top_indices if jd_vector[i] > 0
        ]

        logger.info("TF-IDF score computed: %.2f", score)

        return {
            "tfidf_score": score,
            "top_matching_terms": top_matching_terms,
            "jd_top_terms": jd_top_terms,
        }

    except Exception as exc:
        logger.error("TF-IDF scoring failed: %s", exc)
        return {
            "tfidf_score": 0.0,
            "top_matching_terms": [],
            "jd_top_terms": [],
        }


def batch_compute_tfidf_scores(
    job_description: str,
    resume_texts: list[str],
) -> list[dict]:
    """
    Compute TF-IDF scores for multiple resumes against one job description.

    Fits a single vectorizer across the JD + all resumes, then computes
    pairwise cosine similarity between the JD and each resume.

    Args:
        job_description: Preprocessed job description text.
        resume_texts: List of preprocessed resume texts.

    Returns:
        List of score dicts (same structure as compute_tfidf_score output).
    """
    if not job_description.strip() or not resume_texts:
        return [{"tfidf_score": 0.0, "top_matching_terms": [], "jd_top_terms": []}
                for _ in resume_texts]

    try:
        vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 2),
            stop_words="english",
            sublinear_tf=True,
            min_df=1,
            max_df=1.0,
        )

        # Fit on JD + all resumes
        corpus = [job_description] + resume_texts
        tfidf_matrix = vectorizer.fit_transform(corpus)

        feature_names = vectorizer.get_feature_names_out()
        jd_vector = tfidf_matrix[0].toarray().flatten()

        # Get JD top terms (shared across all candidates)
        jd_top_indices = jd_vector.argsort()[-10:][::-1]
        jd_top_terms = [
            feature_names[i] for i in jd_top_indices if jd_vector[i] > 0
        ]

        results = []
        for idx in range(1, len(corpus)):
            similarity = cosine_similarity(
                tfidf_matrix[0:1], tfidf_matrix[idx:idx+1]
            )[0][0]
            # Cast to native python float to prevent psycopg2 InvalidSchemaName errors
            score = float(round(min(similarity * 100, 100.0), 2))

            # Top matching terms for this resume
            resume_vector = tfidf_matrix[idx].toarray().flatten()
            combined_weight = jd_vector * resume_vector
            top_indices = combined_weight.argsort()[-10:][::-1]
            top_matching_terms = [
                feature_names[i] for i in top_indices if combined_weight[i] > 0
            ]

            results.append({
                "tfidf_score": score,
                "top_matching_terms": top_matching_terms,
                "jd_top_terms": jd_top_terms,
            })

        logger.info("Batch TF-IDF scoring complete for %d resumes", len(resume_texts))
        return results

    except Exception as exc:
        logger.error("Batch TF-IDF scoring failed: %s", exc)
        return [{"tfidf_score": 0.0, "top_matching_terms": [], "jd_top_terms": []}
                for _ in resume_texts]


def save_vectorizer(path: Optional[str] = None) -> str:
    """
    Save the current vectorizer to disk for reuse.

    Args:
        path: Optional custom path. Defaults to _MODEL_PATH.

    Returns:
        Path where the vectorizer was saved.
    """
    save_path = path or _MODEL_PATH
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    vectorizer = _get_vectorizer()
    with open(save_path, "wb") as f:
        pickle.dump(vectorizer, f)
    logger.info("TF-IDF vectorizer saved to %s", save_path)
    return save_path
