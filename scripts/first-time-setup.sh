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

# Note: supabase start already ran migrations + seed.sql
# No need for a separate db reset — that would double-run everything

# ============================================================
header "Step 5: Configure Environment Keys"

# Read actual keys from running Supabase instance and update .env.local
info "Reading Supabase keys from running instance..."

# Detect public IP for Supabase URL (so browsers can reach it)
# On a VPS, the client browser needs to reach Supabase directly
PUBLIC_IP=$(curl -s -4 ifconfig.me 2>/dev/null || curl -s -4 icanhazip.com 2>/dev/null || echo "")

if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "127.0.0.1" ]; then
  SUPABASE_URL="http://${PUBLIC_IP}:54321"
  info "Detected public IP: $PUBLIC_IP"
  info "Supabase URL: $SUPABASE_URL"
else
  SUPABASE_URL="http://127.0.0.1:54321"
  info "No public IP detected — using localhost (local development)"
fi

# Get publishable key from supabase status
PUB_KEY=$(npx supabase status 2>/dev/null | grep "Publishable" | awk '{print $NF}' | tr -d '│ ')
SERVICE_KEY=$(npx supabase status 2>/dev/null | grep "service_role" | awk '{print $NF}' | tr -d '│ ')

if [ -z "$PUB_KEY" ]; then
  # Fallback: try different parsing
  PUB_KEY=$(npx supabase status 2>/dev/null | grep -i "publishable" | grep -oE 'sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+')
fi

if [ -z "$SERVICE_KEY" ]; then
  SERVICE_KEY=$(npx supabase status 2>/dev/null | grep -i "service_role" | grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+')
fi

if [ -n "$PUB_KEY" ] && [ -n "$SERVICE_KEY" ]; then
  # Update .env.local with actual keys and detected Supabase URL
  sed -i "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}|" .env.local
  sed -i "s|^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=.*|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=${PUB_KEY}|" .env.local
  sed -i "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}|" .env.local
  ok "Updated .env.local with Supabase URL and keys"
else
  warn "Could not auto-detect Supabase keys. You may need to update .env.local manually."
  warn "Run: npx supabase status"
  warn "Copy the Publishable key and service_role key into .env.local"
fi

# ============================================================
header "Step 6: Ready!"

echo ""
echo "Start the app:"
printf "  ${GREEN}npm run dev${NC}\n"
echo ""
echo "Then open: http://localhost:3000"
echo ""
echo "The setup wizard will guide you through creating your"
echo "superadmin account. Check the terminal for your setup token."
echo ""
echo "Supabase Studio: http://localhost:54323"
echo "Email Testing:   http://localhost:54324 (Inbucket)"
echo ""

if [ "$IS_WINDOWS" = true ]; then
  read -p "Press Enter to close..."
fi
