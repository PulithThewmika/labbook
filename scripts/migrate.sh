#!/usr/bin/env bash
# Applies db/migrations/*.sql in name order to $DATABASE_URL. Safe to re-run.
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
cd "$(dirname "$0")/.."
for f in db/migrations/*.sql; do
  echo "applying $f"
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
  else
    docker compose exec -T db psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q < "$f"
  fi
done
echo "migrations applied"
