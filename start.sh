#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "${MUNDIAL_ERP_API_KEY:-}" ]; then
  echo "ERRO: MUNDIAL_ERP_API_KEY nao definido. Configure no .env ou exporte antes." >&2
  exit 1
fi

exec node dist/index.js --stdio
