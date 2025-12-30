# Cloud Database Migration Guide

How to deploy and manage the MovaLab database schema on Supabase Cloud.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [NPM Commands Reference](#npm-commands-reference)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Managing Migrations](#managing-migrations)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

---

## Quick Start

```bash
# 1. Link to your Supabase Cloud project
npm run cloud:link --project-ref YOUR_PROJECT_REF

# 2. Push migrations to cloud
npm run cloud:migrate
```

That's it! Your cloud database now has the complete MovaLab schema.

---

## Prerequisites

### 1. Supabase Account

Create a free account at [supabase.com](https://supabase.com) if you don't have one.

### 2. Supabase Project

Create a new project in the Supabase Dashboard:
1. Click "New Project"
2. Choose organization and name
3. Set a strong database password (save this!)
4. Select a region close to your users
5. Wait for project to finish provisioning (~2 minutes)

### 3. Project Reference ID

Find your project reference in:
- **Dashboard URL:** `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
- **Project Settings > General > Reference ID**

The project ref looks like: `abcdefghijklmnop`

### 4. Supabase CLI Authentication

The CLI needs to authenticate with your Supabase account:

```bash
npx supabase login
```

This opens a browser window to authenticate. The token is saved locally.

---

## NPM Commands Reference

| Command | Description |
|---------|-------------|
| `npm run cloud:link` | Link local project to Supabase Cloud |
| `npm run cloud:migrate` | Push migrations to cloud database |
| `npm run cloud:status` | Show migration status on cloud |
| `npm run cloud:diff` | Show schema differences between local and cloud |
| `npm run cloud:reset` | **DANGEROUS:** Reset cloud database completely |

### Detailed Command Usage

#### `npm run cloud:link`

Links your local project to a Supabase Cloud project.

```bash
# Interactive mode (will prompt for project ref)
npm run cloud:link

# With project reference
npm run cloud:link -- --project-ref abcdefghijklmnop
```

**What it does:**
- Creates `.supabase/` directory with project configuration
- Stores project reference for future commands
- Validates connection to cloud project

**Note:** You only need to link once. The link persists in `.supabase/` directory.

#### `npm run cloud:migrate`

Pushes all pending migrations to the cloud database.

```bash
npm run cloud:migrate
```

**What it does:**
- Compares local migrations with cloud migration history
- Applies any new migrations in order
- Updates migration tracking table

**Output example:**
```
Applying migration 20250129000000_baseline.sql...done
Finished supabase db push.
```

#### `npm run cloud:status`

Shows the status of migrations on the cloud database.

```bash
npm run cloud:status
```

**Output example:**
```
        LOCAL      │     REMOTE     │     TIME (UTC)
  ─────────────────┼────────────────┼──────────────────────
    20250129000000 │ 20250129000000 │ 2025-01-29 12:00:00
```

#### `npm run cloud:diff`

Shows differences between local schema and cloud schema.

```bash
npm run cloud:diff
```

**Use cases:**
- Check if cloud has manual changes not in migrations
- Verify schema is in sync before deployment
- Debug migration issues

#### `npm run cloud:reset`

**WARNING: This deletes ALL data in the cloud database!**

```bash
npm run cloud:reset
```

**What it does:**
- Drops all tables, functions, and data
- Re-runs all migrations from scratch
- Applies seed.sql if present

**When to use:**
- Setting up a fresh staging environment
- Recovering from a corrupted state
- Starting over during development

**Never use in production with real data!**

---

## Step-by-Step Deployment

### New Project Setup

#### Step 1: Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in project details
4. Wait for provisioning to complete

#### Step 2: Login to Supabase CLI

```bash
npx supabase login
```

#### Step 3: Link to Project

```bash
npm run cloud:link -- --project-ref YOUR_PROJECT_REF
```

You'll be prompted for:
- **Database password:** The password you set when creating the project

#### Step 4: Push Migrations

```bash
npm run cloud:migrate
```

#### Step 5: Verify Deployment

```bash
npm run cloud:status
```

You should see the baseline migration listed as applied.

#### Step 6: Seed Data (Optional)

For demo/staging environments, you can seed data via:

1. **Supabase SQL Editor:** Run seed SQL directly
2. **API Endpoint:** Trigger `/api/cron/reset-demo-data` if demo mode is enabled

#### Step 7: Update Environment Variables

Update your deployment environment (Vercel, etc.) with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
```

Get these from: **Project Settings > API > Project URL** and **Publishable Key**

### Updating Existing Project

When you have new migrations to deploy:

```bash
# 1. Check current status
npm run cloud:status

# 2. Push new migrations
npm run cloud:migrate

# 3. Verify
npm run cloud:status
```

---

## Managing Migrations

### Creating New Migrations

```bash
# Create timestamped migration file
npx supabase migration new add_feature_name
```

This creates: `supabase/migrations/YYYYMMDDHHMMSS_add_feature_name.sql`

### Migration Workflow

1. **Develop locally:**
   ```bash
   npm run docker:reset   # Apply and test migration locally
   ```

2. **Test thoroughly:**
   ```bash
   npm run docker:health  # Verify system works
   ```

3. **Deploy to staging:**
   ```bash
   npm run cloud:migrate  # Push to staging project
   ```

4. **Test in staging:**
   - Verify all features work
   - Check for data issues

5. **Deploy to production:**
   ```bash
   # Link to production project
   npm run cloud:link -- --project-ref PRODUCTION_REF

   # Push migrations
   npm run cloud:migrate
   ```

### Viewing Migration History

```bash
# Local migrations (files)
ls supabase/migrations/

# Cloud migrations (applied)
npm run cloud:status
```

### Rolling Back Migrations

Supabase doesn't have built-in rollback. Options:

1. **Create a reverse migration:**
   ```bash
   npx supabase migration new rollback_feature
   # Write SQL to undo changes
   npm run cloud:migrate
   ```

2. **Reset to clean state (loses data):**
   ```bash
   npm run cloud:reset
   ```

3. **Restore from backup:**
   - Use Supabase Dashboard > Database > Backups

---

## Troubleshooting

### "Project not linked"

**Error:** `Cannot find linked project`

**Fix:**
```bash
npm run cloud:link -- --project-ref YOUR_PROJECT_REF
```

### "Authentication required"

**Error:** `Not logged in`

**Fix:**
```bash
npx supabase login
```

### "Migration already applied"

**Error:** `Migration 20250129000000 has already been applied`

**This is fine!** It means the migration was already run. Check status:
```bash
npm run cloud:status
```

### "Permission denied"

**Error:** `permission denied for table...`

**Causes:**
1. RLS policies blocking access
2. Wrong database user

**Fix:**
- Ensure you're using the correct database password
- Check RLS policies in Supabase Dashboard

### "Schema drift detected"

**Error:** Schema differences between local and cloud

**Diagnose:**
```bash
npm run cloud:diff
```

**Fix:**
1. Create migration to match cloud changes, OR
2. Reset cloud to match local: `npm run cloud:reset`

### "Function already exists"

**Error:** `function X already exists with same argument types`

**Fix:** Use `CREATE OR REPLACE FUNCTION` in migrations:
```sql
CREATE OR REPLACE FUNCTION my_function()
RETURNS void AS $$
...
$$ LANGUAGE plpgsql;
```

### "Connection refused"

**Error:** `connection refused` or `timeout`

**Causes:**
1. Network issue
2. Project paused (free tier)
3. Wrong project reference

**Fix:**
1. Check internet connection
2. Unpause project in Supabase Dashboard
3. Verify project ref: `npm run cloud:link`

---

## Best Practices

### 1. Always Test Locally First

```bash
# Test migration locally
npm run docker:reset
npm run docker:health

# Then deploy to cloud
npm run cloud:migrate
```

### 2. Use Staging Environment

Maintain separate Supabase projects:
- **Development:** Local Docker
- **Staging:** Cloud project for testing
- **Production:** Cloud project for users

### 3. Never Edit Cloud Directly

All schema changes should go through migrations:

```bash
# Wrong: Editing in Supabase SQL Editor
# Right: Creating a migration file
npx supabase migration new my_change
npm run cloud:migrate
```

### 4. Backup Before Major Changes

Use Supabase Dashboard to create a backup before running:
- `npm run cloud:reset`
- Large schema migrations
- Data migrations

### 5. Keep Migrations Small

One feature per migration:
```
20250130000000_add_user_preferences.sql    # Good
20250130000000_add_everything.sql           # Bad
```

### 6. Use IF NOT EXISTS

Make migrations idempotent:
```sql
CREATE TABLE IF NOT EXISTS my_table (...);
CREATE INDEX IF NOT EXISTS idx_name ON my_table(column);
```

### 7. Document Breaking Changes

If a migration requires application updates:
1. Deploy application changes first
2. Then run migration
3. Document in PR/commit message

---

## Related Documentation

- [Database Migrations Overview](/docs/database/DATABASE_MIGRATIONS.md)
- [Docker Setup Guide](/docs/setup/docker-setup.md)
- [First-Time Setup](/docs/setup/FIRST_TIME_SETUP.md)

---

## Command Quick Reference

```bash
# Authentication
npx supabase login              # Login to Supabase

# Linking
npm run cloud:link              # Link to cloud project

# Migrations
npm run cloud:migrate           # Push migrations to cloud
npm run cloud:status            # Check migration status
npm run cloud:diff              # Show schema differences

# Reset (DANGEROUS)
npm run cloud:reset             # Reset cloud database

# Local Development
npm run docker:start            # Start local Supabase
npm run docker:reset            # Reset local database
npm run docker:seed             # Reset + seed users
```

---

**Need help?** Join our [Discord community](https://discord.gg/99SpYzNbcu) or [open an issue](https://github.com/itigges/MovaLab/issues).
