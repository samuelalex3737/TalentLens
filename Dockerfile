# ──────────────────────────────────────────────────────────────
# TalentLens — Single-Container Deployment
# Serves React frontend via Nginx + FastAPI backend via Uvicorn
# ──────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# Install system dependencies + Node.js 18
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg nginx supervisor && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Build React Frontend ──────────────────────────────────────
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci --production=false

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ── Install Python Dependencies ──────────────────────────────
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt && \
    python -m spacy download en_core_web_sm

# ── Copy Backend Code ────────────────────────────────────────
COPY backend/ ./backend/

# ── Copy React build to static serving directory ─────────────
RUN mkdir -p /app/backend/static && \
    cp -r /app/frontend/dist/* /app/backend/static/

# ── Nginx Configuration ─────────────────────────────────────
RUN rm /etc/nginx/sites-enabled/default
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ── Supervisor Configuration ─────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ── Create data directory ────────────────────────────────────
RUN mkdir -p /app/backend/data

EXPOSE 7860

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
