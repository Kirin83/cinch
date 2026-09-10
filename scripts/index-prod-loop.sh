#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be the Neon unpooled URL (not localhost)." >&2
  exit 1
fi
if [[ "$DATABASE_URL" == *"localhost"* ]]; then
  echo "refusing localhost DATABASE_URL — this tick is for production Neon." >&2
  exit 1
fi
export PGSSL="${PGSSL:-1}"
export INDEXER_VOL24H_CANONICAL="${INDEXER_VOL24H_CANONICAL:-1}"
export INDEXER_CATCHUP_MS="${INDEXER_CATCHUP_MS:-90000}"
sleep_s="${INDEXER_SLEEP_SECONDS:-1800}"
while true; do
  echo "prod tick vol24h $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  npx tsx indexer/run.ts --vol24h
  echo "prod tick once $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  npx tsx indexer/run.ts --once
  echo "prod tick sleep ${sleep_s}s"
  sleep "$sleep_s"
done
