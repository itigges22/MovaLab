#!/bin/bash
# MovaLab First-Time Setup Script
# Sets up everything needed to run MovaLab locally with Docker

# Detect Windows/Git Bash
IS_WINDOWS=false
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" || "$OSTYPE" == "cygwin" ]]; then
  IS_WINDOWS=true
fi

# Colors (disabled if not a TTY)
if [ -t 1 ]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

ok()   { printf "${GREEN}[OK]${NC} %s\n" "$1"; }
err()  { printf "${RED}[ERROR]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$1"; }
info() { printf "${BLUE}[INFO]${NC} %s\n" "$1"; }
header() { echo ""; printf "${BLUE}== %s ==${NC}\n" "$1"; echo ""; }

fail() {
  err "$1"
  if [ "$IS_WINDOWS" = true ]; then
    echo ""; read -p "Press Enter to close..."
  fi
  exit 1
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

# ============================================================
header "MovaLab Setup"
echo "This will set up your local development environment."

# ============================================================
header "Step 1: Prerequisites"

# Node.js
command_exists node || fail "Node.js is not installed. Get it from https://nodejs.org/"
NODE_VERSION=$(node --version 2>/dev/null)
NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
[ "$NODE_MAJOR" -ge 18 ] 2>/dev/null || fail "Node.js 18+ required (you have $NODE_VERSION)"
ok "Node.js $NODE_VERSION"

# npm
command_exists npm || fail "npm is not installed"
ok "npm $(npm --version 2>/dev/null)"

# Docker
command_exists docker || fail "Docker is not installed. Get it from https://docker.com/products/docker-desktop"
ok "Docker installed"

# Start Docker if not running
if ! docker info >/dev/null 2>&1; then
  warn "Docker not running — starting Docker Desktop..."
  if [ "$IS_WINDOWS" = true ]; then
    if [ -f "/c/Program Files/Docker/Docker/Docker Desktop.exe" ]; then
      "/c/Program Files/Docker/Docker/Docker Desktop.exe" &
    else
      cmd.exe /c "start \"\" \"Docker Desktop\"" 2>/dev/null || true
    fi
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    open -a "Docker" 2>/dev/null || true
  else
    sudo systemctl start docker 2>/dev/null || true
  fi

  info "Waiting for Docker (up to 60s)..."
  for i in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null 2>&1 || fail "Could not start Docker. Please start Docker Desktop manually."
fi
ok "Docker running"

# ============================================================
header "Step 2: Install Dependencies"

[ -f "package.json" ] || fail "package.json not found — are you in the movalab directory?"
info "Running npm install..."
npm install 2>/dev/null || fail "npm install failed"
ok "Dependencies installed"

npx supabase --version >/dev/null 2>&1 || fail "Supabase CLI not found after npm install"
ok "Supabase CLI ready"

# ============================================================
header "Step 3: Environment"

if [ ! -f ".env.local" ]; then
  [ -f ".env.local.template" ] || fail ".env.local.template not found"
  cp .env.local.template .env.local
  ok "Created .env.local from template"
else
  ok ".env.local already exists"
fi

# ============================================================
header "Step 4: Start Supabase"

# Clean up any stale containers first
info "Stopping any existing Supabase containers..."
npx supabase stop --no-backup 2>/dev/null || true

# Remove stale containers that block startup
STALE_CONTAINERS=$(docker ps -a --filter "name=supabase_" --format "{{.Names}}" 2>/dev/null)
if [ -n "$STALE_CONTAINERS" ]; then
  warn "Removing stale Supabase containers..."
  docker rm -f $STALE_CONTAINERS 2>/dev/null || true
  ok "Stale containers removed"
fi

info "Starting Supabase (this may take 1-2 minutes on first run)..."
if ! npx supabase start 2>&1; then
  warn "Start failed — cleaning up and retrying..."
  # Nuclear cleanup
  docker ps -a --filter "name=supabase_" --format "{{.ID}}" | xargs -r docker rm -f 2>/dev/null || true
  sleep 3
  npx supabase start 2>&1 || fail "Supabase failed to start. Check Docker Desktop is running and ports 54321-54326 are free."
fi
ok "Supabase started"

# Wait for API
info "Waiting for API..."
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "" http://127.0.0.1:54321/rest/v1/ 2>/dev/null && break
  sleep 2
done
curl -s -o /dev/null http://127.0.0.1:54321/rest/v1/ 2>/dev/null || fail "Supabase API not responding"
ok "API ready at http://127.0.0.1:54321"

# ============================================================
header "Step 5: Reset Database"

info "Applying migrations and seed data..."
npx supabase db reset 2>&1 | grep -v "^NOTICE" || true
ok "Database ready"

# ============================================================
header "Step 6: Create Test Users"

info "Creating test users and sample data..."
npx tsx scripts/create-seed-users.ts 2>&1
ok "Seed data loaded"

# ============================================================
header "Setup Complete!"

echo ""
echo "Start the app:"
printf "  ${GREEN}npm run dev${NC}\n"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "Login with any test user (password: Test1234!):"
printf "  ${YELLOW}superadmin@test.local${NC}  - Full admin access\n"
printf "  ${YELLOW}manager@test.local${NC}     - Account Manager\n"
printf "  ${YELLOW}designer@test.local${NC}    - Designer\n"
printf "  ${YELLOW}dev@test.local${NC}         - Developer\n"
printf "  ${YELLOW}client@test.local${NC}      - Client portal\n"
echo ""
echo "Supabase Studio: http://localhost:54323"
echo ""

if [ "$IS_WINDOWS" = true ]; then
  read -p "Press Enter to close..."
fi
# Updated Thu Mar 19 20:41:01 EDT 2026
