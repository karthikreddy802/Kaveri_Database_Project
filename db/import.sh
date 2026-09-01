#!/bin/sh
# Load db/kaveri.sql into Docker Postgres when the account table is empty.
set -e
DUMP=/dump/kaveri.sql
export PGPASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD:-2004}}"
USER="${POSTGRES_USER:-${DB_USER:-postgres}}"
DB="${POSTGRES_DB:-${DB_NAME:-kaveri}}"
HOST="${PGHOST:-db}"

i=0
while [ "$i" -lt 30 ]; do
  if pg_isready -h "$HOST" -U "$USER" -d "$DB" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ ! -f "$DUMP" ]; then
  echo "db-import: no db/kaveri.sql found — skipping (demo seed will create owner)."
  exit 0
fi

COUNT=$(psql -h "$HOST" -U "$USER" -d "$DB" -tAc "SELECT COUNT(*) FROM account" 2>/dev/null || echo 0)
COUNT=$(echo "$COUNT" | tr -d ' ')
if [ -n "$COUNT" ] && [ "$COUNT" != "0" ]; then
  echo "db-import: account table already has $COUNT rows — skip dump."
  exit 0
fi

echo "db-import: loading $DUMP into $DB ..."
psql -h "$HOST" -U "$USER" -d "$DB" -v ON_ERROR_STOP=0 -f "$DUMP" || true
echo "db-import: done."
exit 0
