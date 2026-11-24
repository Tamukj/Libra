# Multi-stage hardened Dockerfile for GaitAI Python Backend
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Final runtime image
FROM python:3.12-slim

WORKDIR /app

# Non-root user for security
RUN groupadd -r gaitai && useradd -r -g gaitai gaitai

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY src /app/src
COPY gait-cp-dataset /app/gait-cp-dataset
COPY locales /app/locales

# Create writable tmpfs and db directory
RUN mkdir -p /app/data && chown -R gaitai:gaitai /app

USER gaitai

ENV PYTHONUNBUFFERED=1 \
    DATABASE_URL="sqlite:////app/data/gaitai.db"

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=3s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
