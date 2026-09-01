#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "Waiting for Postgres at ${DB_HOST}:${DB_PORT} ..."
python -c "
import os, socket, time, sys
host = os.environ.get('DB_HOST', 'db')
port = int(os.environ.get('DB_PORT', '5432'))
for i in range(60):
    try:
        s = socket.create_connection((host, port), 2)
        s.close()
        print('Postgres is reachable.')
        sys.exit(0)
    except OSError:
        time.sleep(1)
print('Postgres did not become reachable in time.', file=sys.stderr)
sys.exit(1)
"

python manage.py migrate --noinput || true
python ensure_schema.py || true
python seed_properties.py || true
python seed_accounts.py || true

exec uvicorn main:app --host 0.0.0.0 --port 8000
