"""
TalentLens - AI Scorer Module

Dual-provider semantic scoring: Groq (primary) → Gemini (fallback).
All responses requested as structured JSON with validation.
"""

import json
import os
import re
import asyncio
import logging
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
_raw_gemini = os.getenv("GEMINI_API_KEY", "")
# Detect placeholder keys and treat them as unconfigured
GEMINI_API_KEY = "" if "your_" in _raw_gemini.lower() or not _raw_gemini.strip() else _raw_gemini
GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions"
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"
GROQ_PRIMARY_MODEL = "llama-3.1-8b-instant"
OPENAI_MODEL = "gpt-4o-mini"
GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile"
GEMINI_MODEL = "gemini-2.0-flash"
CALL_DELAY_SECONDS = float(os.getenv("AI_CALL_DELAY", "1.5"))

SCORING_PROMPT = """You are an expert HR analyst and technical recruiter.

Analyze this resume against the job description.
Return ONLY valid JSON with this exact structure:
{{
    "semantic_score": <float 0-100>,
    "matched_skills": [<list of strings>],
    "missing_skills": [<list of strings>],
    "transferable_skills": [<list of strings>],
    "structured_experience": [
        {{"company": "Company Name", "role": "Job Title", "start_date": "MM/YYYY", "end_date": "MM/YYYY or Present"}}
    ],
    "structured_education": [
        {{"institution": "University/School", "degree": "Degree/Major", "duration": "Dates"}}
    ],
    "structured_projects": [
        {{"name": "Project Name", "description": "Brief 1-sentence description", "technologies": "Tech stack used"}}
    ],
    "candidate_summary": "<A detailed 4-5 sentence professional summary highlighting their core competencies, major achievements, and how their background aligns with the job requirements.>",
    "recommended_improvements": ["<list of 1-3 actionable sentences on what the candidate could improve or learn to better fit this role>"],
    "hiring_recommendation": "<Strong Match | Good Match | Partial Match | Poor Match>",
    "bias_risk": "<low | medium | high>",
    "bias_explanation": "<max one sentence explanation if bias is found, else empty string>",
    "red_flags": ["<list of strings representing potential red flags, e.g. employment gaps, job hopping>"]
}}

Scoring: 80-100 Strong Match, 60-79 Good Match, 40-59 Partial Match, 0-39 Poor Match.

CRITICAL INSTRUCTIONS FOR 'missing_skills':
- You MUST perform case-insensitive and spelling-variant checks before declaring a skill missing (e.g., 'Matplotlib' == 'matplotlib', 'visualisation' == 'visualization', 'Power BI' == 'PowerBI').
- If the resume explicitly mentions the tool/skill in any section, do NOT put it in missing_skills.

Also evaluate scoring fairness:
- Does the JD use exclusionary language that disadvantages non-traditional paths?
- Is this candidate penalized for credential gaps (no big-name company/university) 
  despite strong demonstrated skills?
- Are there transferable skills being ignored due to domain mismatch in wording only?

Return:
- bias_risk: "low" if scoring is merit-based, "medium" if minor JD bias detected, 
  "high" if candidate likely disadvantaged by wording not capability
- bias_explanation: one sentence max, or empty string if low

=== JOB DESCRIPTION ===
{job_description}

=== RESUME ===
{resume_text}"""

INTERVIEW_PROMPT = """You are an expert technical recruiter and hiring manager.

Based on the job description and the candidate's resume summary and skills, generate 3-5 highly targeted interview questions.
Focus on probing their "Missing Skills" or verifying their "Transferable Skills".

Return ONLY valid JSON with this exact structure:
{{
    "questions": [
        {{
            "question": "<The interview question>",
            "reason": "<Why you are asking this (e.g., to test a missing skill)>",
            "expected_answer": "<What a good answer sounds like>"
        }}
    ]
}}

=== JOB DESCRIPTION ===
{job_description}

=== CANDIDATE SUMMARY ===
{candidate_summary}

=== MATCHED SKILLS ===
{matched_skills}

=== MISSING SKILLS ===
{missing_skills}"""

REQUIRED_KEYS = {"semantic_score", "matched_skills", "missing_skills",
                 "transferable_skills", "candidate_summary", "hiring_recommendation"}
VALID_RECOMMENDATIONS = {"Strong Match", "Good Match", "Partial Match", "Poor Match"}


def _validate_ai_response(data: dict) -> dict:
    """Validate and normalise AI scoring response with defaults for missing fields."""
    if not isinstance(data, dict):
        raise ValueError("AI response is not a JSON object")

    score = data.get("semantic_score", 50.0)
    try:
        score = float(score)
    except (TypeError, ValueError):
        score = 50.0
    data["semantic_score"] = round(max(0.0, min(100.0, score)), 2)

    for key in ("matched_skills", "missing_skills", "transferable_skills", "red_flags"):
        val = data.get(key, [])
        data[key] = [str(s) for s in val if s] if isinstance(val, list) else []

    summary = data.get("candidate_summary", "")
    data["candidate_summary"] = summary.strip() if isinstance(summary, str) and summary.strip() else "Summary not available."

    rec = data.get("hiring_recommendation", "")
    if rec not in VALID_RECOMMENDATIONS:
        s = data["semantic_score"]
        if s >= 80: data["hiring_recommendation"] = "Strong Match"
        elif s >= 60: data["hiring_recommendation"] = "Good Match"
        elif s >= 40: data["hiring_recommendation"] = "Partial Match"
        else: data["hiring_recommendation"] = "Poor Match"

    br = data.get("bias_risk", "low")
    if not isinstance(br, str) or br.lower() not in ("low", "medium", "high"):
        br = "low"
    data["bias_risk"] = br.lower()
    
    be = data.get("bias_explanation", "")
    data["bias_explanation"] = str(be)[:200] if be else ""

    return data


def _extract_json_from_text(text: str) -> dict:
    """Extract JSON object from LLM response text, handling code fences."""
    text = re.sub(r"^```(?:json)?\s*", "", text.strip())
    text = re.sub(r"\s*```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"No valid JSON in response: {text[:200]}")


async def _call_groq(prompt: str, model: str = GROQ_PRIMARY_MODEL) -> dict:
    """Send chat completion to Groq API with exponential backoff on 429."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are an expert HR analyst. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3, "max_tokens": 1024,
        "response_format": {"type": "json_object"},
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(GROQ_BASE_URL, headers=headers, json=payload)
                if response.status_code == 429:
                    raise httpx.HTTPStatusError("Rate limited", request=response.request, response=response)
                response.raise_for_status()
                content = response.json()["choices"][0]["message"]["content"]
                return _validate_ai_response(_extract_json_from_text(content))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 and attempt < max_retries - 1:
                # Exponential backoff: 3s, 6s, 12s
                await asyncio.sleep(3.0 * (2 ** attempt))
            else:
                raise


async def _call_gemini(prompt: str) -> dict:
    """Send generation request to Google Gemini API."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not set")
    url = f"{GEMINI_BASE_URL}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024, "responseMimeType": "application/json"},
    }
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 429:
                    raise httpx.HTTPStatusError("Rate limited", request=response.request, response=response)
                response.raise_for_status()
                data = response.json()
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                return _validate_ai_response(_extract_json_from_text(content))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 and attempt < max_retries - 1:
                import random
                await asyncio.sleep(2.0 + random.uniform(1.0, 3.0))
            else:
                raise

async def _call_openai(prompt: str) -> dict:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not set")
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": "You are an expert HR analyst. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3, "max_tokens": 1024,
        "response_format": {"type": "json_object"},
    }
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(OPENAI_BASE_URL, headers=headers, json=payload)
                if response.status_code == 429:
                    raise httpx.HTTPStatusError("Rate limited", request=response.request, response=response)
                response.raise_for_status()
                content = response.json()["choices"][0]["message"]["content"]
                return _validate_ai_response(_extract_json_from_text(content))
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 and attempt < max_retries - 1:
                import random
                await asyncio.sleep(3.0 * (2 ** attempt) + random.uniform(0.5, 1.5))
            else:
                raise

async def _call_llm_raw(prompt: str, model: str = GROQ_PRIMARY_MODEL, force_groq: bool = False) -> dict:
    """Send generic completion request without expecting scoring JSON format."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not set")
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are an expert HR analyst. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5, "max_tokens": 1024,
        "response_format": {"type": "json_object"},
    }
    
    # Use OpenAI if available unless forced to use Groq for speed
    if OPENAI_API_KEY and not force_groq:
        headers["Authorization"] = f"Bearer {OPENAI_API_KEY}"
        payload["model"] = OPENAI_MODEL
        url = OPENAI_BASE_URL
    else:
        url = GROQ_BASE_URL
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return _extract_json_from_text(content)


async def score_resume_with_ai(job_description: str, resume_text: str, candidate_name: str = "Unknown") -> dict:
    """
    Score a resume using the AI provider chain: Groq primary → Groq fallback → Gemini.
    Returns scoring dict with ai_provider and ai_model metadata.
    """
    jd = job_description[:3000]
    resume = resume_text[:4000]
    prompt = SCORING_PROMPT.format(job_description=jd, resume_text=resume)

    # Attempt 0: OpenAI Primary (Fast, Parallel)
    if OPENAI_API_KEY:
        try:
            logger.info("Scoring '%s' with OpenAI (%s)", candidate_name, OPENAI_MODEL)
            result = await _call_openai(prompt)
            result["ai_provider"] = "openai"
            result["ai_model"] = OPENAI_MODEL
            return result
        except Exception as exc:
            logger.warning("OpenAI failed for '%s': %s", candidate_name, exc)

    # Attempt 1: Groq primary
    try:
        logger.info("Scoring '%s' with Groq (%s)", candidate_name, GROQ_PRIMARY_MODEL)
        result = await _call_groq(prompt, GROQ_PRIMARY_MODEL)
        result["ai_provider"] = "groq"
        result["ai_model"] = GROQ_PRIMARY_MODEL
        return result
    except Exception as exc:
        logger.warning("Groq primary failed for '%s': %s", candidate_name, exc)

    # Brief pause before fallback to avoid immediate rate limit
    await asyncio.sleep(2.0)

    # Attempt 2: Groq fallback model
    try:
        logger.info("Trying Groq fallback (%s) for '%s'", GROQ_FALLBACK_MODEL, candidate_name)
        result = await _call_groq(prompt, GROQ_FALLBACK_MODEL)
        result["ai_provider"] = "groq"
        result["ai_model"] = GROQ_FALLBACK_MODEL
        return result
    except Exception as exc:
        logger.warning("Groq fallback failed for '%s': %s", candidate_name, exc)

    # Attempt 3: Gemini (only if a real API key is configured)
    if GEMINI_API_KEY:
        try:
            logger.info("Switching to Gemini for '%s'", candidate_name)
            result = await _call_gemini(prompt)
            result["ai_provider"] = "gemini"
            result["ai_model"] = GEMINI_MODEL
            return result
        except Exception as exc:
            logger.error("Gemini also failed for '%s': %s", candidate_name, exc)
    else:
        logger.warning("Gemini not configured, skipping for '%s'", candidate_name)

    logger.error("All AI providers failed for '%s'", candidate_name)
    return {
        "semantic_score": 0.0, "matched_skills": [], "missing_skills": [],
        "transferable_skills": [], "candidate_summary": "AI scoring unavailable.",
        "hiring_recommendation": "Poor Match", "ai_provider": "none", "ai_model": "none",
    }


async def generate_interview_questions(job_description: str, candidate: dict) -> list[dict]:
    """Generate targeted interview questions based on candidate profile."""
    prompt = INTERVIEW_PROMPT.format(
        job_description=job_description[:2000],
        candidate_summary=candidate.get("candidate_summary", ""),
        matched_skills=", ".join(candidate.get("matched_skills", [])),
        missing_skills=", ".join(candidate.get("missing_skills", [])),
    )

    try:
        if GROQ_API_KEY:
            # Force Groq for instant 0.5s generation instead of OpenAI's 3s generation
            result = await _call_llm_raw(prompt, GROQ_PRIMARY_MODEL, force_groq=True)
            return result.get("questions", [])
    except Exception as e:
        logger.warning("Failed to generate questions: %s", e)
        
    try:
        if GEMINI_API_KEY:
            result = await _call_gemini(prompt)
            return result.get("questions", [])
    except Exception as exc:
        logger.error("All AI providers failed for questions: %s", exc)
        
    return [{"question": "Could you walk me through your relevant experience for this role?", "reason": "Fallback question generation failed.", "expected_answer": "Candidate highlights key experiences."}]


async def call_llm_json(prompt: str, temperature: float = 0.3) -> dict:
    """Generic JSON LLM call with robust fallback."""
    sys_prompt = "You are a helpful assistant. Return ONLY valid JSON."
    
    if OPENAI_API_KEY:
        for attempt in range(3):
            try:
                headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
                payload = {"model": OPENAI_MODEL, "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": prompt}], "temperature": temperature, "max_tokens": 1024, "response_format": {"type": "json_object"}}
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(OPENAI_BASE_URL, headers=headers, json=payload)
                    if resp.status_code == 429:
                        raise httpx.HTTPStatusError("Rate limited", request=resp.request, response=resp)
                    resp.raise_for_status()
                    return _extract_json_from_text(resp.json()["choices"][0]["message"]["content"])
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429 and attempt < 2:
                    await asyncio.sleep(2.0 * (2 ** attempt))
                else:
                    logger.warning("Generic OpenAI JSON call failed: %s", exc)
                    break
            except Exception as e:
                logger.warning("Generic OpenAI JSON call failed: %s", e)
                break

    if GROQ_API_KEY:
        for attempt in range(3):
            try:
                headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
                payload = {"model": GROQ_PRIMARY_MODEL, "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": prompt}], "temperature": temperature, "max_tokens": 1024, "response_format": {"type": "json_object"}}
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(GROQ_BASE_URL, headers=headers, json=payload)
                    if resp.status_code == 429:
                        raise httpx.HTTPStatusError("Rate limited", request=resp.request, response=resp)
                    resp.raise_for_status()
                    return _extract_json_from_text(resp.json()["choices"][0]["message"]["content"])
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429 and attempt < 2:
                    await asyncio.sleep(2.0 * (2 ** attempt))
                else:
                    logger.warning("Generic Groq JSON call failed: %s", exc)
                    break
            except Exception as e:
                logger.warning("Generic Groq JSON call failed: %s", e)
                break
            
    if GEMINI_API_KEY:
        try:
            url = f"{GEMINI_BASE_URL}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": temperature, "maxOutputTokens": 1024, "responseMimeType": "application/json"}}
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                return _extract_json_from_text(resp.json()["candidates"][0]["content"]["parts"][0]["text"])
        except Exception as e:
            logger.error("Generic Gemini JSON call failed: %s", e)
            
    return {}


async def call_llm(prompt: str) -> str:
    """Generic text LLM call with robust fallback."""
    sys_prompt = "You are a professional hiring manager."
    
    if OPENAI_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"}
            payload = {"model": OPENAI_MODEL, "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": prompt}], "temperature": 0.5, "max_tokens": 1024}
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(OPENAI_BASE_URL, headers=headers, json=payload)
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning("Generic OpenAI text call failed: %s", e)

    if GROQ_API_KEY:
        try:
            headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
            payload = {"model": GROQ_PRIMARY_MODEL, "messages": [{"role": "system", "content": sys_prompt}, {"role": "user", "content": prompt}], "temperature": 0.5, "max_tokens": 1024}
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(GROQ_BASE_URL, headers=headers, json=payload)
                resp.raise_for_status()
                return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning("Generic Groq text call failed: %s", e)
            
    if GEMINI_API_KEY:
        try:
            url = f"{GEMINI_BASE_URL}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.5, "maxOutputTokens": 1024}}
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            logger.error("Generic Gemini text call failed: %s", e)
            
    return ""


async def get_ai_provider_status() -> dict:
    """Check which AI providers are configured."""
    return {
        "openai": {"configured": bool(OPENAI_API_KEY), "model": OPENAI_MODEL},
        "groq": {"configured": bool(GROQ_API_KEY), "primary_model": GROQ_PRIMARY_MODEL, "fallback_model": GROQ_FALLBACK_MODEL},
        "gemini": {"configured": bool(GEMINI_API_KEY), "model": GEMINI_MODEL},
        "call_delay_seconds": CALL_DELAY_SECONDS,
    }
