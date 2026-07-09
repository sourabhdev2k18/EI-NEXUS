# EI-Nexus — production container image
# Multi-stage not needed: this is a pure-Python app with no build step.

FROM python:3.12-slim

# Keep image lean and avoid interactive prompts
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Cloud Run / App Runner / Container Apps all expect the container to listen
# on the port given by $PORT (defaulting to 8000 to match local dev).
ENV PORT=8000
EXPOSE 8000

# Basic container-level health check (most platforms also do their own,
# but this makes `docker ps` and local compose runs self-diagnosing too)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,os; urllib.request.urlopen('http://localhost:' + os.environ.get('PORT','8000') + '/api/fleet', timeout=3)" || exit 1

CMD ["python", "run.py"]
