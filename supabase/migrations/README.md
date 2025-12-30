# MovaLab Database Migrations

## Overview

This directory contains the consolidated SQL migration file for the MovaLab database schema.

## Migration File

| File | Description |
|------|-------------|
| `20250129000000_baseline.sql` | Complete baseline schema with all tables, functions, RLS policies, triggers, and indexes |

## What's Included

The baseline migration includes everything needed for a complete MovaLab installation:

### Tables (36 total)
- **User Management**: `user_profiles`, `user_roles`, `roles`, `departments`
- **Accounts & Projects**: `accounts`, `account_members`, `projects`, `project_assignments`, `project_stakeholders`, `project_updates`, `project_issues`
- **Tasks**: `tasks`, `task_dependencies`, `task_week_allocations`
- **Time Tracking**: `time_entries`, `clock_sessions`, `user_availability`
- **Workflows**: `workflow_templates`, `workflow_nodes`, `workflow_connections`, `workflow_instances`, `workflow_history`, `workflow_active_steps`, `workflow_node_assignments`
- **Forms**: `form_templates`, `form_responses`
- **Other**: `deliverables`, `newsletters`, `milestones`, `notifications`, `client_feedback`, `client_portal_invitations`, `account_kanban_configs`, `user_dashboard_preferences`, `role_hierarchy_audit`

### Functions (15+ with SECURITY DEFINER)
- `user_is_superadmin(uuid)` - Check if user is superadmin
- `user_has_permission(uuid, text)` - Check user permission
- `user_is_account_manager(uuid, uuid)` - Check account manager status
- `user_is_account_member(uuid, uuid)` - Check account membership
- `user_has_project_access(uuid, uuid)` - Check project access
- `get_week_start_date(date)` - Calculate ISO week start (Monday)
- `auto_clock_out_stale_sessions()` - Auto-close sessions after 16 hours
- `get_project_stakeholders(uuid)` - Get project stakeholder list
- `exec_sql(text)` - Execute dynamic SQL (for cron jobs)
- And more...

### Row Level Security (RLS)
All tables have RLS enabled with proper policies for:
- Superadmin bypass
- Permission-based access
- Context-aware access (project assignments, account membership)

### Indexes & Triggers
- Optimized indexes on frequently queried columns
- Auto-update `updated_at` timestamps on all tables
- Auto-create user profiles on auth.users creation

## Usage

### Local Development (Docker)

```bash
# Start Supabase (migrations apply automatically)
npm run docker:start

# Reset database and apply migrations fresh
npm run docker:reset

# Reset and create seed users
npm run docker:seed
```

### Cloud Deployment

For deploying to Supabase Cloud:

1. **New Project**: Run the baseline migration directly in Supabase SQL Editor
2. **Existing Project**: The cloud database should already have the schema applied

```bash
# Link to cloud project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations to cloud
supabase db push
```

## Schema Generation

This baseline was generated from a working local Docker Supabase instance:

```bash
# Export schema from local Docker
npx supabase db dump --local --schema public > supabase/migrations/20250129000000_baseline.sql
```

## Adding New Migrations

When adding new features that require schema changes:

1. Create a new migration file with timestamp: `YYYYMMDDHHMMSS_description.sql`
2. Test locally with `npm run docker:reset`
3. Apply to cloud with `supabase db push`

Example:
```bash
# Create new migration
touch supabase/migrations/20250201000000_add_new_feature.sql

# Edit the file with your SQL changes

# Test locally
npm run docker:reset

# Apply to cloud
supabase db push
```

## Troubleshooting

### "function user_has_permission() does not exist"
The baseline migration includes all functions. Ensure the migration ran completely.

### "permission denied for table X"
Check that RLS policies were created. Run:
```sql
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

### "circular dependency detected in RLS policies"
This shouldn't happen with the baseline - all functions use `SECURITY DEFINER` to prevent recursion.

## Related Documentation

- [Database Architecture](/docs/database/DATABASE_MIGRATIONS.md) - Full migration guide
- [Docker Setup](/docs/setup/docker-setup.md) - Local development setup
- [First-Time Setup](/docs/setup/FIRST_TIME_SETUP.md) - Production deployment
