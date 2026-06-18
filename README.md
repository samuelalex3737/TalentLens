---
title: TalentLens
emoji: 🔍
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: true
license: mit
---

# 🔍 TalentLens — See Beyond the Resume

**AI-Powered Resume Screening & Candidate Ranking System**

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green?logo=fastapi)
![React](https://img.shields.io/badge/React-18-blue?logo=react)
![Tailwind](https://img.shields.io/badge/TailwindCSS-4-blue?logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Overview

TalentLens is an intelligent HR tool that automates resume screening using a dual AI scoring engine. It combines traditional NLP techniques (TF-IDF + Cosine Similarity) with modern LLM semantic analysis (Groq/Gemini) to provide accurate, explainable candidate rankings.

### Key Features

- **Dual AI Scoring Engine** — TF-IDF baseline + LLM semantic analysis
- **Smart PDF Parsing** — PyMuPDF primary + pdfplumber fallback
- **Skill Gap Reports** — Per-candidate matched, missing, and transferable skills
- **Score Conflict Detection** — Flags candidates where scoring methods disagree
- **Interactive Dashboard** — Ranked cards, bar charts, radar plots
- **CSV Export** — One-click download of ranked results
- **Session History** — Review and compare past analyses
- **Multi-Provider Fallback** — Groq → Gemini automatic failover

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Nginx (port 7860)                  │
│         ┌─────────────┬──────────────────┐           │
│         │  React SPA  │  /api/* proxy    │           │
│         │  (static)   │  → Uvicorn:8000  │           │
│         └─────────────┴──────────────────┘           │
│                           │                          │
│         ┌─────────────────▼──────────────────┐       │
│         │        FastAPI Backend              │       │
│         │  ┌──────────┬───────────────────┐  │       │
│         │  │ PDF      │ NLP Processor     │  │       │
│         │  │ Parser   │ (spaCy skills)    │  │       │
│         │  ├──────────┼───────────────────┤  │       │
│         │  │ TF-IDF   │ AI Scorer         │  │       │
│         │  │ Scorer   │ (Groq → Gemini)   │  │       │
│         │  ├──────────┴───────────────────┤  │       │
│         │  │       Ranker (35/65 blend)   │  │       │
│         │  └──────────────────────────────┘  │       │
│         │         SQLite Database             │       │
│         └────────────────────────────────────┘       │
└──────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Frontend  | React 18, Vite, Tailwind CSS, Framer Motion   |
| Charts    | Recharts (Bar + Radar)                        |
| Backend   | FastAPI, SQLAlchemy, SQLite                   |
| PDF       | PyMuPDF + pdfplumber                          |
| NLP       | spaCy (en_core_web_lg)                        |
| ML        | scikit-learn TF-IDF + Cosine Similarity       |
| AI        | Groq (Llama 3.3 70B) + Gemini 2.5 Flash      |
| Deploy    | Docker, Nginx, Supervisor, HF Spaces          |

---

## Sample Job Description

```
Senior Python Developer

Requirements:
- 5+ years Python experience
- FastAPI or Django expertise
- Machine learning / NLP knowledge
- PostgreSQL and Redis
- Docker and Kubernetes
- CI/CD pipelines (GitHub Actions)
- Strong communication and teamwork skills
```

---

## Run Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Groq API key and/or Gemini API key

### Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the frontend proxies API calls to the backend.

---

## API Documentation

With the backend running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

---

## Environment Variables

| Variable       | Required | Description                    |
|----------------|----------|--------------------------------|
| GROQ_API_KEY   | Yes*     | Groq API key for LLM scoring  |
| GEMINI_API_KEY  | Yes*     | Google Gemini API key (fallback)|
| AI_CALL_DELAY  | No       | Delay between AI calls (default: 1.5s) |
| DATABASE_URL   | No       | SQLite URL (default: local file) |

*At least one AI provider key is required.

---

## License

MIT License — see LICENSE file for details.

---

**Built with ❤️ as an AI Internship Capstone Project**
