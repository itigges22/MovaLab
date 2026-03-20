# MovaLab Docker Setup Guide

Complete guide to running MovaLab locally with Docker-based Supabase.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Service Descriptions](#service-descriptions)
5. [Environment Configuration](#environment-configuration)
6. [Database Migrations](#database-migrations)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

MovaLab uses **local Supabase** via Docker. Everything runs on your machine:

- No cloud signup required
- No external dependencies
- Consistent development environment
- Offline development capable
- Instant database reset

### What You Get

When you run `npm run docker:start`, Docker will spin up:

- **PostgreSQL 15** -- Database with RLS policies
- **GoTrue** -- Authentication server (Supabase Auth)
- **PostgREST** -- RESTful API server
- **Realtime** -- WebSocket server for live updates
- **Storage API** -- File upload/download service
- **Supabase Studio** -- Web-based database admin UI
- **pg_graphql** -- GraphQL API (optional)
- **Inbucket** -- Email testing (catch-all SMTP)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Your Computer                          │
│                                                             │
│  ┌────────────────┐          ┌─────────────────────────┐   │
│  │   Next.js App  │          │   Docker Containers     │   │
│  │  localhost:3000│◄────────►│                         │   │
│  └────────────────┘          │  ┌──────────────────┐   │   │
│                              │  │  PostgreSQL      │   │   │
│                              │  │  localhost:54322 │   │   │
│                              │  └──────────────────┘   │   │
│                              │                         │   │
│                              │  ┌──────────────────┐   │   │
│                              │  │  API Server      │   │   │
│                              │  │  127.0.0.1:54321 │   │   │
│                              │  └──────────────────┘   │   │
│                              │                         │   │
│                              │  ┌──────────────────┐   │   │
│                              │  │  Supabase Studio │   │   │
│                              │  │  localhost:54323 │   │   │
│                              │  └──────────────────┘   │   │
│                              │                         │   │
│                              │  ┌──────────────────┐   │   │
│                              │  │  Inbucket (Email)│   │   │
│                              │  │  localhost:54324 │   │   │
│                              │  └──────────────────┘   │   │
│                              └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Service Ports

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **API** | 54321 | http://127.0.0.1:54321 | RESTful API gateway |
| **PostgreSQL** | 54322 | localhost:54322 | Database connection |
| **Supabase Studio** | 54323 | http://localhost:54323 | Database admin UI |
| **Inbucket (Email)** | 54324 | http://localhost:54324 | Email testing |
| **Auth (GoTrue)** | 9999 | http://localhost:9999 | Authentication |
| **Storage API** | 5000 | http://localhost:5000 | File storage |
| **Realtime** | 4000 | ws://localhost:4000 | WebSocket server |

---

## Quick Start

### Prerequisites

1. **Node.js 18.0+**
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **Docker Desktop**
   - macOS: [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
   - Windows: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)
   - Linux: [Docker Engine](https://docs.docker.com/engine/install/)

   Verify Docker is running:
   ```bash
   docker info
   ```

### One-Command Setup

```bash
git clone https://github.com/itigges22/MovaLab.git
cd MovaLab
npm run setup
```

### Manual Setup

If you prefer to run steps manually:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Copy environment template**
   ```bash
   cp .env.local.template .env.local
   ```

3. **Start Supabase**
   ```bash
   npm run docker:start
   ```

4. **Verify setup**
   ```bash
   npm run docker:health
   ```

5. **Start Next.js**
   ```bash
   npm run dev
   ```

6. **Complete onboarding** -- Visit http://localhost:3000, follow the setup wizard to create your superadmin account. Check the terminal for the setup token.

---

## Service Descriptions

### PostgreSQL

- **Purpose:** Core database
- **Version:** PostgreSQL 15
- **Features:**
  - Row Level Security (RLS) on all tables
  - JSONB columns for permissions and settings
  - Full-text search capabilities
  - Automatic migrations on startup

**Connecting directly:**
```bash
# Via psql
psql postgresql://postgres:postgres@localhost:54322/postgres

# Via connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### GoTrue (Auth)

- **Purpose:** User authentication and authorization
- **Features:**
  - Email/password authentication
  - JWT token generation
  - User metadata storage

Users are created through the onboarding wizard (superadmin) or the invitation system (team members).

### PostgREST (API)

- **Purpose:** Auto-generated RESTful API from database schema
- **Endpoint:** http://127.0.0.1:54321
- **Features:**
  - CRUD operations on all tables
  - Complex queries via query parameters
  - RLS policy enforcement

### Supabase Studio

- **Purpose:** Web-based database admin interface
- **URL:** http://localhost:54323
- **Features:**
  - Browse tables and data
  - Execute SQL queries
  - View logs and API usage
  - Manage auth users
  - Edit RLS policies

### Inbucket (Email Testing)

- **Purpose:** Catch-all SMTP server for testing emails
- **URL:** http://localhost:54324
- **Use case:** View invitation emails, password reset emails, magic links

---

## Environment Configuration

The `.env.local` file is created from `.env.local.template` during setup.

**Default local configuration:**
```env
# Local Docker Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# App settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_MODE=false
```

See `.env.local.template` for all available configuration options including SMTP settings for production email delivery.

---

## Database Migrations

### Migration Files

MovaLab uses 7 migration files applied in order:

| Migration | Description |
|-----------|-------------|
| `20250129000000_baseline.sql` | Full baseline schema (tables, functions, views, RLS, triggers) |
| `20251230120000_fix_workflow_instances_rls.sql` | Workflow RLS policy fix |
| `20251231000000_project_assignments_source_tracking.sql` | Assignment source tracking |
| `20260228000000_client_portal_and_rls_fixes.sql` | Client portal and RLS fixes |
| `20260320000000_fix_clock_race_and_uuid_validation.sql` | Clock race condition and UUID validation |
| `20260320100000_fix_rls_privilege_escalation.sql` | RLS privilege escalation fix |
| `20260321000000_onboarding_system.sql` | Onboarding/setup wizard system |

### Running Migrations

**Automatic (on docker:start):**
```bash
npm run docker:start
# Migrations run automatically
```

**Manual (reset database):**
```bash
npm run docker:reset
# Drops all tables, re-runs all migrations, loads seed data
```

### Creating New Migrations

1. **Create migration file:**
   ```bash
   supabase migration new your_migration_name
   ```

2. **Write SQL:**
   ```sql
   -- Example: Add new column
   ALTER TABLE projects ADD COLUMN priority_score INTEGER DEFAULT 0;
   ```

3. **Apply migration:**
   ```bash
   npm run docker:reset
   ```

4. **Test thoroughly:**
   ```bash
   npm run docker:health
   ```

---

## Troubleshooting

### Docker Issues

**Error: "Cannot connect to Docker daemon"**

```bash
# macOS/Windows: Start Docker Desktop
# Linux: Start Docker service
sudo systemctl start docker
```

**Error: "Port already in use"**

```bash
# Find what's using the port
lsof -i :54321  # or 54322, 54323

# Kill the process
kill -9 <PID>

# Or use different ports in supabase/config.toml
```

**Error: "Docker container won't start"**

```bash
# Stop all containers
docker stop $(docker ps -aq)

# Remove old volumes
docker volume prune -f

# Restart fresh
npm run docker:start
```

### Database Issues

**Error: "relation does not exist"**

- **Cause:** Migrations haven't run
- **Fix:**
  ```bash
  npm run docker:reset
  ```

**Error: "permission denied for table user_roles"**

- **Cause:** RLS policies not applied
- **Fix:**
  ```bash
  npm run docker:reset
  ```

### Authentication Issues

**Can't login / No users exist**

On a fresh install, no users exist. Visit http://localhost:3000 to go through the onboarding wizard and create the superadmin account.

**JWT token errors**

- **Cause:** Mismatched JWT secrets
- **Fix:** Ensure `.env.local` uses the values from `.env.local.template`

---

## FAQ

### Do I need a Supabase account?

**No!** Everything runs locally via Docker. MovaLab is fully self-hosted.

### Can I work offline?

**Yes!** Once Docker containers are started, you can work completely offline.

### How do I access the database directly?

```bash
# Method 1: Supabase Studio (GUI)
npm run docker:studio

# Method 2: psql (CLI)
psql postgresql://postgres:postgres@localhost:54322/postgres

# Method 3: GUI client (e.g., TablePlus, pgAdmin)
# Host: localhost
# Port: 54322
# User: postgres
# Password: postgres
# Database: postgres
```

### How do I reset everything?

```bash
npm run docker:reset
```

This drops all data, re-runs migrations, and reloads seed data (3 system roles). You'll need to go through the onboarding wizard again.

### How do I update Supabase?

```bash
# Update Supabase CLI
npm install -g supabase@latest

# Restart services
npm run docker:stop
npm run docker:start
```

### Can I use a different database?

MovaLab is tightly coupled to Supabase/PostgreSQL features:
- Row Level Security (RLS)
- JSONB columns
- Full-text search
- Realtime subscriptions

Porting to MySQL/MongoDB would require significant refactoring.

### How do I test RLS policies?

```sql
-- In Supabase Studio SQL Editor

-- Test as specific user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'some-user-uuid';

-- Run query
SELECT * FROM projects;

-- Reset
RESET ROLE;
```

### How do I view logs?

```bash
# Supabase services logs
supabase status

# Docker container logs
docker logs supabase_db_movalab-local
docker logs supabase_studio_movalab-local

# Next.js logs
# Shown in terminal where `npm run dev` is running
```

### How do I contribute?

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

### Where can I get help?

- **Documentation:** `/docs/` directory
- **Discord:** [Join our community](https://discord.gg/99SpYzNbcu)
- **GitHub Issues:** [Report bugs](https://github.com/itigges22/MovaLab/issues)

---

## Additional Resources

- **Supabase Local Development:** https://supabase.com/docs/guides/cli/local-development
- **Docker Documentation:** https://docs.docker.com/
- **PostgreSQL RLS:** https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **Next.js Environment Variables:** https://nextjs.org/docs/basic-features/environment-variables

---

If you have questions or run into issues, don't hesitate to ask in our [Discord community](https://discord.gg/99SpYzNbcu).
