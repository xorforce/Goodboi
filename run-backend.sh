#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

source "$ROOT/.venv/bin/activate"

echo "  Backend starting on http://localhost:8000"
echo "  Press Ctrl+C to stop."
echo ""

uvicorn backend.api.server:app \
  --reload \
  --host 0.0.0.0 \
  --port 8000 \
  --log-level info
