#!/bin/sh
set -e
python manage.py migrate --noinput || true
python seed_properties.py || true
exec uvicorn main:app --host 0.0.0.0 --port 8000
