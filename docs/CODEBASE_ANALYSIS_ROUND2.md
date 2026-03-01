# Codebase Analysis — Round 2

**Date:** 2026-03-01
**Scope:** Loading/empty states, race conditions, SEO metadata, API input validation, security

This is a continuation of the initial codebase audit. Round 1 focused on the highest-risk areas (schema mismatches, RBAC gaps, error leaks). Round 2 covers broader quality and hardening concerns.

---

## Table of Contents

1. [Race Conditions & Stale Closures](#1-race-conditions--stale-closures)
2. [Missing Loading & Empty States](#2-missing-loading--empty-states)
3. [API Input Validation Gaps](#3-api-input-validation-gaps)
4. [SEO Metadata](#4-seo-metadata)
5. [Security Concerns](#5-security-concerns)

---

## 1. Race Conditions & Stale Closures

### Critical: Missing AbortController on Async Fetches

4 components make Supabase/fetch calls inside `useEffect` without cancellation on unmount. If the component unmounts before the response arrives, React will attempt to `setState` on an unmounted component.

| File | Lines | Fetch Target |
|------|-------|-------------|
| `components/assigned-projects-section.tsx` | 119-156 | `workflow_instances` query |
| `components/time-entries-chart.tsx` | 57-135 | `fetchChartData()` — multiple Supabase queries |
| `components/time-entries-list.tsx` | 113-203 | `fetchFiltersData()` + `fetchEntries()` |
| `components/user-inbox.tsx` | 96-122 | `/api/workflows/my-projects` + `/api/workflows/my-approvals` |

**Fix pattern:**
```typescript
useEffect(() => {
  let cancelled = false;
  async function load() {
    const { data } = await supabase.from('table').select('*');
    if (!cancelled) setData(data);
  }
  load();
  return () => { cancelled = true; };
}, [deps]);
```

### Critical: setTimeout Without Cleanup

2 locations fire timeouts that survive unmounting:

| File | Lines | Description |
|------|-------|-------------|
| `app/projects/page.tsx` | 76-79 | `setTimeout(() => setRefreshKey(...), 500)` in callback |
| `components/org-chart/org-chart-canvas.tsx` | 356-365 | Layout timeout fires after unmount |

**Fix:** Store the timeout ID in a ref and clear it in the useEffect cleanup.

### Critical: Missing isMounted Guard in Long Async Chain

`app/projects/page.tsx` (lines 88-343) runs 5+ sequential Supabase queries in one `useEffect` without checking if the component is still mounted between them. If `userProfile` or `refreshKey` changes mid-execution, a second invocation starts in parallel with the first.

### High: Stale Closures in Event Handlers

| File | Lines | Issue |
|------|-------|-------|
| `components/availability-calendar.tsx` | 160-192 | `handleSave()` and `handleCopyToNextWeek()` capture stale state |
| `components/clock-widget.tsx` | 85-113 | Window event listeners capture stale `isDragging` |

### Medium: Sequential setState Without Batching

| File | Lines | Issue |
|------|-------|-------|
| `components/time-entries-list.tsx` | 226-261 | `handleSaveEdit` fires 3 state updates + async fetch sequentially |
| `components/account-list.tsx` | 36-73 | Permission check loop fires 4 sequential `setState` calls |

### Medium: Missing Dependency Array Completeness

| File | Lines | Issue |
|------|-------|-------|
| `app/projects/page.tsx` | 347-378 | `filterProjects` useCallback may have incomplete deps |
| `components/workflow-progress.tsx` | 324-462 | `loadWorkflowProgress` has complex nested async deps |

---

## 2. Missing Loading & Empty States

### 24 Pages Missing `loading.tsx`

Next.js App Router uses `loading.tsx` to show a Suspense fallback while page data loads. These routes have none:

| Route | Path |
|-------|------|
| `/accounts` | `app/accounts/` |
| `/accounts/[accountId]` | `app/accounts/[accountId]/` |
| `/admin/database` | `app/admin/database/` |
| `/admin/rbac-diagnostics` | `app/admin/rbac-diagnostics/` |
| `/admin/roles` | `app/admin/roles/` |
| `/admin/superadmin-setup` | `app/admin/superadmin-setup/` |
| `/admin/time-tracking` | `app/admin/time-tracking/` |
| `/admin/users/pending` | `app/admin/users/pending/` |
| `/departments` | `app/departments/` |
| `/departments/[departmentId]` | `app/departments/[departmentId]/` |
| `/departments/[departmentId]/admin` | `app/departments/[departmentId]/admin/` |
| `/pending-approval` | `app/pending-approval/` |
| `/profile` | `app/profile/` |
| `/time-entries` | `app/time-entries/` |
| `/analytics` | `app/analytics/` (basic spinner only) |
| `/capacity` | `app/capacity/` (basic spinner only) |
| `/admin/client-feedback` | `app/(main)/admin/client-feedback/` |
| `/admin/client-portal` | `app/(main)/admin/client-portal/` |
| `/admin` | `app/(main)/admin/` |

### Components Missing Empty-State Messages

| File | Issue |
|------|-------|
| `components/time-entries-list.tsx` | Shows empty table when no entries found instead of helpful message |
| `components/gantt-chart.tsx` | No "No tasks in project" message when tasks array is empty |

### Components Missing Loading States

| File | Issue |
|------|-------|
| `components/drag-availability-calendar.tsx` | Renders full 24x7 grid without skeleton while data loads |
| `components/admin/permission-manager.tsx` | No loading indicator while permissions are fetched |

### Well-Implemented Examples (reference for consistency)

- `components/dashboard/my-accounts-widget.tsx` — loading skeleton, error state, empty state
- `components/dashboard/my-collaborators-widget.tsx` — loading skeleton, error state, empty state
- `components/analytics/widgets/account-insights-widget.tsx` — WidgetBase handles all states

---

## 3. API Input Validation Gaps

### Overall Assessment

The codebase has strong validation patterns in many routes (Zod schemas, `validateRequestBody()`, try/catch). However several routes use manual validation or skip it entirely.

### High: Routes Missing Zod Validation

| Route | Method | File | Issue |
|-------|--------|------|-------|
| `/api/tasks` | POST | `app/api/tasks/route.ts:50-58` | Manual field-by-field checks; no validation on `status`, `priority`, `estimated_hours`, `assigned_to` |
| `/api/time-entries` | POST | `app/api/time-entries/route.ts:125-137` | No UUID validation on `taskId`/`projectId`, no date format validation |
| `/api/time-entries` | PATCH | `app/api/time-entries/route.ts:226-241` | No `entryId` UUID validation |
| `/api/availability` | POST | `app/api/availability/route.ts:110-123` | No UUID validation on `userId`, no date format on `weekStartDate` |
| `/api/profile` | PATCH | `app/api/profile/route.ts:77-101` | Manual validation; should use Zod for consistency |
| `/api/projects/[id]/updates` | POST | `app/api/projects/[projectId]/updates/route.ts:150-154` | Only checks `content` is non-empty; no max-length |

### High: URL Parameters Never Validated as UUIDs

All dynamic route params (`[projectId]`, `[taskId]`, `[id]`, etc.) are passed directly to `.eq('id', param)` without UUID format validation. While Supabase parameterizes queries (no SQL injection), malformed IDs silently return empty results which may mask bugs.

**Affected routes (non-exhaustive):**
- `app/api/projects/[projectId]/route.ts`
- `app/api/projects/[projectId]/updates/[updateId]/route.ts`
- `app/api/projects/[projectId]/issues/[issueId]/route.ts`
- `app/api/workflows/history/[historyId]/form/route.ts`
- `app/api/workflows/instances/[id]/active-steps/route.ts`
- `app/api/admin/time-entries/[id]/route.ts`

### Medium: Query Parameter Validation Missing

| Route | Params | Issue |
|-------|--------|-------|
| `/api/time-entries` (GET) | `userId`, `taskId`, `projectId` | No UUID validation |
| `/api/admin/time-entries` (GET) | `userId` | No UUID validation |
| `/api/availability` (GET/DELETE) | `userId`, `weekStartDate` | No UUID or date validation |

### Medium: JSON Body Parsing Without Try/Catch

| Route | File |
|-------|------|
| `/api/accounts` (POST) | `app/api/accounts/route.ts:121` |
| `/api/admin/workflows/templates` (POST) | `app/api/admin/workflows/templates/route.ts:109` |
| `/api/admin/workflows/templates/[id]` (PATCH) | `app/api/admin/workflows/templates/[id]/route.ts:125` |

`await request.json()` throws `SyntaxError` on malformed JSON. These routes don't wrap it in try/catch before passing to validation.

### Recommendations

1. **Create Zod schemas** for `tasks`, `time-entries`, `availability`, and `profile` routes
2. **Add a `validateUUID()` helper** and apply to all dynamic params
3. **Wrap all `request.json()` in try/catch** or create a `safeParseBody()` helper
4. **Never trust `userId` from request body** — always extract from auth session

---

## 4. SEO Metadata

> **Context:** MovaLab is a private SaaS app requiring authentication for all protected pages. SEO matters most for public pages (login, signup, forgot-password). Authenticated pages benefit from metadata mainly for browser tab titles and social sharing.

### Root Layout

`app/layout.tsx` has basic metadata:
```typescript
export const metadata: Metadata = {
  title: "MovaLab - Professional Service Automation",
  description: "Professional Service Automation Platform for MovaLab",
};
```

**Missing from root layout:**
- OpenGraph tags (og:title, og:description, og:image)
- Twitter Card tags
- Viewport configuration
- Favicon/icon references in metadata
- Template pattern for child page titles (`title.template: '%s | MovaLab'`)

### 30 of 31 Pages Missing Metadata

Only the root layout exports metadata. Every `page.tsx` has none — either because it's a client component (can't export metadata) or it simply doesn't define it.

**Public pages (highest priority):**

| Page | File | Issue |
|------|------|-------|
| `/login` | `app/login/page.tsx` | Client component — needs parent layout |
| `/signup` | `app/signup/page.tsx` | Client component — needs parent layout |
| `/forgot-password` | `app/forgot-password/page.tsx` | Client component — needs parent layout |
| `/reset-password` | `app/reset-password/page.tsx` | Client component — needs parent layout |

**Dynamic pages needing `generateMetadata` (medium priority):**

| Page | File |
|------|------|
| `/projects/[projectId]` | `app/projects/[projectId]/page.tsx` |
| `/accounts/[accountId]` | `app/accounts/[accountId]/page.tsx` |
| `/departments/[departmentId]` | `app/departments/[departmentId]/page.tsx` |
| `/admin/workflows/[id]/edit` | `app/(main)/admin/workflows/[id]/edit/page.tsx` |

**Authenticated pages (low priority, improves tab titles):**
`/dashboard`, `/projects`, `/accounts`, `/analytics`, `/capacity`, `/time-entries`, `/departments`, `/profile`, `/pending-approval`, `/welcome`, all `/admin/*` pages (15+ total)

### Missing Global SEO Files

| File | Status |
|------|--------|
| `app/robots.ts` | Missing |
| `app/sitemap.ts` | Missing |
| Favicon in metadata | Missing (may exist in `/public` but not referenced) |

### Recommendations

1. **Update `app/layout.tsx`** with `title.template`, OpenGraph, Twitter Card, viewport, icons
2. **Create `app/(auth)/layout.tsx`** route group with metadata for login/signup/forgot-password
3. **Add `generateMetadata`** to the 4 dynamic `[param]` pages
4. **Create `app/robots.ts`** disallowing `/admin`, `/api`, `/dashboard`
5. **Create `app/sitemap.ts`** for public routes

---

## 5. Security Concerns

### Overall Assessment

The codebase has **strong security foundations**: RLS as the primary data access layer, proper auth guards on API routes, no XSS vectors, good environment variable handling. The issues below are operational/hardening concerns, not fundamental architectural flaws.

### Critical: SQL String Interpolation in Demo Reset Endpoint

**File:** `app/api/cron/reset-demo-data/route.ts:72`

UUIDs from database queries are interpolated directly into SQL strings passed to `supabase.rpc('exec_sql', { query })`:

```typescript
const opsRoleUpsert = `
  INSERT INTO roles (...) VALUES
    ('Operations Coordinator', '${operationsDeptId}', ...
`;
await supabase.rpc('exec_sql', { query: opsRoleUpsert });
```

While `operationsDeptId` comes from a prior query (mitigating practical risk), this pattern is inherently unsafe. The `exec_sql` RPC function can execute arbitrary SQL.

**Fix:** Replace raw SQL with Supabase's `.from().insert()` / `.upsert()` API.

### High: Hardcoded Supabase Project URL

**File:** `app/api/cron/reset-demo-data/route.ts:9`

```typescript
const DEMO_PROJECT_URL = 'https://xxtelrazoeuirsnvdoml.supabase.co';
```

Project reference ID visible in source code. Should be an environment variable.

### High: Missing CRON_SECRET Validation

**File:** `app/api/cron/reset-demo-data/route.ts:31-35`

The demo reset endpoint relies only on `DEMO_MODE=true` flag. Vercel Cron provides a `CRON_SECRET` mechanism for authenticating cron requests — it's not used here. If demo mode is accidentally enabled in production, anyone can trigger data resets.

### Medium: Rate Limiting Fails Open

**File:** `lib/rate-limit.ts:146-150`

If Redis is unavailable, rate limiting silently bypasses:
```typescript
catch (error) {
  return null; // Allow request on error (fail open)
}
```

This means a Redis outage disables all rate limiting without alerting operators.

**Fix:** Add prominent alerting on Redis connection failures. Consider in-memory fallback rate limiting.

### Medium: Error Details Configuration

**File:** `lib/config.ts:61`

```typescript
exposeDetails: process.env.NODE_ENV === 'development',
```

Correctly gated to development, but the pattern `...(config.errors.exposeDetails && { details: error.message })` is used in API routes. If misconfigured in production, database error messages (containing schema info) would leak to clients.

### Passed Checks

| Check | Result |
|-------|--------|
| XSS (`dangerouslySetInnerHTML`) | None found |
| `eval()` / `new Function()` | None found |
| Anon key usage | Not used — publishable key only |
| `.env` files in git | Properly gitignored |
| Open redirects | Validated in `auth/callback/route.ts:21` |
| Auth on API routes | 58 of 58 protected routes have auth guards |
| Security headers | X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy all set |
| CORS | Properly restricted in production |
| Client/server module separation | No violations found |

---

## Summary of Findings

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Race Conditions & Stale Closures | 4 | 2 | 4 | — |
| Loading & Empty States | — | 24 pages | 4 components | — |
| API Input Validation | — | 8 routes | 6 routes | 1 |
| SEO Metadata | — | 4 public pages | 4 dynamic pages | 15+ auth pages |
| Security | 1 | 2 | 2 | 2 |
| **Total** | **5** | **40** | **20** | **18+** |

### Priority Remediation Order

**Immediate (next release):**
1. Fix SQL string interpolation in demo cron endpoint
2. Add isMounted guards to `app/projects/page.tsx` async chains
3. Add Zod schemas for `/api/tasks`, `/api/time-entries`, `/api/availability`
4. Move hardcoded Supabase URL to env variable

**Short-term (next sprint):**
5. Add `loading.tsx` to the 24 routes missing them
6. Add AbortController / cancelled flag to 4 components with unguarded fetches
7. Add UUID validation helper for dynamic route params
8. Update root layout metadata with OpenGraph, title template, icons

**Medium-term:**
9. Add `generateMetadata` to 4 dynamic pages
10. Create `robots.ts` and `sitemap.ts`
11. Add metadata to public auth pages via route group layout
12. Implement Redis failure alerting for rate limiter
