"""
TalentLens - SQLAlchemy ORM Models

Database schema for analysis sessions and candidates with rich
extracted data fields.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Float, Integer, Text, DateTime, Boolean, ForeignKey, JSON
)
from sqlalchemy.orm import relationship

from database import Base


def _generate_uuid() -> str:
    """Generate a new UUID4 string for use as a primary key."""
    return str(uuid.uuid4())

# -----------------
# Core Models
# -----------------

class AnalysisSession(Base):
    """A single analysis run - one JD matched against uploaded resumes."""
    __tablename__ = "analysis_sessions"

    id = Column(String, primary_key=True, default=_generate_uuid)
    user_id = Column(String, nullable=True) # Now stores Supabase UUID
    job_title = Column(String(256), nullable=True)
    job_description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    total_candidates = Column(Integer, default=0)
    status = Column(String(32), default="pending")

    candidates = relationship(
        "Candidate", back_populates="session",
        cascade="all, delete-orphan", order_by="Candidate.final_rank",
    )


class Candidate(Base):
    """Per-candidate results with rich extracted data and AI insights."""
    __tablename__ = "candidates"

    id = Column(String, primary_key=True, default=_generate_uuid)
    session_id = Column(String, ForeignKey("analysis_sessions.id"), nullable=False)

    # Identity & Contact
    filename = Column(String(512), nullable=False)
    candidate_name = Column(String(256), default="Unknown Candidate")
    email = Column(String(256), nullable=True)
    phone = Column(String(64), nullable=True)
    linkedin = Column(String(512), nullable=True)
    github = Column(String(512), nullable=True)
    portfolio = Column(String(512), nullable=True)

    # Extracted Sections
    education = Column(JSON, nullable=True, default=list)
    experience = Column(JSON, nullable=True, default=list)
    projects = Column(JSON, nullable=True, default=list)
    certifications = Column(JSON, nullable=True, default=list)
    languages = Column(JSON, nullable=True, default=list)

    # Resume Content
    raw_text = Column(Text, nullable=True)
    preprocessed_text = Column(Text, nullable=True)
    extracted_skills = Column(JSON, nullable=True, default=list)

    # Scoring
    tfidf_score = Column(Float, default=0.0)
    semantic_score = Column(Float, default=0.0)
    final_score = Column(Float, default=0.0)
    final_rank = Column(Integer, nullable=True)
    score_conflict = Column(Boolean, default=False)

    # AI Insights
    matched_skills = Column(JSON, nullable=True, default=list)
    missing_skills = Column(JSON, nullable=True, default=list)
    transferable_skills = Column(JSON, nullable=True, default=list)
    candidate_summary = Column(Text, nullable=True)
    recommended_improvements = Column(JSON, nullable=True, default=list)
    hiring_recommendation = Column(String(64), nullable=True)
    bias_risk = Column(String, default="low")
    bias_explanation = Column(String, default="")
    notes = Column(String, default="", nullable=True)
    red_flags = Column(JSON, nullable=True, default=list)

    # AI Provider Metadata
    ai_provider = Column(String(32), nullable=True)
    ai_model = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("AnalysisSession", back_populates="candidates")
