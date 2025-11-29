# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PRISM PSA is an enterprise-grade Professional Service Automation platform built with Next.js 15 (App Router), TypeScript, Supabase (PostgreSQL), and shadcn/ui. It manages client accounts, projects, tasks, time tracking, and capacity planning for professional services organizations.

## Development Commands

```bash
# Development
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint

# Testing & Debugging
npm run test:unit            # Run unit tests (permission checker)
npm run test:integration     # Run integration tests
npm run test:permissions     # Run all permission tests
npm run test:playwright      # Run Playwright E2E tests
npm run debug:permissions    # Debug permission issues
npm run validate:permissions # Validate permission system consistency
npm run fix:permissions      # Fix common permission issues
npm run check:users          # Check user status and roles
npm run setup:test-roles     # Set up test roles and users

# Database Scripts (via tsx)
npx tsx scripts/[script-name].ts  # Run specific database scripts
```

## Architecture

### Data Flow Hierarchy
```
Accounts (Clients) → Projects → Tasks → Time Entries
                  ↓
         Project Assignments (users assigned to projects)
```

### Key Architectural Patterns

**Supabase Client Separation:**
- `lib/supabase.ts` - Browser client (`createClientSupabase()`) - singleton for client components
- `lib/supabase-server.ts` - Server client (`createServerSupabase()`) - for Server Components and API routes with `createApiSupabase(request)`
- Never use browser client in server contexts

**Permission System (Hybrid RBAC):**
- 136+ permissions defined in `lib/permissions.ts` as `Permission` enum
- Three-tier checking in `lib/permission-checker.ts`:
  1. Base permission (does role have the permission?)
  2. Context awareness (is user assigned to the resource?)
  3. Override permissions (e.g., `EDIT_ALL_PROJECTS` bypasses assignment check)
- Superadmins bypass all checks via `is_superadmin` flag or Superadmin role
- `lib/rbac.ts` provides helper functions wrapping the permission checker

**Authentication Flow:**
- `lib/contexts/AuthContext.tsx` - Client-side auth state with `UserWithRoles` profile
- `middleware.ts` - Basic auth cookie check, rate limiting, security headers
- Full auth validation happens in page components, not middleware (Edge Runtime limitations)

**API Route Pattern:**
All API routes follow this structure:
```typescript
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { validateRequestBody } from '@/lib/validation-schemas';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  const supabase = createApiSupabaseClient(request);
  if (!supabase) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get user profile with roles
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*, user_roles!user_roles_user_id_fkey(roles(*))')
    .eq('id', user.id)
    .single();

  // Validate input with Zod schema from lib/validation-schemas.ts
  const body = await request.json();
  const validation = validateRequestBody(schemaName, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  // Check permissions using lib/rbac.ts helpers
  const canPerform = await hasPermission(userProfile, Permission.EXAMPLE_PERMISSION, context);
  if (!canPerform) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  // Execute database operations
}
```

### Service Layer (`lib/*-service.ts`)
Business logic is organized into service files:
- `account-service.ts` - Client account CRUD
- `task-service.ts` / `supabase-task-service.ts` - Task management
- `permission-checker.ts` - Permission validation
- `role-management-service.ts` - Role CRUD and user assignment
- `department-service.ts` - Department operations
- `organization-service.ts` - Org chart and hierarchy
- `workflow-service.ts` / `workflow-execution-service.ts` - Workflow automation (Phase 1 Features)
- `form-service.ts` - Dynamic form templates and responses
- `client-portal-service.ts` - Client invitations and feedback
- `services/capacity-service.ts` - Capacity calculations and analytics
- `services/availability-service.ts` - User availability management
- `services/time-entry-service.ts` - Time tracking operations

### Database
- Supabase PostgreSQL with Row Level Security (RLS) on all tables
- Migrations in `supabase/migrations/` - apply via Supabase SQL Editor
- Core tables: `users`, `accounts`, `projects`, `tasks`, `time_entries`
- RBAC tables: `roles`, `permissions`, `role_permissions`, `user_roles`
- Assignment tables: `project_assignments`, `account_managers`
- Capacity tables: `user_availability`, `capacity_snapshots`
- Workflow tables: `workflow_templates`, `workflow_nodes`, `workflow_connections`, `workflow_instances`, `workflow_history`
- Form tables: `form_templates`, `form_responses`
- Client portal tables: `client_invites`, `client_feedback`
- Communication tables: `project_updates`, `project_issues`, `newsletters`

### UI Components
- Base components from shadcn/ui in `components/ui/`
- Feature components in `components/` (e.g., `kanban-*.tsx`, `gantt-chart.tsx`, `capacity-*.tsx`)
- Org chart visualization uses `@xyflow/react` in `components/org-chart/`

## Path Aliases
- `@/*` maps to project root (configured in `tsconfig.json`)

## Environment Variables
Required:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

Optional:
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` - Rate limiting
- `ENABLE_RATE_LIMIT` - Enable rate limiting
- `EXPOSE_ERROR_DETAILS` - Show detailed errors (dev only)

## Advanced Features (Phase 1)

**Workflow Automation:**
- Visual workflow builder with node-based design in `components/workflow-editor/`
- Workflow templates define handoff paths between departments, roles, and clients
- Supports conditional branching and form requirements at each node
- Workflow instances track project/task progression through defined paths
- History tracking for audit trail and out-of-order handoffs
- API routes in `app/api/workflows/`

**Dynamic Forms:**
- Inline form builder component (`components/inline-form-builder.tsx`)
- Form templates support 9 field types: text, number, date, dropdown, multiselect, file, textarea, email, checkbox
- Conditional field visibility based on other field values
- Form responses linked to workflow history entries
- Validation at both field and form level

**Client Portal:**
- Secure client invitations and access management
- Clients can view assigned projects and provide feedback
- Client approval workflow nodes for design reviews
- Satisfaction ratings and feedback collection
- API routes in `app/api/client/` and `app/api/accounts/[accountId]/client-*`

**App Router Layout:**
- `app/(main)/` - Main application routes with shared layout
- Protected routes use Server Components for auth validation
- Middleware handles basic auth checks and rate limiting only

## Important Conventions

1. **Input Validation**: All API inputs must use Zod schemas from `lib/validation-schemas.ts`
2. **Permission Checks**: Use `checkPermissionHybrid()` from `lib/permission-checker.ts` before data modifications
3. **Database Queries**: Always use parameterized queries via Supabase client - never raw SQL strings
4. **Error Handling**: API routes return structured `{ error: string }` responses with appropriate HTTP status codes
5. **Client Components**: Mark with `'use client'` directive when using React hooks, event handlers, or browser APIs
6. **Server Components**: Default for pages in App Router - can directly access Supabase server client
7. **Logging**: Use `debug-logger.ts` for structured logging with context (action, metadata, errors)

## Common Debugging Patterns

**Permission Issues:**
- Check user roles: `npm run check:users`
- Validate permission system: `npm run validate:permissions`
- Debug specific permission: Use `scripts/debug-permissions.ts` with user ID
- RLS policies can be tested via Supabase SQL Editor with `auth.uid()` set

**Authentication Problems:**
- Middleware only checks cookie presence, not validity
- Full auth validation happens in Server Components
- Use `createServerSupabase()` for Server Components and API routes
- Never use `createClientSupabase()` in server contexts

**Database Connection:**
- Check environment variables are set correctly
- Verify Supabase project URL and anon key
- Test connection with `lib/database-check.ts`
- RLS policies are enforced at database level, not application level

**Capacity Calculation Issues:**
- Proportional allocation splits user capacity across assigned accounts
- Task estimates spread across task duration (start to due date)
- Service is in `lib/services/capacity-service.ts`
- See `docs/CAPACITY_SYSTEM_IMPLEMENTATION.md` for detailed logic

**Next.js App Router:**
- Pages in `app/` are Server Components by default
- Use `'use client'` for interactive components
- Route groups like `(main)` don't affect URL paths (used for shared layouts)
- Loading states use `loading.tsx` files in route folders

## Additional Documentation

Comprehensive documentation is available in the `docs/` directory:

**Feature Documentation:**
- `docs/FEATURELIST.md` - Complete feature list, database architecture, and data relationships
- `docs/PHASE1_IMPLEMENTATION_COMPLETE.md` - Phase 1 features (workflows, forms, client portal)
- `docs/PHASE1_API_ROUTES.md` - Phase 1 API route documentation

**Security & Permissions:**
- `docs/SECURITY.md` - Security architecture and RLS implementation
- `docs/PERMISSION_QUICK_REFERENCE.md` - Permission system reference guide
- `docs/PERMISSION_SYSTEM_TESTING.md` - Testing permission system

**System Implementation:**
- `docs/CAPACITY_SYSTEM_IMPLEMENTATION.md` - Capacity calculation logic and algorithms
- `docs/DEPARTMENT_ARCHITECTURE_MIGRATION.md` - Department membership system
- `docs/DATABASE_CONNECTION.md` - Database setup and connection troubleshooting

**Testing & Debugging:**
- `docs/TESTING_STRATEGY.md` - Overall testing approach
- `docs/NOV26_E2E_WORKFLOW_TESTING.md` - E2E workflow test results
- `docs/TESTING&DEBUGGING/` - Specific fix documentation
