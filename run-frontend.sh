#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "  Frontend starting on http://localhost:3000"
echo "  Press Ctrl+C to stop."
echo ""

cd "$ROOT/frontend"
npm run dev
