"""
TalentLens - Resume Parser Module (Enhanced)

Extracts rich structured data from PDF resumes:
  - Full text extraction (PyMuPDF + pdfplumber fallback)
  - Contact: name, email, phone, LinkedIn, GitHub, portfolio
  - Sections: education, experience, certifications, languages
"""

import re
import io
import logging
from typing import Optional

import fitz  # PyMuPDF
import pdfplumber

logger = logging.getLogger(__name__)


def parse_resume(file_bytes: bytes, filename: str = "resume.pdf") -> dict:
    """
    Parse a PDF resume and return rich extracted content.

    Args:
        file_bytes: Raw bytes of the uploaded PDF file.
        filename: Original filename for logging.

    Returns:
        dict with raw_text, candidate_name, email, phone, linkedin,
        github, portfolio, education, experience, certifications,
        languages, page_count, parser_used.
    """
    raw_text = ""
    parser_used = ""
    page_count = 0

    # Attempt 1: PyMuPDF
    try:
        raw_text, page_count = _extract_with_pymupdf(file_bytes)
        parser_used = "pymupdf"
        logger.info("PyMuPDF: %d chars from '%s'", len(raw_text), filename)
    except Exception as exc:
        logger.warning("PyMuPDF failed on '%s': %s", filename, exc)

    # Attempt 2: pdfplumber fallback
    if not raw_text.strip():
        try:
            raw_text, page_count = _extract_with_pdfplumber(file_bytes)
            parser_used = "pdfplumber"
            logger.info("pdfplumber: %d chars from '%s'", len(raw_text), filename)
        except Exception as exc:
            logger.error("pdfplumber also failed on '%s': %s", filename, exc)
            raise ValueError(
                f"Could not extract text from '{filename}'. "
                "Ensure the file is a valid, text-based PDF."
            ) from exc

    if not raw_text.strip():
        raise ValueError(f"No readable text found in '{filename}'.")

    # Extract all structured data
    return {
        "raw_text": raw_text.strip(),
        "candidate_name": _extract_name(raw_text),
        "email": _extract_email(raw_text),
        "phone": _extract_phone(raw_text),
        "linkedin": _extract_linkedin(raw_text),
        "github": _extract_github(raw_text),
        "portfolio": _extract_portfolio(raw_text),
        "education": _extract_education(raw_text),
        "experience": _extract_experience(raw_text),
        "projects": _extract_projects(raw_text),
        "certifications": _extract_certifications(raw_text),
        "languages": _extract_languages(raw_text),
        "page_count": page_count,
        "parser_used": parser_used,
    }


def is_likely_resume(extracted_text: str) -> bool:
    """
    Lightweight check to determine if extracted PDF text looks like a resume.
    Returns False for calendars, invoices, random documents, etc.
    """
    text_lower = extracted_text.lower()
    resume_indicators = [
        'experience', 'education', 'skills',
        'work history', 'employment', 'objective',
        'summary', 'qualifications', 'certifications',
        'projects', 'references', 'contact',
        'university', 'degree', 'bachelor',
        'master', 'gpa', 'internship', 'volunteer',
        'responsibilities', 'achievements'
    ]
    indicator_count = sum(
        1 for word in resume_indicators
        if word in text_lower
    )
    has_enough_indicators = indicator_count >= 3
    has_reasonable_length = len(extracted_text.strip()) >= 100
    return has_enough_indicators and has_reasonable_length


def _extract_with_pymupdf(file_bytes: bytes) -> tuple[str, int]:
    """Extract text using PyMuPDF (fitz)."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = [page.get_text("text") for page in doc]
    count = len(doc)
    doc.close()
    return "\n".join(pages), count


def _extract_with_pdfplumber(file_bytes: bytes) -> tuple[str, int]:
    """Extract text using pdfplumber."""
    pages = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        count = len(pdf.pages)
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
    return "\n".join(pages), count


def _extract_name(text: str) -> Optional[str]:
    """Heuristic: first proper-name-looking line in top 15 lines."""
    skip = {
        "resume", "curriculum", "vitae", "cv", "portfolio", "objective",
        "summary", "experience", "education", "contact", "phone", "email",
        "address", "linkedin", "github", "references", "skills", "profile",
    }
    for line in text.split("\n")[:15]:
        line = line.strip()
        if not line or len(line) < 3 or len(line) > 60:
            continue
        if re.search(r"[\d@]|http|www\.", line, re.IGNORECASE):
            continue
        if line.lower().strip(":").strip() in skip:
            continue
        words = line.split()
        if 1 <= len(words) <= 4 and all(
            w.replace(".", "").replace("-", "").replace("'", "").isalpha()
            for w in words
        ):
            return line.title()
    return None


def _extract_email(text: str) -> Optional[str]:
    """Extract the first email address."""
    m = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    return m.group(0) if m else None


def _extract_phone(text: str) -> Optional[str]:
    """Extract the first phone number (7+ digits)."""
    m = re.search(
        r"[\+]?[(]?[0-9]{1,4}[)]?[\s.\-]?[0-9]{2,4}[\s.\-]?[0-9]{3,4}[\s.\-]?[0-9]{0,4}",
        text,
    )
    if m:
        phone = m.group(0).strip()
        if len(re.sub(r"\D", "", phone)) >= 7:
            return phone
    return None


def _extract_linkedin(text: str) -> Optional[str]:
    """Extract LinkedIn profile URL."""
    m = re.search(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9\-_%]+/?", text, re.IGNORECASE)
    if m:
        url = m.group(0)
        if not url.startswith("http"):
            url = "https://" + url
        return url
    return None


def _extract_github(text: str) -> Optional[str]:
    """Extract GitHub profile URL."""
    m = re.search(r"(?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9\-_]+/?", text, re.IGNORECASE)
    if m:
        url = m.group(0)
        if not url.startswith("http"):
            url = "https://" + url
        return url
    return None


def _extract_portfolio(text: str) -> Optional[str]:
    """Extract portfolio/personal website URL (not LinkedIn/GitHub)."""
    urls = re.findall(r"https?://[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[/\w\-]*", text)
    for url in urls:
        lower = url.lower()
        if "linkedin.com" in lower or "github.com" in lower:
            continue
        if any(x in lower for x in ["kaggle", "medium", "dev.to", "portfolio", "behance"]):
            return url
        # Return first non-social URL as portfolio
        if not any(x in lower for x in ["google.com", "facebook.com", "twitter.com", "instagram.com"]):
            return url
    return None


# Master list of section headers to act as stoppers for parsing sections.
ALL_HEADERS_RE = re.compile(
    r"^\s*(education|academic|qualification|experience|work\s*history|employment|"
    r"professional\s*experience|skills|soft\s*skills|hard\s*skills|project|"
    r"certification|reference|language|interest|hobby|award|publication|"
    r"profile|summary|objective|activities)\b", re.IGNORECASE
)

# Stop headers for the Projects section (exclude "project" so entries like "Project: X" aren't treated as headers)
PROJECT_STOP_HEADERS_RE = re.compile(
    r"^\s*(education|academic|qualification|experience|work\s*history|employment|"
    r"professional\s*experience|skills|soft\s*skills|hard\s*skills|"
    r"certification|reference|language|interest|hobby|award|publication|"
    r"profile|summary|objective|activities)\b", re.IGNORECASE
)

def _extract_education(text: str) -> list[str]:
    """Extract education entries from resume text."""
    education = []
    lines = text.split("\n")
    in_edu = False

    section_headers = re.compile(r"^\s*(education|academic|qualification)\b", re.IGNORECASE)

    for line in lines:
        stripped = line.strip().lstrip('•-* ')
        if not stripped:
            continue
        if section_headers.match(stripped):
            in_edu = True
            continue
        if in_edu and ALL_HEADERS_RE.match(stripped):
            in_edu = False
            continue
        
        # When inside education block, append any reasonable line.
        if in_edu and len(stripped) > 5:
            # Avoid appending just dates or simple lines if they are attached to something.
            # We just append everything inside the block.
            education.append(stripped)
        
        # Also catch degrees outside of standard education blocks if any.
        elif not in_edu and re.search(r"\b(B\.?S\.?c?|B\.?A\.?|M\.?S\.?c?|M\.?A\.?|M\.?B\.?A\.?|Ph\.?D\.?|Bachelor|Master|Doctor|Diploma|Associate|Certificate)\b", stripped, re.IGNORECASE) and len(stripped) > 10:
             # Make sure it's not a certification line
             if not re.search(r"\b(certified|certification)\b", stripped, re.IGNORECASE):
                 education.append(stripped)

    # Clean up and combine lines that look like they belong together.
    # Often '2025 - Present' is on its own line. We don't want to just return '2025 - Present'.
    return [e for e in education if not re.match(r"^(completed|ongoing|\d{4}\s*-\s*(present|current|\d{4})|grade\s*\d+)$", e, re.IGNORECASE)][:8]


def _extract_experience(text: str) -> list[str]:
    """Extract work experience entries with expanded section header matching."""
    experience = []
    lines = text.split("\n")
    in_exp = False

    # Expanded regex to catch more variations of experience section headers
    section_headers = re.compile(
        r"^\s*(experience|work\s*history|employment|professional\s*experience|"
        r"career\s*history|work\s*experience|job\s*history|career|professional\s*background|"
        r"work\s*background|position|role)\b",
        re.IGNORECASE
    )

    for line in lines:
        stripped = line.strip().lstrip('•-* ')
        if not stripped:
            continue
        if section_headers.match(stripped):
            in_exp = True
            logger.debug("Entered experience section: %s", stripped[:50])
            continue
        if in_exp and ALL_HEADERS_RE.match(stripped):
            in_exp = False
            logger.debug("Exited experience section at: %s", stripped[:50])
            continue
        if in_exp and len(stripped) > 5:
            experience.append(stripped)
            logger.debug("Added experience entry: %s", stripped[:60])

    logger.info("Extracted %d work experience entries", len(experience))
    return experience[:12]


def _extract_projects(text: str) -> list[str]:
    """Extract projects entries."""
    projects = []
    lines = text.split("\n")
    in_proj = False

    section_headers = re.compile(
        r"^\s*(projects?|personal\s*projects?|academic\s*projects?|project\s*work|portfolio)\b",
        re.IGNORECASE,
    )

    for line in lines:
        stripped = line.strip().lstrip('•-* ')
        if not stripped:
            continue
        if section_headers.match(stripped):
            in_proj = True
            continue
        if in_proj and PROJECT_STOP_HEADERS_RE.match(stripped):
            in_proj = False
            continue
        if in_proj and len(stripped) > 5:
            projects.append(stripped)

    return projects[:8]


def _extract_certifications(text: str) -> list[str]:
    """Extract certifications from resume text."""
    certs = []
    lines = text.split("\n")
    in_cert = False

    cert_re = re.compile(
        r"\b(certified|certification|certificate|license|accreditation|"
        r"AWS|Azure|GCP|PMP|CISSP|CompTIA|Scrum|CPA|CFA|"
        r"Google Cloud|Oracle|Cisco|CCNA|CCNP)\b",
        re.IGNORECASE,
    )

    section_headers = re.compile(r"^\s*(certification|license|accreditation|credential)\b", re.IGNORECASE)

    for line in lines:
        stripped = line.lstrip('•-* ').strip()
        if not stripped:
            continue
        
        # Check if we hit ANY section header (including "SOFT SKILLS & INTERESTS")
        if section_headers.match(stripped):
            in_cert = True
            continue
        if in_cert and ALL_HEADERS_RE.match(stripped):
            in_cert = False
            continue
            
        if in_cert and len(stripped) > 5:
            # Avoid picking up publication IDs if they leak
            if not re.search(r"Volume\s+[XVI]+|ISSN:", stripped, re.IGNORECASE):
                certs.append(stripped)
        elif not in_cert and cert_re.search(stripped) and 5 < len(stripped) < 250:
             if not re.search(r"Volume\s+[XVI]+|ISSN:", stripped, re.IGNORECASE):
                 certs.append(stripped)

    # Deduplicate
    seen = set()
    unique = []
    for c in certs:
        cl = c.lower().strip()
        if cl not in seen:
            seen.add(cl)
            unique.append(c)
    return unique[:10]


def _extract_languages(text: str) -> list[str]:
    """Extract spoken languages from resume text."""
    known_languages = [
        "English", "Spanish", "French", "German", "Chinese", "Mandarin",
        "Japanese", "Korean", "Arabic", "Hindi", "Portuguese", "Russian",
        "Italian", "Dutch", "Swedish", "Turkish", "Polish", "Vietnamese",
        "Thai", "Indonesian", "Malay", "Tagalog", "Swahili", "Urdu",
        "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Kannada",
        "Amharic", "Tigrinya", "Oromo",
    ]
    found = []
    text_lower = text.lower()
    for lang in known_languages:
        if lang.lower() in text_lower:
            found.append(lang)
    return found
