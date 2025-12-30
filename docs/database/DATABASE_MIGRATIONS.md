# MovaLab Database Migrations

Complete guide to database migrations for MovaLab.

---

## Table of Contents

1. [Overview](#overview)
2. [Migration File](#migration-file)
3. [Schema Contents](#schema-contents)
4. [Local Development](#local-development)
5. [Cloud Deployment](#cloud-deployment)
6. [Creating New Migrations](#creating-new-migrations)
7. [Troubleshooting](#troubleshooting)
8. [RLS Security Architecture](#rls-security-architecture)

---

## Overview

MovaLab uses a **single consolidated baseline migration** approach. This provides:

- **Simplicity:** One file contains the complete schema
- **Reliability:** No dependency ordering issues between migrations
- **Portability:** Easy to deploy to new environments
- **Consistency:** Same schema guaranteed across local and cloud

### Migration Philosophy

Instead of incremental migrations that can conflict or have ordering issues, MovaLab maintains a single baseline that represents the complete current state of the database schema.

---

## Migration File

### Location

```
supabase/migrations/20250129000000_baseline.sql
```

### What It Contains

The baseline migration includes everything needed for a complete MovaLab installation:

| Category | Contents |
|----------|----------|
| **Tables** | 36 tables with all columns, constraints, and relationships |
| **Functions** | 15+ PostgreSQL functions with SECURITY DEFINER |
| **RLS Policies** | Complete Row Level Security for all tables |
| **Triggers** | Auto-update timestamps, auto-create profiles |
| **Indexes** | Performance indexes on frequently queried columns |
| **Views** | `weekly_capacity_summary` for capacity calculations |

---

## Schema Contents

### Tables (36 total)

#### User Management
| Table | Purpose |
|-------|---------|
| `user_profiles` | Extended user profile data |
| `user_roles` | User-to-role assignments |
| `roles` | Role definitions with permissions (JSONB) |
| `departments` | Organizational departments |
| `role_hierarchy_audit` | Audit trail for org chart changes |

#### Accounts & Projects
| Table | Purpose |
|-------|---------|
| `accounts` | Client/customer accounts |
| `account_members` | User access to accounts |
| `projects` | Project entities |
| `project_assignments` | User assignments to projects |
| `project_stakeholders` | Project observers and stakeholders |
| `project_updates` | Project status updates |
| `project_issues` | Project blockers and problems |
| `account_kanban_configs` | Per-account Kanban configurations |

#### Tasks
| Table | Purpose |
|-------|---------|
| `tasks` | Individual work items |
| `task_dependencies` | Task ordering constraints |
| `task_week_allocations` | Weekly task planning |

#### Time Tracking
| Table | Purpose |
|-------|---------|
| `time_entries` | Logged time on tasks |
| `clock_sessions` | Active work sessions |
| `user_availability` | Weekly work capacity |

#### Workflows
| Table | Purpose |
|-------|---------|
| `workflow_templates` | Reusable workflow definitions |
| `workflow_nodes` | Steps in workflows |
| `workflow_connections` | Valid transition paths |
| `workflow_instances` | Active workflow executions |
| `workflow_history` | Audit trail of transitions |
| `workflow_active_steps` | Current active steps |
| `workflow_node_assignments` | User assignments to nodes |

#### Forms
| Table | Purpose |
|-------|---------|
| `form_templates` | Dynamic form definitions |
| `form_responses` | Submitted form data |

#### Other
| Table | Purpose |
|-------|---------|
| `deliverables` | Project deliverables |
| `newsletters` | Company newsletters |
| `milestones` | Project milestones |
| `notifications` | User notifications |
| `client_feedback` | Client portal feedback |
| `client_portal_invitations` | Client access invitations |
| `user_dashboard_preferences` | Dashboard customization |

### Functions (SECURITY DEFINER)

These functions use `SECURITY DEFINER` to prevent RLS recursion issues:

| Function | Purpose |
|----------|---------|
| `user_is_superadmin(uuid)` | Check if user is superadmin |
| `user_has_permission(uuid, text)` | Check user permission |
| `user_is_account_manager(uuid, uuid)` | Check account manager status |
| `user_is_account_member(uuid, uuid)` | Check account membership |
| `user_has_project_access(uuid, uuid)` | Check project access |
| `get_week_start_date(date)` | Calculate ISO week start (Monday) |
| `auto_clock_out_stale_sessions()` | Auto-close sessions after 16 hours |
| `get_project_stakeholders(uuid)` | Get project stakeholder list |
| `exec_sql(text)` | Execute dynamic SQL (for cron jobs) |

### Why SECURITY DEFINER?

RLS policies that query other tables protected by RLS can cause infinite recursion. `SECURITY DEFINER` functions execute with the permissions of the function owner (postgres), bypassing RLS within the function while still enforcing RLS on the outer query.

---

## Local Development

### First-Time Setup

```bash
# Run the automated setup script
./scripts/first-time-setup.sh     # Linux/macOS
.\scripts\first-time-setup.ps1    # Windows PowerShell
```

The script will:
1. Check prerequisites (Node.js, Docker)
2. Verify baseline migration exists
3. Install npm dependencies
4. Start Supabase Docker containers
5. Apply migrations automatically
6. Create seed users and data

### Daily Commands

```bash
# Start Supabase (migrations apply automatically)
npm run docker:start

# Reset database and re-apply migrations
npm run docker:reset

# Reset database + create seed users
npm run docker:seed

# Check system health
npm run docker:health

# Stop Supabase
npm run docker:stop
```

### How Migrations Apply

When you run `npx supabase start` or `npm run docker:start`:

1. Supabase reads all `.sql` files in `supabase/migrations/`
2. Files are sorted by timestamp prefix (YYYYMMDDHHMMSS)
3. Each migration runs in order
4. Migration state is tracked in `supabase_migrations` table

---

## Cloud Deployment

MovaLab provides npm commands for easy cloud database management.

### Quick Start

```bash
# 1. Link to your Supabase Cloud project
npm run cloud:link -- --project-ref YOUR_PROJECT_REF

# 2. Push migrations to cloud
npm run cloud:migrate
```

### NPM Commands

| Command | Description |
|---------|-------------|
| `npm run cloud:link` | Link local project to Supabase Cloud |
| `npm run cloud:migrate` | Push migrations to cloud database |
| `npm run cloud:status` | Show migration status on cloud |
| `npm run cloud:diff` | Show schema differences between local and cloud |
| `npm run cloud:reset` | **DANGEROUS:** Reset cloud database completely |

### New Project Setup

1. **Create project** at [supabase.com](https://supabase.com)

2. **Login to Supabase CLI:**
   ```bash
   npx supabase login
   ```

3. **Link to project:**
   ```bash
   npm run cloud:link -- --project-ref YOUR_PROJECT_REF
   ```

4. **Push migrations:**
   ```bash
   npm run cloud:migrate
   ```

5. **Verify:**
   ```bash
   npm run cloud:status
   ```

### Existing Project

```bash
# Check migration status
npm run cloud:status

# Push any new migrations
npm run cloud:migrate
```

### Full Database Reset (Cloud)

**WARNING: This deletes all data!**

```bash
npm run cloud:reset
```

For comprehensive cloud deployment documentation, see [Cloud Migration Guide](/docs/database/CLOUD_MIGRATION.md).

---

## Creating New Migrations

When adding new features that require schema changes:

### Step 1: Create Migration File

```bash
# Creates timestamped file in supabase/migrations/
npx supabase migration new add_new_feature
```

This creates: `supabase/migrations/YYYYMMDDHHMMSS_add_new_feature.sql`

### Step 2: Write SQL

```sql
-- Example: Add new table
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Superadmins can manage feature flags"
ON feature_flags FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND is_superadmin = true
    )
);
```

### Step 3: Test Locally

```bash
# Reset database to apply new migration
npm run docker:reset

# Verify it works
npm run docker:health
```

### Step 4: Push to Cloud

```bash
npx supabase db push
```

### Best Practices

1. **One migration = one feature:** Keep migrations focused
2. **Always enable RLS:** `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
3. **Add policies:** Don't leave tables without access control
4. **Test before push:** Always test locally first
5. **Document changes:** Add comments explaining why

---

## Troubleshooting

### "function user_has_permission() does not exist"

**Cause:** Migration didn't complete or functions weren't created.

**Fix:**
```bash
npm run docker:reset
```

### "permission denied for table X"

**Cause:** RLS policies missing or not applied.

**Fix:**
```bash
# Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

# Reset to reapply policies
npm run docker:reset
```

### "circular dependency detected in RLS policies"

**Cause:** RLS policy queries another table that queries back.

**Fix:** This shouldn't happen with the baseline - all functions use `SECURITY DEFINER`. If it occurs with new code, refactor to use `SECURITY DEFINER` functions.

### "relation already exists"

**Cause:** Migration trying to create something that exists.

**Fix:** Use `IF NOT EXISTS`:
```sql
CREATE TABLE IF NOT EXISTS table_name (...);
CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);
```

### Migration Order Issues

**Cause:** Migrations run in alphabetical order by filename.

**Fix:** Always use timestamp prefixes: `YYYYMMDDHHMMSS_name.sql`

### Cloud and Local Schema Drift

**Cause:** Changes made directly in cloud SQL Editor.

**Fix:**
1. Export cloud schema: `npx supabase db dump --linked > cloud_schema.sql`
2. Compare with local migrations
3. Create migration to sync differences

---

## RLS Security Architecture

### Overview

Every table has Row Level Security (RLS) enabled. This enforces data access at the PostgreSQL level, not just application code.

### Policy Patterns

#### 1. Superadmin Bypass
```sql
CREATE POLICY "Superadmins have full access"
ON table_name FOR ALL
USING (
    user_is_superadmin(auth.uid())
);
```

#### 2. Assignment-Based Access
```sql
CREATE POLICY "Users can view assigned projects"
ON projects FOR SELECT
USING (
    id IN (
        SELECT project_id FROM project_assignments
        WHERE user_id = auth.uid()
        AND removed_at IS NULL
    )
);
```

#### 3. Ownership-Based Access
```sql
CREATE POLICY "Users can edit own entries"
ON time_entries FOR UPDATE
USING (user_id = auth.uid());
```

#### 4. Permission-Based Access
```sql
CREATE POLICY "Users with permission can view all"
ON projects FOR SELECT
USING (
    user_has_permission(auth.uid(), 'view_all_projects')
);
```

### Security Guarantees

- **Application bugs cannot leak data:** RLS enforces access at database level
- **Direct SQL respects RLS:** Even psql connections obey policies
- **Service role bypasses RLS:** Only for trusted server-side operations

---

## Related Documentation

- [Cloud Migration Guide](/docs/database/CLOUD_MIGRATION.md) - Deploying to Supabase Cloud
- [Docker Setup Guide](/docs/setup/docker-setup.md) - Local development environment
- [First-Time Setup](/docs/setup/FIRST_TIME_SETUP.md) - Complete setup walkthrough
- [Security Guide](/docs/security/SECURITY.md) - Security architecture
- [CLAUDE.md](/CLAUDE.md) - Full codebase reference

---

## Quick Reference

### Local Development

| Command | Purpose |
|---------|---------|
| `npm run docker:start` | Start Supabase, apply migrations |
| `npm run docker:stop` | Stop Supabase |
| `npm run docker:reset` | Reset database, reapply migrations |
| `npm run docker:seed` | Reset + create seed users |
| `npx supabase migration new NAME` | Create new migration |

### Cloud Deployment

| Command | Purpose |
|---------|---------|
| `npm run cloud:link` | Link to Supabase Cloud project |
| `npm run cloud:migrate` | Push migrations to cloud |
| `npm run cloud:status` | Check migration status on cloud |
| `npm run cloud:diff` | Show schema differences |
| `npm run cloud:reset` | Reset cloud database (DANGEROUS) |

---

**Need help?** Join our [Discord community](https://discord.gg/99SpYzNbcu) or [open an issue](https://github.com/itigges/MovaLab/issues).
