#!/usr/bin/env bash
set -e

# PRD Generator -- start both backend and frontend
# Usage: ./run.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Starting Backend (FastAPI + LangGraph) on :8000"
(
  cd "$ROOT"
  source .venv/bin/activate
  uvicorn backend.api.server:app --reload --host 0.0.0.0 --port 8000 &
)

echo "==> Starting Frontend (Next.js) on :3000"
(
  cd "$ROOT/frontend"
  npm run dev &
)

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both."

# Wait for background processes
wait
