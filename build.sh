#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Building frontend static export..."
cd "$ROOT/frontend"

# Build with empty API base so it uses relative URLs (same-origin)
NEXT_PUBLIC_API_URL="" npm run build

echo "==> Copying static files into goodboi package..."
rm -rf "$ROOT/backend/goodboi/static"
cp -r "$ROOT/frontend/out" "$ROOT/backend/goodboi/static"

echo "==> Installing goodboi package..."
cd "$ROOT/backend"
pip install -e . -q

echo ""
echo "  Done! You can now run:"
echo "    goodboi init    # in any project"
echo "    goodboi start"
echo ""
