"""
TalentLens - Database Configuration Module

Provides SQLAlchemy engine, session factory, and base model class
for the SQLite database used to persist analysis sessions, candidates,
and scoring results.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Database path - default to a local file; overridable via env var
# ---------------------------------------------------------------------------
DATABASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATABASE_DIR, exist_ok=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.path.join(DATABASE_DIR, 'talentlens.db')}"
)

# ---------------------------------------------------------------------------
# Engine & Session
# ---------------------------------------------------------------------------
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Required for SQLite + threads
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------------------------------------------------------------
# Declarative Base
# ---------------------------------------------------------------------------
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session and ensures
    it is closed after the request completes.

    Yields:
        Session: An active SQLAlchemy session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Create all tables defined via the Base metadata.
    Should be called once at application startup.
    """
    Base.metadata.create_all(bind=engine)
