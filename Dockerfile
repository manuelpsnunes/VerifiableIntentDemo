# Single-container build for the Verifiable Intent demo.
# Stage 1 builds the Vite frontend; stage 2 runs FastAPI, which serves both the
# /api/* routes and the built frontend from one origin. Targets Hugging Face
# Spaces (Docker SDK, port 7860) but runs anywhere Docker does.

# ---- Stage 1: build the frontend ----
FROM node:22-slim AS frontend
WORKDIR /build
# Install deps first (cached unless the lockfile changes).
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
# Then build.
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + static assets ----
FROM python:3.11-slim

# git is required to install the verifiable-intent SDK (a git dependency).
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces runs containers as uid 1000; create a matching non-root user.
RUN useradd -m -u 1000 user
WORKDIR /app

# Install the backend editably so KEYS_DIR resolves to a writable app path
# (per-role ES256 PEMs are generated on first run).
COPY backend/ ./backend/
RUN pip install --no-cache-dir -e ./backend

# Drop the built frontend where main.py looks for it.
COPY --from=frontend /build/dist ./frontend/dist
ENV FRONTEND_DIST=/app/frontend/dist

# Make runtime-writable dirs owned by the unprivileged user.
RUN mkdir -p /app/backend/keys && chown -R user:user /app
USER user

# HF Spaces expects the app on 7860; PORT is overridable for other hosts.
ENV PORT=7860
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
