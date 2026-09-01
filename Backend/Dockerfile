# Kaveri Stays API — Python 3.12 + virtualenv inside the image
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=Kaveri.settings \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Isolated Python environment (same role as a local venv)
RUN python -m venv /opt/venv \
    && pip install --upgrade pip

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY Kaveri/ .
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
