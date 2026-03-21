# First-Time Setup Guide

This guide explains how to set up MovaLab for the first time on a fresh installation. MovaLab is self-hosted using Docker and local Supabase.

---

## Overview

When you deploy MovaLab for the first time, the database starts empty (only 3 system roles exist). The app includes a **setup wizard** at `/onboarding` that:

- Automatically activates when no superadmin exists in the database
- Generates a one-time setup token printed to the server terminal
- Guides you through creating the first superadmin account
- Includes an interactive tutorial after account creation
- Automatically disables after the first superadmin is created

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 18.0+** ([Download](https://nodejs.org/))
- **Docker Desktop** installed and running ([Download](https://www.docker.com/products/docker-desktop))
- **Git** for cloning the repository

---

## Setup Steps

### Step 1: Clone and Run Setup

```bash
git clone https://github.com/itigges22/MovaLab.git
cd MovaLab
npm run setup
```

The `npm run setup` script (`scripts/first-time-setup.sh`) automatically:
1. Checks prerequisites (Node.js, Docker, Supabase CLI)
2. Installs npm dependencies
3. Creates `.env.local` from the template (if it doesn't exist)
4. Starts local Supabase via Docker
5. Applies all 7 database migrations
6. Loads seed data (3 system roles: Superadmin, Client, No Assigned Role)

**What gets created in the database:**
- Tables with Row Level Security policies
- System roles (Superadmin, Client, No Assigned Role)
- Database functions (auto clock-out, week start date, etc.)
- Onboarding system tables (setup_tokens, onboarding_state)

No departments, users, accounts, or projects are created. The platform starts empty.

### Step 2: Start the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Step 3: Complete the Onboarding Wizard

1. The app automatically redirects to `/onboarding`
2. **Check your terminal** -- a one-time setup token is printed to the server console output
3. Enter the setup token in the wizard
4. Create your superadmin account (email + password)
5. Follow the interactive tutorial that walks you through the platform

### Step 4: Build Your Organization

Once you're logged in as superadmin:

1. **Create Departments** -- Go to Admin > Departments
2. **Create Roles** -- Go to Admin > Roles (assign permissions and departments)
3. **Invite Team Members** -- Go to Admin > Invite Users (sends email invitations)
4. **Create Accounts** -- Add client accounts and assign account managers
5. **Set Up Workflows** -- Go to Admin > Workflows to create workflow templates

### Step 5: Invite Team Members

Team members are invited via the invitation system:

1. Go to Admin > Invite Users
2. Enter the team member's email address
3. An invitation email is sent (via Nodemailer in production, via Inbucket locally)
4. In local development, check Inbucket at http://localhost:54324 to see the invitation email
5. The invited user clicks the link, creates their account, and is assigned a role

---

## Security Features

### One-Time Setup Token
The setup token is generated once and printed to the server terminal. It is stored in the `setup_tokens` database table and expires after use. This prevents unauthorized users from becoming superadmin.

### Authentication Required
The onboarding wizard creates a new Supabase Auth user as part of the flow. The superadmin account is tied to a verified email address.

### Automatic Disabling
After the first superadmin is created, the onboarding wizard is disabled. Visiting `/onboarding` after setup will redirect to the main app.

---

## Troubleshooting

### Setup Token Not Appearing in Terminal
**Cause:** The dev server may not have started cleanly.

**Solution:**
1. Stop the dev server (Ctrl+C)
2. Run `npm run dev` again
3. Visit http://localhost:3000 -- the token should appear in the terminal

### "Setup Complete" / Redirect Away from Onboarding
**Cause:** A superadmin already exists in the database.

**Solution:** This is expected. If you need to start fresh:
```bash
npm run docker:reset
npm run dev
```

### Docker Services Not Starting
**Cause:** Docker Desktop may not be running.

**Solution:**
1. Start Docker Desktop
2. Wait for it to fully initialize
3. Run `npm run docker:start` or `npm run setup`

### Database Connection Failed
**Solution:**
```bash
npm run docker:stop
npm run docker:start
npm run docker:health
```

---

## After Setup

Once your superadmin account is created, the platform is ready for daily use:

1. **Invite your team** via Admin > Invite Users
2. **Create client accounts** via Accounts section
3. **Start projects** and assign team members
4. **Build workflows** to standardize your processes
5. **Track time** with clock in/out or manual entry

---

## Environment Variables

The `.env.local` file is created automatically from `.env.local.template` during setup. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | Local Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` | Local publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | (set in template) | Service role key for server-side operations |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Application URL |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Enable demo mode (optional) |
| `SMTP_*` | (commented out) | SMTP settings for production email delivery |

---

## Troubleshooting

### Stuck on Welcome/Login page after database reset

**Symptom:** After resetting the database (`npx supabase db reset`), you get stuck in a loop between `/welcome` and `/login`, or the onboarding wizard doesn't appear.

**Cause:** Your browser has stale authentication tokens from a previous session. The tokens reference a user that no longer exists in the reset database, so the auth refresh fails (HTTP 400), but the browser keeps trying.

**Fix:** Clear all site data for your domain:
1. Open browser DevTools (F12)
2. Go to **Application** → **Storage** → click **Clear site data**
3. Or open an **incognito/private window** and navigate to your site

### Setup token not appearing in console

**Symptom:** You click "Begin Setup" but no token appears in the server terminal.

**Cause:** In production mode (`npm start`), `console.log` is stripped. The setup token uses `console.warn` which survives production builds.

**Fix:** Check the terminal where `npm start` is running. The token appears as:
```
========================================
SUPERADMIN SETUP TOKEN
   Token: abc123...
   Expires in 15 minutes
========================================
```

If running in background (`nohup npm start > movalab.log 2>&1 &`), check the log:
```bash
tail -20 movalab.log
```

### "Could not find table setup_tokens" error

**Symptom:** `PGRST205` error — table not found in schema cache.

**Cause:** PostgREST (Supabase's API layer) caches the database schema. After applying new migrations, the cache is stale.

**Fix:** Restart Supabase to refresh the schema cache:
```bash
npx supabase stop --no-backup && npx supabase start
```

### Supabase containers crashing or hanging

**Symptom:** `supabase start` hangs, or containers keep dying.

**Cause:** Insufficient memory. Supabase runs ~12 Docker containers that need ~2-3 GB RAM. With Next.js and the OS, you need at least 4 GB total (8 GB recommended).

**Fix:**
```bash
docker system prune -f          # Free up Docker disk/memory
systemctl restart docker         # Restart Docker daemon
npx supabase start               # Try again
```

If it persists, upgrade to an 8 GB VPS.

### Mixed content / CORS / CSP errors

**Symptom:** Browser console shows "Mixed Content", "CORS policy", or "Content Security Policy" errors when trying to reach Supabase.

**Cause:** The browser is accessing the site via HTTPS but Supabase is on HTTP, or the Supabase URL doesn't match the CSP.

**Fix:** This is handled automatically by the setup script — Supabase is proxied through Nginx at `/supabase/` so everything stays on the same origin. If you see these errors:
1. Make sure Nginx is running: `systemctl status nginx`
2. Make sure the config is correct: `nginx -t`
3. Rebuild the app: `rm -rf .next && npm run build && npm start`

### Docker Hub rate limiting

**Symptom:** `supabase start` fails with "Rate exceeded" errors when pulling images.

**Fix:** Log into Docker Hub (free account gets 200 pulls/6hr instead of 100):
```bash
docker login
```
Then retry `npx supabase start`. Already-pulled images are cached.

---

## Related Documentation

- [Docker Setup Guide](./docker-setup.md) -- Local development environment details
- [Demo Mode Guide](./DEMO_MODE.md) -- Running demos locally
- [Contributing Guide](../../CONTRIBUTING.md) -- Development workflow
