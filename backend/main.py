"""
TalentLens - FastAPI Application

Main application entry point. Provides all API endpoints for resume
analysis, session management, and CSV export.
"""

import os
import io
import csv
import random
import asyncio
import logging
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from pydantic import BaseModel, Field

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import bleach

from database import get_db, init_db
from models import AnalysisSession, Candidate
from resume_parser import parse_resume, is_likely_resume
from nlp_processor import preprocess_text, extract_skills, extract_skills_from_jd
from tfidf_scorer import compute_tfidf_score, batch_compute_tfidf_scores
from ai_scorer import score_resume_with_ai, get_ai_provider_status, generate_interview_questions, CALL_DELAY_SECONDS, call_llm, call_llm_json, OPENAI_API_KEY
from ranker import compute_final_scores, get_ranking_summary

class ShortlistEmailRequest(BaseModel):
    top_n: int = Field(default=3, ge=1, le=5)
    recipient_name: str = ""

class JDAnalyzeRequest(BaseModel):
    job_title: str
    job_description: str = Field(min_length=50)

class JDIssue(BaseModel):
    type: str
    severity: str
    phrase: str
    suggestion: str

class JDQualityResponse(BaseModel):
    quality_score: int = Field(ge=0, le=100)
    grade: str
    issues: list[JDIssue] = []
    strengths: list[str] = []

class NotesUpdateRequest(BaseModel):
    notes: str = Field(default="", max_length=1000)

SKILL_ALIAS_PATTERNS = [
    (re.compile(r"\bmat\s*plot\b", re.IGNORECASE), "matplotlib"),
    (re.compile(r"\bpower\s*bi\b", re.IGNORECASE), "power bi"),
]

SKILL_KEY_ALIASES = {
    "matplot": "matplotlib",
}

def _alias_skills_from_text(text: str) -> list[str]:
    if not text:
        return []
    found = []
    for pattern, canonical in SKILL_ALIAS_PATTERNS:
        if pattern.search(text):
            found.append(canonical)
    return found

def _skill_key(skill: str) -> str:
    if not skill:
        return ""
    key = re.sub(r"[^a-z0-9#+]", "", str(skill).lower())
    if not key:
        return ""
    return SKILL_KEY_ALIASES.get(key, key)

def _merge_skill_lists(ai_result: dict, jd_skills: list[str], resume_skills: list[str]) -> dict:
    ai_matched = list(ai_result.get("matched_skills") or [])
    ai_missing = list(ai_result.get("missing_skills") or [])

    def split_skills(lst):
        res = []
        for s in lst:
            for p in re.split(r'\s*(?:/|,| and |&)\s*', s):
                if p.strip(): res.append(p.strip())
        return res

    ai_matched = split_skills(ai_matched)
    ai_missing = split_skills(ai_missing)

    jd_map = {}
    for s in jd_skills:
        k = _skill_key(s)
        if k and k not in jd_map: jd_map[k] = s
        
    resume_keys = {k for k in (_skill_key(s) for s in resume_skills) if k}

    deterministic_matched_keys = set(jd_map.keys()) & resume_keys

    ai_matched_map = {}
    for s in ai_matched:
        k = _skill_key(s)
        if k and k not in ai_matched_map: ai_matched_map[k] = s

    ai_missing_map = {}
    for s in ai_missing:
        k = _skill_key(s)
        if k and k not in ai_missing_map: ai_missing_map[k] = s

    final_matched_keys = set()
    final_missing_keys = set()
    
    for k in jd_map.keys():
        if k in deterministic_matched_keys:
            final_matched_keys.add(k)
        elif k in ai_matched_map:
            final_matched_keys.add(k)
        else:
            final_missing_keys.add(k)
            
    for k in ai_matched_map.keys():
        if k not in final_matched_keys and k not in final_missing_keys:
            final_matched_keys.add(k)

    for k in ai_missing_map.keys():
        if k not in final_matched_keys and k not in final_missing_keys:
            if k not in deterministic_matched_keys and k not in resume_keys:
                final_missing_keys.add(k)

    final_matched = []
    for k in final_matched_keys:
        if k in jd_map: final_matched.append(jd_map[k])
        elif k in ai_matched_map: final_matched.append(ai_matched_map[k])
        else: final_matched.append(k.title())
        
    final_missing = []
    for k in final_missing_keys:
        if k in jd_map: final_missing.append(jd_map[k])
        elif k in ai_missing_map: final_missing.append(ai_missing_map[k])
        else: final_missing.append(k.title())

    def deduplicate_preserve_order(seq):
        seen = set()
        res = []
        for x in seq:
            k = _skill_key(x)
            if k not in seen:
                seen.add(k)
                res.append(x)
        return res

    ai_result["matched_skills"] = deduplicate_preserve_order(final_matched)
    ai_result["missing_skills"] = deduplicate_preserve_order(final_missing)
    return ai_result

def normalize_work_experience(raw_list: list) -> list:
    normalized = []
    for entry in (raw_list or []):
        if isinstance(entry, dict):
            normalized.append({
                "company":    str(entry.get("company", "Unknown Company")).strip(),
                "role":       str(entry.get("role", entry.get("title", ""))).strip(),
                "start_date": str(entry.get("start_date", entry.get("start", ""))).strip(),
                "end_date":   str(entry.get("end_date", entry.get("end", "Present"))).strip(),
                "description": str(entry.get("description", "")).strip()[:200]
            })
        elif isinstance(entry, str):
            normalized.append({
                "company": entry[:50],
                "role": "",
                "start_date": "",
                "end_date": "",
                "description": entry[:200]
            })
    return normalized

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App Initialization
# ---------------------------------------------------------------------------
app = FastAPI(
    title="TalentLens API",
    description="AI Resume Screening & Candidate Ranking System - See Beyond the Resume.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Rate Limiter setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://talent-lens-olive.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )

@app.on_event("startup")
async def startup():
    """Initialize database tables on application startup."""
    init_db()
    logger.info("TalentLens API started - database initialized")


# ---------------------------------------------------------------------------
# Supabase Auth Dependency
# ---------------------------------------------------------------------------
from fastapi.security import OAuth2PasswordBearer
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        if not supabase:
            logger.error("Supabase credentials not configured on backend.")
            raise HTTPException(status_code=500, detail="Auth configuration error")
        response = supabase.auth.get_user(token)
        if not response.user:
            raise credentials_exception
        return response.user
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        raise credentials_exception

# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
async def health_check():
    """Health check endpoint for deployment monitoring."""
    providers = await get_ai_provider_status()
    return {
        "status": "healthy",
        "service": "TalentLens API",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ai_providers": providers,
    }


# ---------------------------------------------------------------------------
# Analysis Endpoint
# ---------------------------------------------------------------------------

import models

@app.post("/api/analyze", tags=["Analysis"])
@limiter.limit("5/minute")
async def analyze_resumes(
    request: Request,
    job_description: str = Form(...),
    job_title: Optional[str] = Form(None),
    resumes: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Main analysis endpoint. Accepts a job description and multiple
    resume PDFs, then returns ranked candidates with AI insights.

    Args:
        job_description: The job description text.
        job_title: Optional job title.
        resumes: List of uploaded PDF files.
        db: Database session (injected).

    Returns:
        JSON with session_id, candidates, and summary statistics.
    """
    if not job_description.strip():
        raise HTTPException(400, "Job description cannot be empty")

    # Sanitize inputs to prevent malicious hidden HTML/scripts
    clean_jd = bleach.clean(job_description.strip(), tags=[], attributes={}, strip=True)
    clean_title = bleach.clean(job_title.strip(), tags=[], attributes={}, strip=True) if job_title and job_title.strip() else None

    if not clean_jd:
        raise HTTPException(400, "Job description contains invalid content")
    if not resumes:
        raise HTTPException(400, "At least one resume PDF is required")
    if len(resumes) > 20:
        raise HTTPException(400, "Maximum 20 resumes per analysis")

    # Create session
    session = AnalysisSession(
        user_id=current_user.id,
        job_title=(clean_title or "Untitled Position").title(),
        job_description=clean_jd,
        total_candidates=len(resumes),
        status="processing",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    logger.info("Session %s: analyzing %d resumes", session.id, len(resumes))

    # Preprocess JD
    jd_preprocessed = preprocess_text(clean_jd)
    jd_skills = extract_skills_from_jd(clean_jd)
    jd_skills = list(dict.fromkeys(jd_skills + _alias_skills_from_text(clean_jd)))

    # Parse all resumes
    parsed_resumes = []
    for resume_file in resumes:
        try:
            # Prevent OOM by reading at most 10MB + 1 byte
            file_bytes = await resume_file.read(10 * 1024 * 1024 + 1)
            
            # File Validation
            if len(file_bytes) > 10 * 1024 * 1024:
                raise ValueError("File exceeds 10MB limit")
            if len(file_bytes) == 0:
                raise ValueError("File is empty")
            if not file_bytes.startswith(b"%PDF"):
                raise ValueError("Not a valid PDF file")
                
            # PyMuPDF is CPU-bound
            parsed = await asyncio.to_thread(parse_resume, file_bytes, resume_file.filename)
            raw_text = parsed.get("raw_text", "")
            
            # Resume Content Validation — reject non-resume PDFs cleanly
            if not is_likely_resume(raw_text):
                parsed_resumes.append({
                    "filename": resume_file.filename,
                    "raw_text": "",
                    "candidate_name": "Invalid Document",
                    "status": "invalid_resume",
                    "error": f"'{resume_file.filename}' does not appear to be a resume. Please upload a valid resume PDF.",
                    "email": None, "phone": None,
                    "page_count": 0, "parser_used": "none",
                })
                logger.warning("Rejected '%s': not a resume", resume_file.filename)
                continue

            parsed["filename"] = resume_file.filename
            parsed_resumes.append(parsed)
        except Exception as exc:
            parsed_resumes.append({
                "filename": resume_file.filename,
                "raw_text": "",
                "candidate_name": "Parse Error",
                "email": None, "phone": None,
                "page_count": 0, "parser_used": "none",
                "error": str(exc),
            })
            logger.warning("Failed to parse '%s': %s", resume_file.filename, exc)

    # Separate invalid documents from valid resumes
    valid_resumes = []
    invalid_entries = []
    for parsed in parsed_resumes:
        if parsed.get("status") == "invalid_resume":
            invalid_entries.append(parsed)
        else:
            valid_resumes.append(parsed)

    # Preprocess resume texts (spaCy is CPU bound)
    preprocessed_texts = []
    for parsed in valid_resumes:
        text = parsed.get("raw_text", "")
        if text:
            preprocessed, skills = await asyncio.to_thread(_run_spacy_pipeline, text)
            parsed["preprocessed_text"] = preprocessed
            parsed["skills"] = skills
            preprocessed_texts.append(preprocessed)
        else:
            parsed["preprocessed_text"] = ""
            parsed["skills"] = {"all_skills": []}
            preprocessed_texts.append("")

    # Batch TF-IDF scoring
    tfidf_results = batch_compute_tfidf_scores(jd_preprocessed, preprocessed_texts)

    # AI Scoring (Parallel if OpenAI, Sequential if Groq)
    candidates_data = []
    
    if OPENAI_API_KEY:
        logger.info("OPENAI_API_KEY detected. Using FAST parallel processing mode.")
        sem = asyncio.Semaphore(5)

        async def process_candidate(parsed, tfidf_result):
            if parsed.get("error"):
                ai_result = {
                    "semantic_score": 0.0, "matched_skills": [], "missing_skills": jd_skills,
                    "transferable_skills": [], "candidate_summary": f"Resume parsing failed: {parsed['error']}",
                    "hiring_recommendation": "Poor Match", "ai_provider": "none", "ai_model": "none",
                }
            else:
                try:
                    async with sem:
                        ai_result = await asyncio.wait_for(
                            score_resume_with_ai(
                                clean_jd, parsed["raw_text"],
                                candidate_name=parsed.get("candidate_name", "Unknown"),
                            ),
                            timeout=180.0
                        )
                except asyncio.TimeoutError:
                    ai_result = {
                        "semantic_score": 0.0, "matched_skills": [], "missing_skills": jd_skills,
                        "transferable_skills": [], "candidate_summary": "AI scoring timed out.",
                        "hiring_recommendation": "Poor Match", "ai_provider": "none", "ai_model": "none",
                    }
                    logger.error("AI scoring timed out for '%s'", parsed.get("candidate_name", "Unknown"))
                except Exception as e:
                    ai_result = {
                        "semantic_score": 0.0, "matched_skills": [], "missing_skills": jd_skills,
                        "transferable_skills": [], "candidate_summary": f"AI analysis failed: {str(e)}",
                        "hiring_recommendation": "Poor Match", "ai_provider": "none", "ai_model": "none",
                    }
                    logger.error("AI analysis error for '%s': %s", parsed.get("candidate_name", "Unknown"), e)
                    
            resume_skills = list(dict.fromkeys(
                (parsed.get("skills", {}) or {}).get("all_skills", []) +
                _alias_skills_from_text(parsed.get("raw_text", ""))
            ))
            ai_result = _merge_skill_lists(ai_result, jd_skills, resume_skills)

            return {
                "filename": parsed["filename"],
                "candidate_name": parsed.get("candidate_name") or "Unknown Candidate",
                "email": parsed.get("email"),
                "phone": parsed.get("phone"),
                "linkedin": parsed.get("linkedin"),
                "github": parsed.get("github"),
                "portfolio": parsed.get("portfolio"),
                "education": ai_result.pop("structured_education", parsed.get("education", [])),
                "experience": ai_result.pop("structured_experience", parsed.get("experience", [])),
                "projects": ai_result.pop("structured_projects", parsed.get("projects", [])),
                "certifications": parsed.get("certifications", []),
                "languages": parsed.get("languages", []),
                "raw_text": parsed.get("raw_text", ""),
                "preprocessed_text": parsed.get("preprocessed_text", ""),
                "extracted_skills": parsed.get("skills", {}).get("all_skills", []),
                "tfidf_score": tfidf_result["tfidf_score"],
                **ai_result,
            }
            
        tasks = [process_candidate(p, t) for p, t in zip(valid_resumes, tfidf_results)]
        candidates_data = await asyncio.gather(*tasks)
        
    else:
        logger.info("OPENAI_API_KEY missing. Using SAFE sequential processing mode.")
        for idx, (parsed, tfidf_result) in enumerate(zip(valid_resumes, tfidf_results)):
            if parsed.get("error"):
                ai_result = {
                    "semantic_score": 0.0, "matched_skills": [], "missing_skills": jd_skills,
                    "transferable_skills": [], "candidate_summary": f"Resume parsing failed: {parsed['error']}",
                    "hiring_recommendation": "Poor Match", "ai_provider": "none", "ai_model": "none",
                }
            else:
                try:
                    ai_result = await asyncio.wait_for(
                        score_resume_with_ai(
                            clean_jd, parsed["raw_text"],
                            candidate_name=parsed.get("candidate_name", "Unknown"),
                        ),
                        timeout=60.0
                    )
                except asyncio.TimeoutError:
                    ai_result = {
                        "semantic_score": 0.0, "matched_skills": [], "missing_skills": jd_skills,
                        "transferable_skills": [], "candidate_summary": "AI scoring timed out.",
                        "hiring_recommendation": "Poor Match", "ai_provider": "none", "ai_model": "none",
                    }
                    logger.error("AI scoring timed out for '%s'", parsed.get("candidate_name", "Unknown"))
    
                # Wait between candidates to respect rate limits (skip delay after the last one)
                if idx < len(valid_resumes) - 1:
                    await asyncio.sleep(3.0)
    

            resume_skills = list(dict.fromkeys(
                (parsed.get("skills", {}) or {}).get("all_skills", []) +
                _alias_skills_from_text(parsed.get("raw_text", ""))
            ))
            ai_result = _merge_skill_lists(ai_result, jd_skills, resume_skills)

            candidates_data.append({
                "filename": parsed["filename"],
                "candidate_name": parsed.get("candidate_name") or "Unknown Candidate",
                "email": parsed.get("email"),
                "phone": parsed.get("phone"),
                "linkedin": parsed.get("linkedin"),
                "github": parsed.get("github"),
                "portfolio": parsed.get("portfolio"),
                "education": ai_result.pop("structured_education", parsed.get("education", [])),
                "experience": ai_result.pop("structured_experience", parsed.get("experience", [])),
                "projects": ai_result.pop("structured_projects", parsed.get("projects", [])),
                "certifications": parsed.get("certifications", []),
                "languages": parsed.get("languages", []),
                "raw_text": parsed.get("raw_text", ""),
                "preprocessed_text": parsed.get("preprocessed_text", ""),
                "extracted_skills": parsed.get("skills", {}).get("all_skills", []),
                "tfidf_score": tfidf_result["tfidf_score"],
                **ai_result,
            })

    # Compute final rankings
    ranked = compute_final_scores(candidates_data)
    summary = get_ranking_summary(ranked)

    # Save to database
    for cand_data in ranked:
        candidate = Candidate(
            session_id=session.id,
            filename=str(cand_data["filename"])[:500],
            candidate_name=str(cand_data["candidate_name"])[:250] or "Unknown Candidate",
            email=str(cand_data.get("email") or "")[:250] or None,
            phone=str(cand_data.get("phone") or "")[:60] or None,
            linkedin=str(cand_data.get("linkedin") or "")[:500] or None,
            github=str(cand_data.get("github") or "")[:500] or None,
            portfolio=str(cand_data.get("portfolio") or "")[:500] or None,
            education=cand_data.get("education", []),
            experience=cand_data.get("experience", []),
            projects=cand_data.get("projects", []),
            certifications=cand_data.get("certifications", []),
            languages=cand_data.get("languages", []),
            raw_text=cand_data.get("raw_text", "")[:5000],
            preprocessed_text=cand_data.get("preprocessed_text", "")[:5000],
            extracted_skills=cand_data.get("extracted_skills", []),
            tfidf_score=cand_data["tfidf_score"],
            semantic_score=cand_data["semantic_score"],
            final_score=cand_data["final_score"],
            final_rank=cand_data["final_rank"],
            score_conflict=cand_data.get("score_conflict", False),
            matched_skills=cand_data.get("matched_skills", []),
            missing_skills=cand_data.get("missing_skills", []),
            transferable_skills=cand_data.get("transferable_skills", []),
            candidate_summary=cand_data.get("candidate_summary", ""),
            recommended_improvements=cand_data.get("recommended_improvements", []),
            hiring_recommendation=cand_data.get("hiring_recommendation", ""),
            bias_risk=cand_data.get("bias_risk", "low"),
            bias_explanation=cand_data.get("bias_explanation", ""),
            notes=cand_data.get("notes", ""),
            red_flags=cand_data.get("red_flags", []),
            ai_provider=cand_data.get("ai_provider", ""),
            ai_model=cand_data.get("ai_model", ""),
        )
        db.add(candidate)

    session.status = "completed"
    db.commit()

    # Build response (exclude raw_text for brevity)
    response_candidates = []
    # We must query the DB to get the auto-generated IDs, but since we just committed, we can just fetch them
    saved_candidates = db.query(Candidate).filter(Candidate.session_id == session.id).order_by(Candidate.final_rank).all()
    for c in saved_candidates:
        resp = {
            "id": c.id,
            "filename": c.filename,
            "candidate_name": c.candidate_name,
            "email": c.email,
            "phone": c.phone,
            "linkedin": c.linkedin,
            "github": c.github,
            "portfolio": c.portfolio,
            "education": c.education,
            "experience": c.experience,
            "projects": c.projects,
            "certifications": c.certifications,
            "languages": c.languages,
            "extracted_skills": c.extracted_skills,
            "tfidf_score": c.tfidf_score,
            "semantic_score": c.semantic_score,
            "final_score": c.final_score,
            "final_rank": c.final_rank,
            "score_conflict": c.score_conflict,
            "matched_skills": c.matched_skills,
            "missing_skills": c.missing_skills,
            "transferable_skills": c.transferable_skills,
            "candidate_summary": c.candidate_summary,
            "recommended_improvements": c.recommended_improvements,
            "hiring_recommendation": c.hiring_recommendation,
            "bias_risk": c.bias_risk,
            "bias_explanation": c.bias_explanation,
            "notes": c.notes,
            "red_flags": c.red_flags,
            "ai_provider": c.ai_provider,
            "ai_model": c.ai_model,
        }
        response_candidates.append(resp)

    # Append invalid document entries (not saved to DB, just sent to frontend)
    for inv in invalid_entries:
        response_candidates.append({
            "id": None,
            "filename": inv["filename"],
            "candidate_name": inv.get("candidate_name", "Invalid Document"),
            "status": "invalid_resume",
            "error": inv.get("error", "This file does not appear to be a resume."),
            "tfidf_score": 0.0,
            "semantic_score": 0.0,
            "final_score": 0.0,
            "final_rank": 999,
            "hiring_recommendation": "N/A",
        })

    return {
        "session_id": session.id,
        "job_title": session.job_title,
        "total_candidates": len(ranked) + len(invalid_entries),
        "summary": summary,
        "candidates": response_candidates,
    }


# ---------------------------------------------------------------------------
# Session Management
# ---------------------------------------------------------------------------

def _run_spacy_pipeline(text: str):
    """Wrapper for CPU-bound spaCy functions."""
    return preprocess_text(text), extract_skills(text)

@app.get("/api/sessions", tags=["Sessions"])
async def list_sessions(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """List all past analysis sessions, most recent first."""
    sessions = db.query(AnalysisSession).filter(
        AnalysisSession.user_id == current_user.id
    ).order_by(AnalysisSession.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "job_title": s.job_title,
            "total_candidates": s.total_candidates,
            "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]


@app.get("/api/session/{session_id}", tags=["Sessions"])
async def get_session(
    session_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get full results for a specific analysis session."""
    session = db.query(AnalysisSession).filter(
        AnalysisSession.id == session_id,
        AnalysisSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    candidates = db.query(Candidate).filter(
        Candidate.session_id == session_id
    ).order_by(Candidate.final_rank).all()

    return {
        "id": session.id,
        "job_title": session.job_title,
        "job_description": session.job_description,
        "total_candidates": session.total_candidates,
        "status": session.status,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "candidates": [
            {
                "id": c.id,
                "filename": c.filename,
                "candidate_name": c.candidate_name,
                "email": c.email,
                "phone": c.phone,
                "linkedin": c.linkedin,
                "github": c.github,
                "portfolio": c.portfolio,
                "education": c.education,
                "experience": c.experience,
                "projects": c.projects,
                "certifications": c.certifications,
                "languages": c.languages,
                "extracted_skills": c.extracted_skills,
                "tfidf_score": c.tfidf_score,
                "semantic_score": c.semantic_score,
                "final_score": c.final_score,
                "final_rank": c.final_rank,
                "score_conflict": c.score_conflict,
                "matched_skills": c.matched_skills,
                "missing_skills": c.missing_skills,
                "transferable_skills": c.transferable_skills,
                "candidate_summary": c.candidate_summary,
                "hiring_recommendation": c.hiring_recommendation,
                "bias_risk": c.bias_risk,
                "bias_explanation": c.bias_explanation,
                "notes": c.notes,
                "red_flags": c.red_flags,
                "ai_provider": c.ai_provider,
                "ai_model": c.ai_model,
            }
            for c in candidates
        ],
    }


@app.delete("/api/session/{session_id}", tags=["Sessions"])
async def delete_session(
    session_id: str, 
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Delete an analysis session and all its candidates."""
    session = db.query(AnalysisSession).filter(
        AnalysisSession.id == session_id,
        AnalysisSession.user_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted", "session_id": session_id}


@app.get("/api/candidates/{candidate_id}/questions", tags=["AI"])
@limiter.limit("10/minute")
async def get_interview_questions(
    request: Request,
    candidate_id: str, 
    db: Session = Depends(get_db)
):
    """Generate custom interview questions for a candidate using LLMs."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(404, "Candidate not found")
        
    session = db.query(AnalysisSession).filter(AnalysisSession.id == candidate.session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")

    cand_dict = {
        "candidate_summary": candidate.candidate_summary,
        "matched_skills": candidate.matched_skills,
        "missing_skills": candidate.missing_skills,
    }
    
    questions = await generate_interview_questions(session.job_description, cand_dict)
    return {"questions": questions}

@app.patch("/api/candidates/{candidate_id}/notes", tags=["Candidates"])
async def update_candidate_notes(
    candidate_id: str,
    payload: NotesUpdateRequest,
    db: Session = Depends(get_db)
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    cleaned_notes = payload.notes.strip()[:1000]
    candidate.notes = cleaned_notes
    db.commit()
    
    return {"success": True, "notes": cleaned_notes}

@app.post("/api/sessions/{session_id}/shortlist-email", tags=["AI"])
@limiter.limit("5/minute")
async def generate_shortlist_email(
    request: Request,
    session_id: str,
    payload: ShortlistEmailRequest,
    db: Session = Depends(get_db)
):
    """
    Generate a professionally formatted shortlist email with each candidate
    in a separate, clearly delineated section.
    """
    candidates = db.query(Candidate).filter(
        Candidate.session_id == session_id
    ).order_by(Candidate.final_score.desc()).limit(payload.top_n).all()
    
    if not candidates:
        raise HTTPException(404, "No candidates found for this session")
    
    session = db.query(AnalysisSession).filter(AnalysisSession.id == session_id).first()
    
    # Generate compelling description for each candidate
    candidate_sections = []
    for i, c in enumerate(candidates, 1):
        prompt = f"""
        Write a 2-3 sentence professional HR briefing for this candidate:
        
        Name: {c.candidate_name}
        Score: {c.final_score:.1f}/100
        Recommendation: {c.hiring_recommendation}
        Summary: {c.candidate_summary or 'N/A'}
        Strengths: {', '.join((c.matched_skills or [])[:5])}
        Missing: {', '.join((c.missing_skills or [])[:3]) or 'None'}
        
        Write a concise, professional assessment. Focus on why this candidate is a good fit.
        Tone: objective hiring manager, not salesy.
        Return ONLY the 2-3 sentence description, nothing else.
        """
        
        try:
            description = await call_llm(prompt)
        except Exception as exc:
            logger.warning("LLM generation failed for %s: %s", c.candidate_name, exc)
            description = (
                f"{c.candidate_name} scored {c.final_score:.1f}/100 with a {c.hiring_recommendation} "
                f"recommendation. Key strengths: {', '.join((c.matched_skills or [])[:3]) or 'Technical excellence'}."
            )
        
        # Build individual candidate block
        candidate_section = f"""
CANDIDATE #{i}: {c.candidate_name}
═════════════════════════════════════
Score: {c.final_score:.1f}/100 | Recommendation: {c.hiring_recommendation}
Contact: {c.email or 'Not provided'} | {c.phone or 'Phone not provided'}
LinkedIn: {c.linkedin or 'Not provided'}

Profile Assessment:
{description}

Key Strengths: {', '.join((c.matched_skills or [])[:5]) or 'Refer to full profile'}
Areas to Explore: {', '.join((c.missing_skills or [])[:3]) or 'Already strong in required areas'}
"""
        candidate_sections.append(candidate_section)
    
    # Build opening paragraph
    opening = f"""
Dear Hiring Team,

Below is a curated shortlist of {len(candidates)} top candidate(s) for the {session.job_title} position based on our comprehensive AI-assisted screening process.

"""
    
    # Build closing paragraph
    closing = f"""

RECOMMENDED NEXT STEPS:
• Schedule interviews with top candidates (Rank #1 highly recommended)
• Review full candidate profiles for additional context
• Consider skills assessment for finalists
• Plan for reference checks in parallel

This report was generated on {datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')}.

Best regards,
TalentLens Recruitment Team
"""
    
    # Combine all sections
    email_body = opening + "\n".join(candidate_sections) + closing
    
    subject = f"Candidate Shortlist - {session.job_title} ({len(candidates)} Recommended)"
    
    logger.info("Generated formatted shortlist email for session %s with %d candidates", session_id, len(candidates))
    
    return {
        "subject": subject,
        "body": email_body,
        "candidate_count": len(candidates),
        "top_score": candidates[0].final_score if candidates else 0
    }

@app.post("/api/jd/analyze", tags=["AI"])
@limiter.limit("5/minute")
async def analyze_job_description(
    request: Request,
    payload: JDAnalyzeRequest
) -> JDQualityResponse:
    prompt = f"""You are a Job Description Quality Analyzer. 
  Evaluate the provided job description against 
  these five fixed criteria. Score each 0-20:

  1. CLARITY (0-20): Are requirements, experience, 
     and responsibilities clearly and specifically stated?
  2. COMPLETENESS (0-20): Does it include role summary,
     responsibilities, required skills, qualifications,
     and compensation?
  3. SPECIFICITY (0-20): Are vague terms replaced with
     measurable, specific language?
  4. CANDIDATE APPEAL (0-20): Does it clearly communicate
     growth opportunities, culture, and benefits?
  5. STRUCTURE (0-20): Is it well organized with clear
     sections and professional formatting?

  IMPORTANT RULES:
  - For EVERY criterion that scores below 20, you MUST 
    provide exactly one specific, actionable suggestion.
  - Quote the exact text from the JD that needs changing.
  - State exactly what to change it to.
  - Even a score of 18 or 19 must include a suggestion.
  - A criterion only gets NO suggestion if it scores 
    exactly 20/20.
  - NEVER return an empty issues array unless all 5 
    criteria scored 20/20 (perfect 100/100).
  - Strengths should list criteria that scored 18-20.
  - Always aim to help the user reach 100/100.

  Return this exact JSON structure:
  {{
    "total": <sum of all 5 criterion scores>,
    "grade": "<A+|A|B|C|D>",
    "criteria": {{
      "clarity": <number>,
      "completeness": <number>,
      "specificity": <number>,
      "candidate_appeal": <number>,
      "structure": <number>
    }},
    "issues": [
      {{
        "criterion": "<string>",
        "score": <number>,
        "quote": "<string>",
        "suggestion": "<string>"
      }}
    ],
    "strengths": ["<string>"]
  }}

=== JOB DESCRIPTION ===
{payload.job_description}
===
"""
    try:
        response = await call_llm_json(prompt, temperature=0.1)
        raw_score = response.get("total", response.get("quality_score", 0))
        try:
            score = int(round(float(raw_score)))
        except (TypeError, ValueError):
            score = 0
        score = max(0, min(100, score))

        grade = response.get("grade", "C")
        if len(grade) > 2: # in case it returns the whole explanation
            if score >= 95: grade = "A+"
            elif score >= 85: grade = "A"
            elif score >= 70: grade = "B"
            elif score >= 55: grade = "C"
            else: grade = "D"

        issues = []
        for item in response.get("issues", []) or []:
            if not isinstance(item, dict):
                continue
            issues.append(JDIssue(
                type=str(item.get("criterion", item.get("type", "unclear"))),
                severity=str(item.get("score", "low")),  # We will map score to severity string in frontend or just pass it
                phrase=str(item.get("quote", item.get("phrase", ""))),
                suggestion=str(item.get("suggestion", "")),
            ))

        strengths = response.get("strengths", [])
        strengths = [str(s) for s in strengths if s] if isinstance(strengths, list) else []

        return JDQualityResponse(
            quality_score=score,
            grade=grade,
            issues=issues,
            strengths=strengths
        )
    except Exception as e:
        logger.error(f"JD analysis failed: {e}")
        if "429" in str(e):
            raise HTTPException(429, "AI provider rate limit exceeded. Please wait a moment before trying again.")
        raise HTTPException(500, f"Failed to analyze job description: {str(e)}")

# ---------------------------------------------------------------------------
# CSV Export
# ---------------------------------------------------------------------------

@app.get("/api/export/{session_id}", tags=["Export"])
async def export_csv(session_id: str, db: Session = Depends(get_db)):
    """Download ranked results as a CSV file."""
    session = db.query(AnalysisSession).filter(
        AnalysisSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    candidates = db.query(Candidate).filter(
        Candidate.session_id == session_id
    ).order_by(Candidate.final_rank).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Rank", "Candidate Name", "Email", "Phone", "Filename",
        "TF-IDF Score", "Semantic Score", "Final Score",
        "Hiring Recommendation", "Score Conflict",
        "Matched Skills", "Missing Skills", "Transferable Skills",
        "AI Summary", "AI Provider", "Notes", "Bias Risk", "Red Flags"
    ])

    for c in candidates:
        writer.writerow([
            c.final_rank, c.candidate_name, c.email or "", c.phone or "",
            c.filename, c.tfidf_score, c.semantic_score, c.final_score,
            c.hiring_recommendation, "Yes" if c.score_conflict else "No",
            "; ".join(c.matched_skills or []),
            "; ".join(c.missing_skills or []),
            "; ".join(c.transferable_skills or []),
            c.candidate_summary or "", c.ai_provider or "",
            c.notes or "", c.bias_risk or "low",
            "; ".join(c.red_flags or [])
        ])

    output.seek(0)
    # Sanitize job title for filename
    import re
    safe_title = re.sub(r'[^a-zA-Z0-9 -]', '', session.job_title).strip()
    filename = f"TalentLens_Results_{safe_title}_{session_id[:8]}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )


# ---------------------------------------------------------------------------
# Serve React static files in production
# ---------------------------------------------------------------------------
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
