#!/usr/bin/env bash
set -e

# PRD Generator -- start both backend and frontend
# For separate logs, run these in two terminals instead:
#   ./run-backend.sh
#   ./run-frontend.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "  Starting Backend (FastAPI + LangGraph) on :8000"
"$ROOT/run-backend.sh" &
BACK_PID=$!

echo "  Starting Frontend (Next.js) on :3000"
"$ROOT/run-frontend.sh" &
FRONT_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo ""
echo "  For separate logs, run in two terminals:"
echo "    ./run-backend.sh"
echo "    ./run-frontend.sh"
echo ""
echo "  Press Ctrl+C to stop both."

trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT INT TERM
wait
