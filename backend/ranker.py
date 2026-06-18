"""
TalentLens - Ranker Module

Combines TF-IDF and semantic scores into a final ranking.
Formula: final_score = (tfidf_score * 0.35) + (semantic_score * 0.65)
Flags score conflicts where methods differ by >20 points.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)

TFIDF_WEIGHT = 0.35
SEMANTIC_WEIGHT = 0.65
CONFLICT_THRESHOLD = 20.0


def compute_final_scores(candidates: list[dict]) -> list[dict]:
    """
    Compute final combined scores and assign rankings.

    Args:
        candidates: List of candidate dicts, each containing at minimum
                    'tfidf_score' and 'semantic_score' keys.

    Returns:
        Same list sorted by final_score descending, with added keys:
            - final_score (float)
            - final_rank (int)
            - score_conflict (bool)
    """
    if not candidates:
        return []

    for candidate in candidates:
        tfidf = min(float(candidate.get("tfidf_score", 0.0)) * 6.67, 100.0)
        semantic = float(candidate.get("semantic_score", 0.0))

        # Weighted combination on normalized scales
        final = (tfidf * TFIDF_WEIGHT) + (semantic * SEMANTIC_WEIGHT)
        candidate["final_score"] = round(final, 1)

        # Flag score conflicts
        diff = abs(tfidf - semantic)
        candidate["score_conflict"] = diff > CONFLICT_THRESHOLD

        if candidate["score_conflict"]:
            logger.info(
                "Score conflict for '%s': TF-IDF=%.1f, Semantic=%.1f (diff=%.1f)",
                candidate.get("candidate_name", "Unknown"), tfidf, semantic, diff,
            )

    # Sort by final score descending
    candidates.sort(key=lambda c: c["final_score"], reverse=True)

    # Assign ranks
    for rank, candidate in enumerate(candidates, start=1):
        candidate["final_rank"] = rank

    logger.info("Ranked %d candidates. Top score: %.2f",
                len(candidates), candidates[0]["final_score"] if candidates else 0)

    return candidates


def get_ranking_summary(candidates: list[dict]) -> dict:
    """
    Generate summary statistics for a ranking.

    Args:
        candidates: Ranked list of candidate dicts.

    Returns:
        dict with avg_score, max_score, min_score, conflict_count, etc.
    """
    if not candidates:
        return {"total": 0, "avg_score": 0, "max_score": 0, "min_score": 0,
                "conflict_count": 0, "strong_matches": 0, "good_matches": 0,
                "partial_matches": 0, "poor_matches": 0}

    scores = [c.get("final_score", 0) for c in candidates]
    recs = [c.get("hiring_recommendation", "") for c in candidates]

    return {
        "total": len(candidates),
        "avg_score": round(sum(scores) / len(scores), 2),
        "max_score": round(max(scores), 2),
        "min_score": round(min(scores), 2),
        "conflict_count": sum(1 for c in candidates if c.get("score_conflict")),
        "strong_matches": recs.count("Strong Match"),
        "good_matches": recs.count("Good Match"),
        "partial_matches": recs.count("Partial Match"),
        "poor_matches": recs.count("Poor Match"),
    }
