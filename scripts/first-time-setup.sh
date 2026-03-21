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

# .env.local will be generated AFTER Supabase starts (Step 5)
# so we can use the actual keys and detect the public IP
info "Environment will be configured after Supabase starts..."

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
header "Step 5: Generate .env.local"

# Detect public IP
info "Detecting server IP..."
PUBLIC_IP=$(curl -s -4 --connect-timeout 5 ifconfig.me 2>/dev/null || curl -s -4 --connect-timeout 5 icanhazip.com 2>/dev/null || echo "")

if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "127.0.0.1" ]; then
  IS_VPS=true
  ok "Public IP detected: $PUBLIC_IP"
else
  IS_VPS=false
  ok "Local development mode (no public IP)"
fi

# Supabase URL: use /supabase/ proxy path if Nginx will be set up, otherwise direct
if [ "$IS_VPS" = true ]; then
  # VPS mode: Supabase is proxied through Nginx at /supabase/
  # Browser calls same-origin /supabase/* (works with HTTPS, no mixed content)
  # Server calls localhost directly (fast, no proxy overhead)
  SUPABASE_URL="/supabase"
  SUPABASE_SERVER_URL="http://127.0.0.1:54321"
  APP_URL="http://${PUBLIC_IP}"
else
  # Local dev: everything direct
  SUPABASE_URL="http://127.0.0.1:54321"
  SUPABASE_SERVER_URL="http://127.0.0.1:54321"
  APP_URL="http://localhost:3000"
fi

# Read keys from running Supabase
info "Reading Supabase keys..."
SUPABASE_STATUS=$(npx supabase status 2>/dev/null)

# Parse publishable key (look for "Publishable" or "anon" row)
PUB_KEY=$(echo "$SUPABASE_STATUS" | grep -i "publishable" | grep -oE 'sb_publishable_[A-Za-z0-9_-]+' | head -1)
if [ -z "$PUB_KEY" ]; then
  PUB_KEY=$(echo "$SUPABASE_STATUS" | grep -i "anon\|publishable" | grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' | head -1)
fi

# Parse service/secret key (look for "Secret" or "service_role" row)
SERVICE_KEY=$(echo "$SUPABASE_STATUS" | grep -i "secret\|service_role" | grep -oE 'sb_secret_[A-Za-z0-9_-]+' | head -1)
if [ -z "$SERVICE_KEY" ]; then
  SERVICE_KEY=$(echo "$SUPABASE_STATUS" | grep -i "secret\|service_role" | grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' | head -1)
fi

if [ -z "$PUB_KEY" ]; then
  warn "Could not detect publishable key"
  warn "Supabase status output:"
  echo "$SUPABASE_STATUS"
  fail "Fix: copy the Publishable key from above into .env.local"
fi

if [ -z "$SERVICE_KEY" ]; then
  warn "Could not detect secret/service key"
  warn "Supabase status output:"
  echo "$SUPABASE_STATUS"
  fail "Fix: copy the Secret key from above into .env.local"
fi

ok "Found publishable key: ${PUB_KEY:0:20}..."
ok "Found secret key: ${SERVICE_KEY:0:20}..."

# Configure local mail server on VPS (for sending real invitation emails)
if [ "$IS_VPS" = true ]; then
  header "Email Configuration"

  # Configure exim4 for internet delivery (most Debian/Ubuntu VPS have it pre-installed)
  if command_exists exim4 || command_exists sendmail; then
    MAIL_DOMAIN="${DOMAIN_NAME:-$(hostname -f)}"

    # Configure exim4 for internet delivery
    if [ -f /etc/exim4/update-exim4.conf.conf ]; then
      cat > /etc/exim4/update-exim4.conf.conf << EXIMEOF
dc_eximconfig_configtype='internet'
dc_other_hostnames='$(hostname)'
dc_local_interfaces='127.0.0.1 ; ::1'
dc_readhost='${MAIL_DOMAIN}'
dc_relay_domains=''
dc_minimaldns='false'
dc_relay_nets=''
dc_smarthost=''
CFILEMODE='644'
dc_use_split_config='false'
dc_hide_mailname='true'
dc_mailname_in_oh='true'
dc_localdelivery='mail_spool'
EXIMEOF
      echo "$MAIL_DOMAIN" > /etc/mailname
      update-exim4.conf 2>/dev/null && systemctl restart exim4 2>/dev/null
      ok "Local mail server configured (exim4)"
      info "  Emails sent from: noreply@${MAIL_DOMAIN}"
      info "  No third-party SMTP service needed"
    fi
  else
    # No local MTA — install one
    info "Installing mail server (exim4)..."
    apt-get install -y -qq exim4 >/dev/null 2>&1
    if command_exists exim4; then
      MAIL_DOMAIN="${DOMAIN_NAME:-$(hostname -f)}"
      cat > /etc/exim4/update-exim4.conf.conf << EXIMEOF
dc_eximconfig_configtype='internet'
dc_other_hostnames='$(hostname)'
dc_local_interfaces='127.0.0.1 ; ::1'
dc_readhost='${MAIL_DOMAIN}'
dc_relay_domains=''
dc_minimaldns='false'
dc_relay_nets=''
dc_smarthost=''
CFILEMODE='644'
dc_use_split_config='false'
dc_hide_mailname='true'
dc_mailname_in_oh='true'
dc_localdelivery='mail_spool'
EXIMEOF
      echo "$MAIL_DOMAIN" > /etc/mailname
      update-exim4.conf 2>/dev/null && systemctl restart exim4 2>/dev/null
      ok "Local mail server installed and configured"
    else
      warn "Could not install exim4. Emails will be caught by Mailpit (local only)."
      warn "View emails at: /mail/"
    fi
  fi
fi

# Write .env.local from scratch
cat > .env.local << ENVEOF
# Auto-generated by npm run setup — do not commit this file
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVER_URL=${SUPABASE_SERVER_URL}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=${PUB_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}
NEXT_PUBLIC_APP_URL=${APP_URL}
NEXT_PUBLIC_DEMO_MODE=false
LOG_LEVEL=debug
NODE_ENV=development
ENVEOF

ok "Generated .env.local"
info "  Supabase URL: $SUPABASE_URL"
info "  App URL:      $APP_URL"

# ============================================================
header "Step 6: Nginx Reverse Proxy"

if [ "$IS_VPS" = true ]; then
  # Install Nginx if not present
  if ! command_exists nginx; then
    info "Installing Nginx..."
    apt-get update -qq && apt-get install -y -qq nginx >/dev/null 2>&1 || {
      warn "Could not install Nginx automatically."
      warn "Install it manually: sudo apt install nginx"
      warn "Then copy nginx/movalab.conf to /etc/nginx/sites-enabled/"
    }
  fi

  if command_exists nginx; then
    ok "Nginx installed"

    # Ask for domain name (optional — needed for SSL)
    echo ""
    printf "  Enter your domain name (e.g., movalab.example.com)\n"
    printf "  Or press Enter to skip (use IP address only): "
    read -r DOMAIN_NAME

    if [ -n "$DOMAIN_NAME" ]; then
      # Update Nginx config with the domain name
      sed "s/server_name _;/server_name ${DOMAIN_NAME};/" nginx/movalab.conf > /etc/nginx/sites-available/movalab
    else
      cp nginx/movalab.conf /etc/nginx/sites-available/movalab
    fi

    ln -sf /etc/nginx/sites-available/movalab /etc/nginx/sites-enabled/movalab 2>/dev/null || true
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    # Test and reload
    if nginx -t 2>/dev/null; then
      systemctl enable nginx 2>/dev/null || true
      systemctl restart nginx 2>/dev/null || true
      ok "Nginx configured and running"
      info "  Port 80 → Next.js (port 3000)"
      info "  /supabase/ → Supabase API (port 54321)"
      info "  /studio/ → Supabase Studio (port 54323)"
      info "  /mail/ → Mailpit email testing (port 54324)"
    else
      warn "Nginx config test failed. Check: nginx -t"
    fi

    # SSL with Let's Encrypt (only if domain was provided)
    if [ -n "$DOMAIN_NAME" ]; then
      info "Setting up SSL with Let's Encrypt..."

      if ! command_exists certbot; then
        apt-get install -y -qq certbot python3-certbot-nginx >/dev/null 2>&1 || {
          warn "Could not install certbot. Install manually: sudo apt install certbot python3-certbot-nginx"
        }
      fi

      if command_exists certbot; then
        # Get SSL cert (non-interactive, auto-agree to TOS)
        certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>&1 | tail -5

        if [ $? -eq 0 ]; then
          ok "SSL certificate installed for ${DOMAIN_NAME}"
          info "  HTTPS enabled — all HTTP traffic will redirect to HTTPS"
          info "  Certificate auto-renews via certbot timer"
          APP_URL="https://${DOMAIN_NAME}"
          # Update .env.local with HTTPS app URL
          sed -i "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=${APP_URL}|" .env.local
        else
          warn "SSL setup failed. You can retry later with:"
          warn "  sudo certbot --nginx -d ${DOMAIN_NAME}"
        fi
      fi
    fi
  fi
else
  info "Skipping Nginx (local development — not needed)"
fi

# ============================================================
header "Step 7: Build & Start"

if [ "$IS_VPS" = true ]; then
  # VPS: build for production (no cross-origin issues, faster, optimized)
  info "Building for production..."
  NODE_ENV=production npm run build 2>&1 | tail -5

  if [ $? -eq 0 ]; then
    ok "Production build complete"
    echo ""
    echo "Start the app:"
    printf "  ${GREEN}npm start${NC}\n"
    echo ""
    echo "Or run in background:"
    printf "  ${GREEN}nohup npm start > movalab.log 2>&1 &${NC}\n"
    echo ""
    if [ -n "$DOMAIN_NAME" ]; then
      echo "Then open: https://${DOMAIN_NAME}"
    else
      echo "Then open: http://${PUBLIC_IP}"
    fi
    echo ""
    echo "The setup wizard will guide you through creating your"
    echo "superadmin account. Check the terminal (or movalab.log) for your setup token."
    echo ""
    if [ -n "$DOMAIN_NAME" ]; then
      echo "Supabase Studio: https://${DOMAIN_NAME}/studio/"
      echo "Email Testing:   https://${DOMAIN_NAME}/mail/"
    else
      echo "Supabase Studio: http://${PUBLIC_IP}/studio/"
      echo "Email Testing:   http://${PUBLIC_IP}/mail/"
    fi
  else
    warn "Production build failed. Falling back to dev mode."
    echo ""
    echo "Start the app:"
    printf "  ${GREEN}npm run dev${NC}\n"
  fi
else
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
fi
echo ""

if [ "$IS_WINDOWS" = true ]; then
  read -p "Press Enter to close..."
fi
