# MovaLab Demo Mode

Demo mode allows you to showcase MovaLab without risking data corruption or requiring user signup. It is an optional configuration for local demonstrations and testing.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Features in Demo Mode](#features-in-demo-mode)
4. [Local Demo Setup](#local-demo-setup)
5. [Resetting and Clearing Demo Data](#resetting-and-clearing-demo-data)
6. [Security Considerations](#security-considerations)
7. [Technical Implementation](#technical-implementation)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Overview

Demo mode is a special configuration that:

- **Enables quick-login buttons** -- Users can log in as different roles with one click (no signup required)
- **Disables destructive actions** -- Delete, remove, and dangerous operations are blocked
- **Hides superadmin access** -- Prevents exposure of sensitive admin features
- **Protects demo data** -- Ensures the demo environment stays clean for the next user

### When to Use Demo Mode

| Scenario | Use Demo Mode? |
|----------|----------------|
| Public product demo | Yes |
| Internal testing | Yes |
| Evaluating MovaLab | Yes |
| Development with test data | Optional |
| Production deployment | **No** |

### Prerequisites

Demo mode requires demo users to exist in the database. The `scripts/create-seed-users.ts` utility can create these, but it is **not** run automatically by any npm script. You must run it manually if you want demo users:

```bash
npx tsx scripts/create-seed-users.ts
```

---

## Quick Start

### Option 1: Using `npm run dev:demo` (Recommended)

```bash
# One command starts everything
npm run dev:demo
```

This will:
1. Check Docker is installed and running
2. Start Supabase containers (PostgreSQL, Auth, API, etc.)
3. Wait for services to be ready
4. Start Next.js with demo mode enabled
5. Open http://localhost:3000

### Option 2: Manual Setup with `.env.local`

If Supabase containers are already running, you can just set the environment variable:

1. Add to `.env.local`:
   ```
   NEXT_PUBLIC_DEMO_MODE=true
   ```

2. Start the dev server:
   ```bash
   npm run dev
   ```

Both approaches result in the same demo experience.

### Stop Demo Environment

```bash
npm run docker:stop
```

---

## Features in Demo Mode

### Login Experience

Instead of the standard login form with email/password, demo mode shows:
- Quick-login buttons for each demo user
- Role descriptions to help users choose
- One-click access (no password typing needed)
- Password hint displayed for manual login if needed

### Blocked Actions

The following destructive actions are blocked in demo mode:

| Action | Normal Mode | Demo Mode |
|--------|-------------|-----------|
| Delete accounts | Allowed | Blocked |
| Remove users from accounts | Allowed | Blocked |
| Delete departments | Allowed | Blocked |
| Delete roles | Allowed | Blocked |
| Remove users from roles | Allowed | Blocked |
| Delete projects | Allowed | Blocked |
| Delete tasks | Allowed | Blocked |
| Delete time entries | Allowed | Blocked |
| Delete workflows | Allowed | Blocked |
| Delete newsletters | Allowed | Blocked |
| Superadmin setup | Accessible | Hidden |

When a user attempts a blocked action, they see a friendly message explaining that the action is disabled in demo mode.

### Hidden Features

- Superadmin setup page
- User signup toggle on login page

---

## Local Demo Setup

### First-Time Setup

```bash
# Clone the repository
git clone https://github.com/itigges22/MovaLab.git
cd MovaLab

# Run the full setup
npm run setup

# Create demo users (required for demo mode quick-login buttons)
npx tsx scripts/create-seed-users.ts

# Start demo mode
npm run dev:demo
```

### Daily Usage

```bash
# Start demo mode
npm run dev:demo

# When done, stop Docker to free RAM
npm run docker:stop
```

### Resource Usage

Local demo mode runs several Docker containers:
- PostgreSQL database
- Supabase Auth (GoTrue)
- Supabase API (PostgREST)
- Supabase Studio (optional, for database UI)

**Typical RAM usage:** 2-4 GB

To minimize resource usage, stop Docker when not in use: `npm run docker:stop`

---

## Resetting and Clearing Demo Data

### Full Database Reset

To completely reset the database to a clean slate:

```bash
npm run docker:reset
```

This will:
1. Drop all existing data
2. Re-run all migrations
3. Load seed data (3 system roles only)

**Note:** After a reset, you'll need to either go through the onboarding wizard again or re-create demo users:
```bash
npx tsx scripts/create-seed-users.ts
```

**Warning:** This destroys ALL data in the local database.

### Partial Data Cleanup

If you want to clean specific data without a full reset:

1. Open Supabase Studio: `npm run docker:studio` (opens http://localhost:54323)
2. Navigate to the Table Editor
3. Manually delete rows from specific tables

### Reset Docker Completely

If Docker containers are corrupted:

```bash
# Stop and remove all Supabase containers
npm run docker:clean

# This runs: supabase stop --no-backup && docker system prune -f

# Start fresh
npm run setup
```

---

## Security Considerations

### Demo Mode is NOT a Security Boundary

Demo mode provides:
- UI convenience (quick-login buttons)
- Accidental deletion prevention
- Clean demo experience

Demo mode does NOT provide:
- Database isolation
- User authentication bypass prevention
- API security (beyond blocking specific endpoints)

For true security, use:
- Row Level Security (RLS) policies (always enabled)
- Proper authentication and authorization
- The standard login flow (non-demo mode) for production

### Local Docker Data

Local Docker volumes are not backed up. If you prune Docker volumes or reset, all data is lost. This is expected for a development/demo environment.

---

## Technical Implementation

### Key Files

| File | Purpose |
|------|---------|
| `lib/demo-mode.ts` | Core demo mode logic and configuration |
| `lib/api-demo-guard.ts` | API route protection |
| `components/demo-login-form.tsx` | Quick-login UI component |
| `scripts/start-demo.js` | Smart startup script |
| `scripts/create-seed-users.ts` | Dev utility to create demo users (not run by npm scripts) |

### Environment Variables

| Variable | Purpose | Values |
|----------|---------|--------|
| `NEXT_PUBLIC_DEMO_MODE` | Enable demo mode UI | `true` / `false` |
| `DEMO_MODE` | Server-side demo check (fallback) | `true` / `false` |

Note: `NEXT_PUBLIC_` prefix makes the variable available in browser code.

### Two Ways to Enable Demo Mode

**Option 1: Via `npm run dev:demo`**
- Sets `NEXT_PUBLIC_DEMO_MODE=true` at runtime
- Also starts Supabase containers automatically
- Includes safety checks

**Option 2: Via `.env.local`**
- Add `NEXT_PUBLIC_DEMO_MODE=true` to your `.env.local`
- Run `npm run dev` normally
- Supabase must already be running

Both methods produce identical behavior.

### How Demo Mode Works

1. **Client-side detection:**
   ```typescript
   import { isDemoMode } from '@/lib/demo-mode';

   if (isDemoMode()) {
     // Show demo UI
   }
   ```

2. **Blocking actions (client):**
   ```typescript
   import { isActionBlocked, getBlockedActionMessage } from '@/lib/demo-mode';

   if (isActionBlocked('delete_project')) {
     toast.error(getBlockedActionMessage('delete_project'));
     return;
   }
   ```

3. **Blocking actions (API):**
   ```typescript
   import { checkDemoModeForDestructiveAction } from '@/lib/api-demo-guard';

   export async function DELETE(request: NextRequest) {
     const blocked = checkDemoModeForDestructiveAction('delete_project');
     if (blocked) return blocked;

     // Continue with delete...
   }
   ```

### Adding New Blocked Actions

1. Add the action type to `lib/demo-mode.ts`:
   ```typescript
   export type BlockedAction =
     | 'delete_account'
     | 'your_new_action'  // Add here
     // ...
   ```

2. Add the message:
   ```typescript
   const BLOCKED_MESSAGES: Record<BlockedAction, string> = {
     your_new_action: 'This action is disabled in demo mode.',
     // ...
   };
   ```

3. Use in your component or API route.

---

## Troubleshooting

### Docker Won't Start

**Error:** `Docker is not running!`

**Solution:**
1. Open Docker Desktop
2. Wait for it to fully start (check the whale icon in system tray)
3. Try again: `npm run dev:demo`

### Port Already in Use

**Error:** `Port 54321 is already in use`

**Solution:**
```bash
# Stop any existing Supabase
npm run docker:stop

# If that doesn't work, force stop all containers
docker stop $(docker ps -q)

# Try again
npm run dev:demo
```

### Demo Mode Not Working

**Symptoms:** Delete buttons still visible, normal login shown

**Check:**
1. Verify `NEXT_PUBLIC_DEMO_MODE=true` is set in `.env.local` OR you're using `npm run dev:demo`
2. Restart the dev server (the env var is read at startup)
3. Clear browser cache / hard refresh (Ctrl+Shift+R)
4. Check browser console for errors

### No Demo Users Available

**Symptoms:** Quick-login buttons show but no users exist to log in as

**Solution:** Create demo users manually:
```bash
npx tsx scripts/create-seed-users.ts
```

### Login Page Stuck on "Checking authentication..."

**Solutions:**
1. Verify Supabase is running: `npx supabase status`
2. Check the Supabase API: `curl http://127.0.0.1:54321/rest/v1/`
3. Clear `.next` cache: `rm -rf .next && npm run dev`
4. Check for JavaScript errors in browser console

---

## FAQ

### Can demo users create data?

Yes! Demo users can create projects, tasks, log time, etc. They just can't delete data. This allows users to fully experience the platform.

### Is demo data persistent?

Yes, data persists in Docker volumes until you run `npm run docker:reset`.

### Can I customize demo users?

Yes, edit `lib/demo-mode.ts` to change:
- User list and roles
- Colors and descriptions
- Which actions are blocked

### How do I add more demo data?

Run `npx tsx scripts/create-seed-users.ts` to create demo users. For additional data (projects, tasks, etc.), use the application UI or insert data via Supabase Studio.

### What happens if I disable demo mode locally?

You'll have full access to delete data, access superadmin features, etc. But it's the SAME database -- there's no separate "local production" database.

---

## Need Help?

- **Discord:** [Join the MovaLab community](https://discord.gg/99SpYzNbcu)
- **GitHub Issues:** [Report bugs or request features](https://github.com/itigges22/MovaLab/issues)
- **Documentation:** Check `CLAUDE.md` for comprehensive technical docs
