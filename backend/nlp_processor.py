"""
TalentLens - NLP Processor Module

Provides text preprocessing and skill extraction using spaCy.
Handles lemmatization, stopword removal, and entity-based skill
identification with a curated taxonomy of technical and soft skills.
"""

import re
import logging
from typing import Optional

import spacy

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# spaCy model loading - graceful fallback to smaller model
# ---------------------------------------------------------------------------
_nlp = None


def _get_nlp():
    """
    Lazily load the spaCy model. Tries en_core_web_lg first,
    then falls back to en_core_web_sm if the large model is unavailable.

    Returns:
        spacy.Language: Loaded spaCy pipeline.
    """
    global _nlp
    if _nlp is not None:
        return _nlp

    for model_name in ("en_core_web_lg", "en_core_web_sm", "en_core_web_md"):
        try:
            _nlp = spacy.load(model_name, disable=["ner", "parser"])
            logger.info("Loaded spaCy model: %s", model_name)
            return _nlp
        except OSError:
            logger.warning("spaCy model '%s' not found, trying next…", model_name)

    raise RuntimeError(
        "No spaCy English model found. Install one with: "
        "python -m spacy download en_core_web_sm"
    )


# ---------------------------------------------------------------------------
# Curated Skill Taxonomy
# ---------------------------------------------------------------------------
TECHNICAL_SKILLS = {
    # Programming Languages
    "python", "java", "javascript", "typescript", "c++", "c#", "ruby",
    "go", "golang", "rust", "swift", "kotlin", "scala", "r", "matlab",
    "php", "perl", "bash", "shell", "sql", "nosql", "html", "css",
    # Frameworks & Libraries
    "react", "angular", "vue", "svelte", "next.js", "nextjs", "nuxt",
    "django", "flask", "fastapi", "spring", "spring boot", "express",
    "node.js", "nodejs", ".net", "asp.net", "rails", "laravel",
    "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn",
    "pandas", "numpy", "scipy", "matplotlib", "seaborn", "plotly",
    "opencv", "spacy", "nltk", "huggingface", "transformers",
    "langchain", "llama", "openai", "gpt",
    # Cloud & DevOps
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes",
    "terraform", "ansible", "jenkins", "ci/cd", "github actions",
    "gitlab", "circleci", "heroku", "vercel", "netlify",
    # Data & Databases
    "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch",
    "cassandra", "dynamodb", "firebase", "supabase", "sqlite",
    "snowflake", "bigquery", "redshift", "databricks", "spark",
    "hadoop", "kafka", "airflow", "dbt", "etl",
    # AI/ML Concepts
    "machine learning", "deep learning", "nlp", "natural language processing",
    "computer vision", "reinforcement learning", "generative ai",
    "neural network", "cnn", "rnn", "lstm", "transformer", "bert",
    "fine-tuning", "rag", "retrieval augmented generation",
    "classification", "regression", "clustering", "recommendation",
    "feature engineering", "model deployment", "mlops",
    # Data Science
    "data analysis", "data visualization", "statistics", "a/b testing",
    "hypothesis testing", "data mining", "data pipeline", "bi",
    "power bi", "tableau", "looker", "excel", "google sheets",
    # Tools & Platforms
    "git", "github", "gitlab", "bitbucket", "jira", "confluence",
    "slack", "figma", "sketch", "adobe", "photoshop",
    "linux", "unix", "windows server", "nginx", "apache",
    # Security
    "cybersecurity", "penetration testing", "owasp", "encryption",
    "authentication", "oauth", "jwt", "sso",
    # Mobile
    "android", "ios", "react native", "flutter", "xamarin",
    "mobile development", "responsive design",
    # Other Technical
    "rest", "restful", "graphql", "grpc", "websocket", "api design",
    "microservices", "serverless", "event-driven", "design patterns",
    "oop", "functional programming", "agile", "scrum", "kanban",
    "tdd", "unit testing", "integration testing", "selenium",
    "cypress", "jest", "pytest", "mocha",
}

SOFT_SKILLS = {
    "leadership", "communication", "teamwork", "problem solving",
    "critical thinking", "project management", "time management",
    "adaptability", "creativity", "collaboration", "mentoring",
    "negotiation", "presentation", "public speaking", "writing",
    "analytical thinking", "decision making", "conflict resolution",
    "customer service", "stakeholder management", "strategic planning",
    "attention to detail", "multitasking", "self-motivated",
    "initiative", "emotional intelligence", "cross-functional",
}

ALL_SKILLS = TECHNICAL_SKILLS | SOFT_SKILLS


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def preprocess_text(text: str) -> str:
    """
    Clean and normalise raw resume/JD text for downstream NLP tasks.

    Steps:
        1. Lowercase
        2. Remove URLs
        3. Remove email addresses
        4. Remove non-alphanumeric characters (keep spaces)
        5. Collapse whitespace
        6. Lemmatize with spaCy (removing stopwords & punctuation)

    Args:
        text: Raw input text.

    Returns:
        Preprocessed, lemmatised text string.
    """
    if not text or not text.strip():
        return ""

    # Basic cleaning
    text = text.lower()
    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", " ", text)
    text = re.sub(r"[^a-z0-9\s\+\#\.\/\-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # spaCy lemmatization
    nlp = _get_nlp()
    doc = nlp(text)
    tokens = [
        token.lemma_
        for token in doc
        if not token.is_stop and not token.is_punct and len(token.text) > 1
    ]

    return " ".join(tokens)


def extract_skills(text: str) -> dict:
    """
    Extract technical and soft skills from text using taxonomy matching.

    Uses bigram and trigram matching against a curated skill set for
    higher recall on multi-word skills like "machine learning".
    Short skills (≤3 chars) require word boundaries to avoid false matches.

    Args:
        text: Raw or preprocessed text.

    Returns:
        dict with keys:
            - technical_skills (list[str]): Found technical skills.
            - soft_skills (list[str]): Found soft skills.
            - all_skills (list[str]): Combined skill list.
    """
    if not text:
        return {"technical_skills": [], "soft_skills": [], "all_skills": []}

    text_lower = text.lower()

    # Generate n-grams from the text for multi-word matching
    words = text_lower.split()
    ngrams = set()

    # Unigrams
    ngrams.update(words)

    # Bigrams
    for i in range(len(words) - 1):
        ngrams.add(f"{words[i]} {words[i+1]}")

    # Trigrams
    for i in range(len(words) - 2):
        ngrams.add(f"{words[i]} {words[i+1]} {words[i+2]}")

    # Also do substring matching for skills embedded in longer text
    found_technical = set()
    found_soft = set()

    for skill in TECHNICAL_SKILLS:
        # Multi-word skills can be found in n-grams
        if skill in ngrams:
            found_technical.add(skill)
        # Single-word skills: require word boundary for short skills (≤3 chars)
        elif len(skill) > 3:
            # Longer skills can use substring matching
            if skill in text_lower:
                found_technical.add(skill)
        else:
            # Short skills (like 'r', 'go', 'aws', 'gcp') require word boundaries
            pattern = r'\b' + re.escape(skill) + r'\b'
            if re.search(pattern, text_lower):
                found_technical.add(skill)

    for skill in SOFT_SKILLS:
        # Multi-word skills can be found in n-grams
        if skill in ngrams:
            found_soft.add(skill)
        # Single-word skills: require word boundary for short skills (≤3 chars)
        elif len(skill) > 3:
            # Longer skills can use substring matching
            if skill in text_lower:
                found_soft.add(skill)
        else:
            # Short skills require word boundaries
            pattern = r'\b' + re.escape(skill) + r'\b'
            if re.search(pattern, text_lower):
                found_soft.add(skill)

    technical_list = sorted(found_technical)
    soft_list = sorted(found_soft)

    return {
        "technical_skills": technical_list,
        "soft_skills": soft_list,
        "all_skills": technical_list + soft_list,
    }


def extract_skills_from_jd(job_description: str) -> list[str]:
    """
    Extract required skills from a job description.
    Convenience wrapper around extract_skills().

    Args:
        job_description: Raw job description text.

    Returns:
        List of all extracted skill strings.
    """
    result = extract_skills(job_description)
    return result["all_skills"]


def get_skill_taxonomy() -> dict:
    """
    Return the full skill taxonomy for export or reference.

    Returns:
        dict with 'technical' and 'soft' keys mapping to sorted skill lists.
    """
    return {
        "technical": sorted(TECHNICAL_SKILLS),
        "soft": sorted(SOFT_SKILLS),
    }
