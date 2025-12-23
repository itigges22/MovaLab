# MovaLab Database Migrations

## Migration Files

This directory contains SQL migration files that set up the MovaLab database schema.

## Migration Strategy: Cloud vs Local

**Cloud Database Migrations (Existing):**
- `20250120_rbac_consolidation.sql` ✅
- `20250121_phase9_fix_missing_permissions.sql` ✅
- `20250121_phase9_refinement.sql` ✅

These migrations already exist in the cloud database and should NOT be deleted. They represent the production database history.

**Local Development Migrations (New - Docker Setup):**
- `20250123_01_schema_base.sql` - Base schema (generate from cloud)
- `20250123_02_functions_fixed.sql` - Fixed RLS functions
- `20250123_03_views.sql` - Database views
- `20250123_04_rls_policies_fixed.sql` - Fixed RLS policies
- `20250123_05_triggers.sql` - Database triggers

**Migration Execution:**
- **Local Docker:** All migrations run in chronological order (20250120 → 20250121 → 20250123)
- **Cloud Supabase:** The 20250120/20250121 migrations already exist; 20250123 migrations are for local dev only

### Migration Order (IMPORTANT)

Migrations MUST be applied in this order:

1. **`20250123_01_schema_base.sql`** - Base table schemas (TO BE GENERATED)
2. **`20250123_02_functions_fixed.sql`** - Database functions with RLS fixes ✅
3. **`20250123_03_views.sql`** - Database views ✅
4. **`20250123_04_rls_policies_fixed.sql`** - RLS policies (fixes all 5 security issues) ✅
5. **`20250123_05_triggers.sql`** - Database triggers ✅

### Generating the Base Schema (File #1)

The base schema file (`01_schema_base.sql`) needs to be generated from your existing cloud Supabase database using one of these methods:

#### Option A: Supabase CLI (Recommended)

```bash
# Link to your cloud project
supabase link --project-ref oomnezdhkmsfjlihkmui

# Pull schema from cloud to local
supabase db pull

# This will create a schema.sql file in supabase/migrations/
# Rename it to 20250123_01_schema_base.sql
```

#### Option B: Extraction Script

```bash
# Run the extraction script
npx tsx scripts/extract-rls-policies.ts

# This will generate:
# - EXTRACTED_functions.sql
# - EXTRACTED_views.sql
# - EXTRACTED_rls_policies.sql

# Use these as reference to create 01_schema_base.sql manually
```

#### Option C: Manual Export

1. Open Supabase Dashboard → SQL Editor
2. Run this query to get table CREATE statements:
```sql
SELECT
  'CREATE TABLE ' || schemaname || '.' || tablename || ' (...);' as create_statement
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

3. Copy each table's CREATE statement and compile into `01_schema_base.sql`

### What Each Migration Does

**02_functions_fixed.sql (✅ CRITICAL)**
- Fixes circular RLS dependency (Issue #1 & #5)
- Creates `user_has_permission()` with `SECURITY DEFINER`
- Creates `user_is_superadmin()` with `SECURITY DEFINER`
- Creates helper functions for workflow access
- Creates `get_week_start_date()` and `auto_clock_out_stale_sessions()`

**03_views.sql (✅)**
- Creates `weekly_capacity_summary` view
- Aggregates user availability, task allocations, and actual hours
- Used for capacity planning dashboards

**04_rls_policies_fixed.sql (✅ CRITICAL)**
- Fixes Issue #2: Removes duplicate policies (10 → 4 per table)
- Fixes Issue #3: Removes overly permissive policies
- Fixes Issue #4: Simplifies nested RLS queries
- Creates proper permission-based + context-aware policies
- One policy per operation (SELECT, INSERT, UPDATE, DELETE)

**05_triggers.sql (✅)**
- Auto-creates user_profiles when auth.users created
- Auto-updates `updated_at` timestamps on row modification

### Security Fixes Applied

✅ **Fix #1**: Circular RLS dependency removed via `SECURITY DEFINER`
✅ **Fix #2**: Duplicate policies consolidated (1 policy per operation)
✅ **Fix #3**: Overly permissive policies replaced with context checks
✅ **Fix #4**: Nested RLS queries optimized with helper functions
✅ **Fix #5**: Function access verified via `SECURITY DEFINER` pattern

### Testing Migrations Locally

```bash
# Start local Supabase
npm run docker:start

# Apply migrations (automatic on start)
npm run docker:reset

# Verify functions exist
npm run docker:studio
# Run in SQL Editor:
# SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';

# Verify RLS policies
# SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

### Applying to Cloud Supabase

⚠️ **WARNING**: Test thoroughly in local Docker before applying to production!

```bash
# Link to cloud project
supabase link --project-ref <your-project-ref>

# Push migrations to cloud
supabase db push
```

### Troubleshooting

**Issue**: "function user_has_permission() does not exist"
- **Fix**: Run `02_functions_fixed.sql` before `04_rls_policies_fixed.sql`

**Issue**: "circular dependency detected in RLS policies"
- **Fix**: Ensure `02_functions_fixed.sql` was applied (SECURITY DEFINER prevents recursion)

**Issue**: "permission denied for table user_roles"
- **Fix**: Check that `04_rls_policies_fixed.sql` was applied successfully
