#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Colors ───────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

step()  { echo -e "\n${CYAN}==>${RESET} ${BOLD}$1${RESET}"; }
ok()    { echo -e "    ${GREEN}✔${RESET} $1"; }
warn()  { echo -e "    ${YELLOW}!${RESET} $1"; }
fail()  { echo -e "    ${RED}✘${RESET} $1"; exit 1; }

echo -e "${BOLD}"
echo "  ┌──────────────────────────────────────┐"
echo "  │       PRD Generator — First Setup     │"
echo "  └──────────────────────────────────────┘"
echo -e "${RESET}"

# ── 1. Check prerequisites ──────────────────────────────────────────────
step "Checking prerequisites"

# Python
if command -v python3 &>/dev/null; then
  PY_VERSION=$(python3 --version 2>&1)
  ok "python3 found ($PY_VERSION)"
else
  fail "python3 is not installed. Install Python 3.9+ first."
fi

# Node / npm
if command -v node &>/dev/null; then
  NODE_VERSION=$(node --version 2>&1)
  ok "node found ($NODE_VERSION)"
else
  fail "node is not installed. Install Node.js 18+ first."
fi

if command -v npm &>/dev/null; then
  NPM_VERSION=$(npm --version 2>&1)
  ok "npm found (v$NPM_VERSION)"
else
  fail "npm is not installed."
fi

# ── 2. Python virtual environment ───────────────────────────────────────
step "Setting up Python virtual environment"

if [ -d "$ROOT/.venv" ]; then
  warn "Virtual environment already exists at .venv — reusing it"
else
  python3 -m venv "$ROOT/.venv"
  ok "Created virtual environment at .venv"
fi

source "$ROOT/.venv/bin/activate"
ok "Activated virtual environment"

# ── 3. Install Python dependencies ──────────────────────────────────────
step "Installing Python dependencies"

pip install --upgrade pip -q 2>/dev/null || true
pip install -r "$ROOT/backend/requirements.txt" -q
ok "All Python packages installed"

# ── 4. Install Node dependencies ────────────────────────────────────────
step "Installing Node dependencies"

cd "$ROOT/frontend"
npm install --silent 2>/dev/null
ok "All Node packages installed"
cd "$ROOT"

# ── 5. Configure environment files ──────────────────────────────────────
step "Configuring environment files"

# Backend .env
if [ -f "$ROOT/backend/.env" ]; then
  # Check if the key is still the placeholder
  if grep -q "your-openai-api-key-here" "$ROOT/backend/.env"; then
    NEEDS_KEY=true
  else
    ok "backend/.env already configured"
    NEEDS_KEY=false
  fi
else
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  NEEDS_KEY=true
fi

if [ "$NEEDS_KEY" = true ]; then
  echo ""
  echo -e "    ${YELLOW}An OpenAI API key is required for the LLM agents.${RESET}"
  echo -e "    Get one at: ${CYAN}https://platform.openai.com/api-keys${RESET}"
  echo ""
  read -rp "    Enter your OpenAI API key (or press Enter to skip): " API_KEY

  if [ -n "$API_KEY" ]; then
    # Write the key, replacing the placeholder
    sed -i.bak "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$API_KEY|" "$ROOT/backend/.env"
    rm -f "$ROOT/backend/.env.bak"
    ok "Saved API key to backend/.env"
  else
    warn "Skipped — set OPENAI_API_KEY in backend/.env before running"
  fi
fi

# Frontend .env.local
if [ ! -f "$ROOT/frontend/.env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > "$ROOT/frontend/.env.local"
  ok "Created frontend/.env.local"
else
  ok "frontend/.env.local already exists"
fi

# ── 6. Verify everything works ──────────────────────────────────────────
step "Verifying setup"

# Check Python imports
source "$ROOT/.venv/bin/activate"
if python3 -c "from backend.agents.orchestrator import chat, generate_prd" 2>/dev/null; then
  ok "Backend Python imports OK"
else
  fail "Backend import check failed — check requirements install above"
fi

# Check Next.js build
cd "$ROOT/frontend"
if npx next build --no-lint 2>/dev/null | grep -q "Compiled successfully\|Generating static pages"; then
  ok "Frontend builds successfully"
else
  # Non-fatal — dev mode will still work
  warn "Frontend production build had warnings (dev mode should still work)"
fi
cd "$ROOT"

# ── Done ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  Setup complete!${RESET}"
echo ""
echo "  To start the app:"
echo ""
echo -e "    ${CYAN}./run.sh${RESET}"
echo ""
echo "  This launches:"
echo "    Backend  → http://localhost:8000"
echo "    Frontend → http://localhost:3000"
echo ""

if [ "$NEEDS_KEY" = true ] && [ -z "$API_KEY" ]; then
  echo -e "  ${YELLOW}Remember: set your OPENAI_API_KEY in backend/.env first!${RESET}"
  echo ""
fi
