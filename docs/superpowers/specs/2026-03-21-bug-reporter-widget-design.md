# Bug Reporter Widget — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Problem

The application has unresolved bugs across many pages. There is no systematic way for users to report problems they encounter while using the app. A global bug reporting tool would let users (and the team) sweep through the app, document issues with full telemetry, and create an actionable backlog.

## Solution

A global floating button + keyboard shortcut that opens a modal for submitting bug reports. Each report auto-captures debugging telemetry (URL, browser, viewport, user info, recent console errors) and saves to a JSON file on disk.

## Design Decisions

- **JSON file storage** over Supabase — keeps the feature fully decoupled from the platform's database. Can migrate to Supabase + admin UI later.
- **No auth required** — the button is visible to all users, including unauthenticated ones. User info is captured if available.
- **No RBAC** — every user sees the bug reporter everywhere.
- **No rate limiting** — internal tool, not public-facing.
- **No file locking** — concurrent writes could theoretically lose a report. Acceptable for an internal tool with low submission volume.
- **Modal over floating widget** — simpler to build, no drag/position/minimize state. Keyboard shortcut (`Cmd+Shift+B` / `Ctrl+Shift+B`) enables fast repeat reporting.

## Widget UI

- Small fixed button with bug icon, **bottom-left corner**, positioned at `bottom: 4rem; left: 1rem` to avoid overlapping the clock widget (which defaults to `bottom: 1rem; left: 1rem`). `z-index: 50`.
- Keyboard shortcut: `Cmd+Shift+B` (Mac) / `Ctrl+Shift+B` (Windows/Linux)
- Opens a shadcn `Dialog` containing:
  - **Description** — textarea (required), max 5000 characters, placeholder: "What went wrong?"
  - **Category** — optional select: `UI/Layout`, `Data/Loading`, `Permissions`, `Navigation`, `Performance`, `Other`
  - **Severity** — optional select: `Minor`, `Major`, `Blocker`
  - **Collapsible "Debug Info"** — shows auto-captured telemetry so the reporter can see what's being sent
  - **Submit** button — POSTs to API, shows toast on success

## Telemetry Capture

Client-side module (`lib/bug-report-telemetry.ts`) exports:

- **`initConsoleCapture(): () => void`** — call on component mount. Monkey-patches `console.error` to store last 10 errors in a circular buffer as `{ message, timestamp }`. Returns a cleanup function that restores the original `console.error`.
- **`getConsoleErrors(): { message: string, timestamp: string }[]`** — returns captured errors. Each message is truncated to 1000 characters.
- **`collectTelemetry(user): TelemetryData`** — gathers URL, userAgent, viewport, console errors, and user info into a single object. Called at submission time.

Data collected:
- `window.location.href` — current page URL
- `navigator.userAgent` — browser and OS
- `window.innerWidth` x `window.innerHeight` — viewport dimensions
- Console errors — last 10 from the circular buffer
- User info from `useAuth()` hook — reads `userProfile` from `AuthContext` (which wraps the entire app, so it's always available). Extracts `{ id, email, name }` or `null` if `userProfile` is null (unauthenticated).

## Mounting Location

`<BugReporter />` is rendered as a **sibling** of `<ClockWidgetManager />` inside `app-with-clock-provider.tsx` (the `AppWithClockProvider` component). It has no dependency on clock state. Since `AuthProviderWrapper` wraps the entire app in `app/layout.tsx`, the `useAuth()` hook is available on all routes including unauthenticated pages (login, onboarding) — `userProfile` will simply be `null`.

## Report Schema

```typescript
interface BugReport {
  id: string;              // crypto.randomUUID()
  description: string;     // user-provided, max 5000 chars
  category: string | null; // UI/Layout, Data/Loading, Permissions, Navigation, Performance, Other
  severity: string | null; // Minor, Major, Blocker
  url: string;             // page where bug was reported
  userAgent: string;       // browser/OS
  viewport: {
    width: number;
    height: number;
  };
  user: {                  // null if not authenticated
    id: string;
    email: string;
    name: string;
  } | null;
  consoleErrors: {
    message: string;       // truncated to 1000 chars
    timestamp: string;
  }[];
  timestamp: string;       // ISO 8601
  status: "open";          // for future triage
}
```

## API

### `POST /api/bug-reports`

- No auth guard
- Validates: description must be non-empty string, max 5000 characters
- Reads `data/bug-reports.json`, appends report, writes back
- Creates file and `data/` directory automatically on first report
- **Success:** `{ success: true, id: string }` with status 201
- **Validation error:** `{ error: string }` with status 400
- **File system error:** `{ error: string }` with status 500

### `GET /api/bug-reports`

- No auth guard (can lock down later)
- Returns all reports as JSON array
- Optional query param `?status=open` to filter
- **File not found:** returns empty array `[]`

## Storage

- **File:** `data/bug-reports.json`
- **Format:** JSON array of `BugReport` objects
- **Auto-created** on first submission (including `data/` directory)
- **`/data/` added to `.gitignore`** (root-level only, won't affect nested `data/` directories)

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `lib/bug-report-telemetry.ts` | Console error capture + telemetry collection functions |
| `components/bug-reporter.tsx` | Button + modal client component |
| `app/api/bug-reports/route.ts` | POST and GET endpoints |
| `data/bug-reports.json` | Auto-created on first report |

### Modified Files

| File | Change |
|------|--------|
| `components/app-with-clock-provider.tsx` | Render `<BugReporter />` as sibling of `<ClockWidgetManager />` |
| `.gitignore` | Add `/data/` (root-level only) |

## Future Migration Path

When ready to upgrade:
1. Create `bug_reports` Supabase table with RLS policies
2. Build `/admin/bug-reports` page with filters (status, category, severity, date, page)
3. Swap JSON file read/write in API route for Supabase queries
4. Add status management (open/investigating/fixed/wontfix)
5. Optionally lock down GET endpoint with admin permission check
