# MovaLab Docker Setup Guide

Complete guide to running MovaLab locally with Docker-based Supabase.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Service Descriptions](#service-descriptions)
5. [Environment Switching](#environment-switching)
6. [Database Migrations](#database-migrations)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

MovaLab uses **Supabase Local Development** via Docker to eliminate the need for cloud accounts during development. Everything runs on your machine:

- ✅ **No cloud signup required**
- ✅ **No environment variable management**
- ✅ **Consistent development environment**
- ✅ **Offline development capable**
- ✅ **Instant database reset/seeding**

### What You Get

When you run `npm run docker:start`, Docker will spin up:

- **PostgreSQL 15** - Production database with RLS policies
- **GoTrue** - Authentication server (Supabase Auth)
- **PostgREST** - RESTful API server
- **Realtime** - WebSocket server for live updates
- **Storage API** - File upload/download service
- **Supabase Studio** - Web-based database admin UI
- **pg_graphql** - GraphQL API (optional)
- **Inbucket** - Email testing (catch-all SMTP)

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
│                              │  │  localhost:54321 │   │   │
│                              │  └──────────────────┘   │   │
│                              │                         │   │
│                              │  ┌──────────────────┐   │   │
│                              │  │  Supabase Studio │   │   │
│                              │  │  localhost:54323 │   │   │
│                              │  └──────────────────┘   │   │
│                              │                         │   │
│                              │  ┌──────────────────┐   │   │
│                              │  │  Auth (GoTrue)   │   │   │
│                              │  │  localhost:9999  │   │   │
│                              │  └──────────────────┘   │   │
│                              └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Service Ports

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **API** | 54321 | http://localhost:54321 | RESTful API gateway |
| **PostgreSQL** | 54322 | localhost:54322 | Database connection |
| **Supabase Studio** | 54323 | http://localhost:54323 | Database admin UI |
| **Auth (GoTrue)** | 9999 | http://localhost:9999 | Authentication |
| **Storage API** | 5000 | http://localhost:5000 | File storage |
| **Realtime** | 4000 | ws://localhost:4000 | WebSocket server |
| **Inbucket (Email)** | 54324 | http://localhost:54324 | Email testing |

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
git clone https://github.com/itigges/MovaLab.git
cd MovaLab
./scripts/first-time-setup.sh
```

### Manual Setup

If you prefer to run steps manually:

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

3. **Copy environment template**
   ```bash
   cp .env.local.template .env.local
   ```

4. **Start Supabase**
   ```bash
   npm run docker:start
   ```

5. **Create seed users**
   ```bash
   npx tsx scripts/create-seed-users.ts
   ```

6. **Verify setup**
   ```bash
   npm run docker:health
   ```

7. **Start Next.js**
   ```bash
   npm run dev
   ```

---

## Service Descriptions

### PostgreSQL

- **Purpose:** Core database with 35+ tables
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
  - Magic link support
  - OAuth providers (Google, GitHub, etc.)
  - JWT token generation
  - User metadata storage

**Test users created by seed script:**
- `superadmin@test.local` / `Test1234!`
- `exec@test.local` / `Test1234!`
- `manager@test.local` / `Test1234!`
- `pm@test.local` / `Test1234!`
- `designer@test.local` / `Test1234!`
- `dev@test.local` / `Test1234!`
- `contributor@test.local` / `Test1234!`
- `client@test.local` / `Test1234!`

### PostgREST (API)

- **Purpose:** Auto-generated RESTful API from database schema
- **Endpoint:** http://localhost:54321
- **Features:**
  - CRUD operations on all tables
  - Complex queries via query parameters
  - RLS policy enforcement
  - OpenAPI documentation

**Example API call:**
```bash
curl http://localhost:54321/rest/v1/projects \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_JWT"
```

### Supabase Studio

- **Purpose:** Web-based database admin interface
- **URL:** http://localhost:54323
- **Features:**
  - Browse tables and data
  - Execute SQL queries
  - View logs and API usage
  - Manage auth users
  - Edit RLS policies
  - Monitor realtime subscriptions

**Pro tip:** Use Studio to inspect seed data and test queries before implementing them in code.

### Storage API

- **Purpose:** File upload/download with RLS
- **Features:**
  - Bucket-based organization
  - RLS policies for access control
  - Automatic image transformations
  - CDN integration ready

### Realtime

- **Purpose:** WebSocket server for live updates
- **Features:**
  - Subscribe to database changes
  - Broadcast messages
  - Presence tracking
  - Row-level subscriptions

### Inbucket (Email Testing)

- **Purpose:** Catch-all SMTP server for testing emails
- **URL:** http://localhost:54324
- **Use case:** View password reset emails, magic links, etc.

---

## Environment Switching

MovaLab supports two environments: **Local Docker** (development) and **Cloud Supabase** (production).

### Local Docker (Default)

**`.env.local` configuration:**
```env
# Local Docker Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**When to use:**
- Local development
- Testing new features
- Offline development
- Running integration tests

### Cloud Supabase (Production)

**`.env.local` configuration:**
```env
# Cloud Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional: Rate limiting
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
ENABLE_RATE_LIMIT=true
```

**When to use:**
- Production deployment
- Staging environment
- Collaborative testing with team

### Switching Environments

1. **Stop Next.js** if running:
   ```bash
   # Press Ctrl+C to stop dev server
   ```

2. **Update `.env.local`:**
   ```bash
   # Comment out local config, uncomment cloud config
   # Or vice versa
   ```

3. **Restart Next.js:**
   ```bash
   npm run dev
   ```

**No code changes needed!** The app automatically detects which Supabase instance to use based on `.env.local`.

---

## Database Migrations

### Migration File

MovaLab uses a **single consolidated baseline migration** for simplicity and reliability:

```
supabase/migrations/20250129000000_baseline.sql
```

This file contains **everything** needed for a complete MovaLab installation:

| Component | Contents |
|-----------|----------|
| **Tables** | 36 tables with all columns, constraints, relationships |
| **Functions** | 15+ PostgreSQL functions with `SECURITY DEFINER` |
| **RLS Policies** | Complete Row Level Security for all tables |
| **Triggers** | Auto-update timestamps, auto-create profiles |
| **Indexes** | Performance indexes on frequently queried columns |
| **Views** | `weekly_capacity_summary` for capacity calculations |

**Why a single file?**
- No dependency ordering issues
- Easy to deploy to new environments
- Consistent schema across local and cloud
- Simpler troubleshooting

For detailed migration documentation, see [Database Migrations Guide](/docs/database/DATABASE_MIGRATIONS.md).

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
   # Or restart Supabase
   ```

4. **Test thoroughly:**
   ```bash
   npm run docker:health
   npm run test:permissions
   ```

### Deploying to Cloud

To deploy migrations to Supabase Cloud:

```bash
# Link to your cloud project (one time)
npm run cloud:link -- --project-ref YOUR_PROJECT_REF

# Push migrations
npm run cloud:migrate

# Check status
npm run cloud:status
```

For comprehensive cloud deployment instructions, see [Cloud Migration Guide](/docs/database/CLOUD_MIGRATION.md).

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
  npx tsx scripts/create-seed-users.ts
  ```

**Error: "function user_has_permission() does not exist"**

- **Cause:** Migration `02_functions_fixed.sql` didn't run
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

### Seed Data Issues

**No users in database**

```bash
# Re-create auth users
npx tsx scripts/create-seed-users.ts
```

**Seed data is missing**

```bash
# Reset database and re-load seed.sql
npm run docker:reset
npx tsx scripts/create-seed-users.ts
```

### Authentication Issues

**Can't login with test users**

1. **Verify users exist:**
   ```bash
   # Open Supabase Studio
   npm run docker:studio
   # Go to Authentication > Users
   ```

2. **Re-create users:**
   ```bash
   npx tsx scripts/create-seed-users.ts
   ```

3. **Check password:**
   - All test users: `Test1234!` (with exclamation mark)

**JWT token errors**

- **Cause:** Mismatched JWT secrets
- **Fix:** Use the default local keys in `.env.local.template`

### Performance Issues

**Slow queries**

1. **Enable query logging:**
   ```sql
   -- In Supabase Studio SQL Editor
   SHOW log_statement;
   SET log_statement = 'all';
   ```

2. **Check indexes:**
   ```sql
   -- Find missing indexes
   SELECT schemaname, tablename, indexname
   FROM pg_indexes
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```

3. **Analyze slow queries:**
   ```sql
   EXPLAIN ANALYZE SELECT * FROM projects WHERE status = 'active';
   ```

---

## FAQ

### Do I need a Supabase account?

**No!** Everything runs locally via Docker. You only need a Supabase account if deploying to production.

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
npm run docker:stop
docker volume prune -f
npm run docker:start
npx tsx scripts/create-seed-users.ts
```

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

### How do I deploy to production?

See [Cloud Setup (Production)](../README.md#cloud-setup-production) in README.md.

### How do I test RLS policies?

```sql
-- In Supabase Studio SQL Editor

-- Test as specific user
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = '11111111-1111-1111-1111-000000000001';

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

### Can I use this with other Next.js projects?

Yes! The Docker setup is portable. Copy:
- `/supabase/config.toml`
- `/scripts/first-time-setup.sh`
- `package.json` Docker scripts

Adapt migrations and seed data for your schema.

### How do I contribute?

See [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines.

### Where can I get help?

- **Documentation:** `/docs/` directory
- **Discord:** [Join our community](https://discord.gg/99SpYzNbcu)
- **GitHub Issues:** [Report bugs](https://github.com/itigges/MovaLab/issues)
- **Email:** See SECURITY.md for security-related questions

---

## Additional Resources

- **Supabase Local Development:** https://supabase.com/docs/guides/cli/local-development
- **Docker Documentation:** https://docs.docker.com/
- **PostgreSQL RLS:** https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- **Next.js Environment Variables:** https://nextjs.org/docs/basic-features/environment-variables

---

**Happy coding! 🚀**

If you have questions or run into issues, don't hesitate to ask in our [Discord community](https://discord.gg/99SpYzNbcu).
