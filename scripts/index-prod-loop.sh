#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d "${HOME}/.nvm/versions/node" ]]; then
  n22=$(ls -d "${HOME}/.nvm/versions/node"/v22* 2>/dev/null | sort -V | tail -1 || true)
  if [[ -n "${n22}" ]]; then
    export PATH="${n22}/bin:${PATH}"
  fi
fi
node_major=$(node -p "Number(process.versions.node.split('.')[0])")
if [[ "$node_major" -lt 18 ]]; then
  echo "need Node 18+ for fetch (have $(node -v))" >&2
  exit 1
fi
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
  echo "prod tick vol24h $(date -u +%Y-%m-%dT%H:%M:%SZ) node=$(node -v)"
  node --import tsx indexer/run.ts --vol24h
  echo "prod tick once $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  node --import tsx indexer/run.ts --once
  echo "prod tick sleep ${sleep_s}s"
  sleep "$sleep_s"
done
