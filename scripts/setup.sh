#!/bin/bash
# Setup: clona el motor PacioliDB (pinneado) e instala todo.
# Uso: PACIOLIDB_REF=main bash scripts/setup.sh  |  ENGINE_DIR=/ruta/cljedger bash scripts/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${PACIOLIDB_REF:-c983beea2b3e0b27ab9b0b6e577e803e8fa1c9c1}"

if [ -n "${ENGINE_DIR:-}" ]; then
  echo "usando motor local: $ENGINE_DIR"
  rm -rf engine && ln -s "$ENGINE_DIR" engine
elif [ ! -d engine ]; then
  echo "clonando openbancor/cljedger@$REF ..."
  git clone --quiet https://github.com/openbancor/cljedger.git engine
  (cd engine && git checkout --quiet "$REF")
else
  echo "motor ya presente en ./engine"
fi

echo "instalando deps del demo..."
npm install --no-audit --no-fund
echo "instalando deps del motor..."
(cd engine && npm install --no-audit --no-fund)
[ -f .dev.vars ] || cp .dev.vars.example .dev.vars
echo "OK. Siguiente: npm run dev  (local)  |  npm run deploy  (cloudflare)"
