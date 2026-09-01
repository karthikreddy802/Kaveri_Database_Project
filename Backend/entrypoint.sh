#!/bin/sh
set -e
python manage.py migrate --noinput || true
python ensure_schema.py
python seed_properties.py || true
python seed_accounts.py || true
exec uvicorn main:app --host 0.0.0.0 --port 8000
