# MovaLab Setup Guide

Complete guide to set up MovaLab from scratch. Two paths available: **Local Docker** (recommended for development) or **Cloud** (Supabase + Vercel for production).

---

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Docker Desktop** — [docker.com](https://www.docker.com/products/docker-desktop) (for local setup)
- **Git** — [git-scm.com](https://git-scm.com)

Verify:
```bash
node --version    # v18+ required
docker --version  # any recent version
git --version
```

---

## 1. Clone & Install

```bash
git clone https://github.com/itigges22/movalab.git
cd movalab
npm install
```

---

## 2. Environment Configuration

```bash
cp .env.local.template .env.local
```

The template has Docker defaults pre-filled. For cloud, you'll edit it later.

**Key variables:**

| Variable | Local Docker | Cloud |
|----------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` (default) | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Pre-filled default key | Your project's anon/public key |
| `NEXT_PUBLIC_DEMO_MODE` | `true` (optional, enables quick-login) | `false` or omit |
| `SETUP_SECRET` | Not needed (seed data creates admin) | Generate with `openssl rand -hex 32` |

> **Security:** Never use `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Always use `PUBLISHABLE_DEFAULT_KEY`. The anon key bypasses Row Level Security.

---

## 3A. Local Setup (Docker) — Recommended

### Automated Setup

**macOS / Linux / Git Bash (Windows):**
```bash
./scripts/first-time-setup.sh
```

**Windows Command Prompt / PowerShell:**
```cmd
scripts\first-time-setup.bat
```

This script:
1. Checks prerequisites (Node, Docker, Supabase CLI)
2. Starts Supabase containers (PostgreSQL, Auth, Storage, Studio)
3. Runs all database migrations (creates 42+ tables with RLS policies)
4. Loads seed data (test users, departments, roles, projects, workflows)
5. Verifies everything is healthy

### Manual Setup (if script fails)

```bash
# Start Supabase
npx supabase start

# Apply migrations
npx supabase db reset

# Seed test data
npx tsx scripts/create-seed-users.ts
```

### Start Development

```bash
npm run dev
```

Open http://localhost:3000

### Test Accounts

All accounts use password: **`Test1234!`**

| Email | Role | What you can test |
|-------|------|-------------------|
| `superadmin@test.local` | Superadmin | Full system access, all admin features |
| `exec@test.local` | Executive Director | Leadership dashboards, analytics |
| `manager@test.local` | Account Manager | Account/project management |
| `pm@test.local` | Project Manager | Project coordination, task management |
| `designer@test.local` | Senior Designer | Task execution, time tracking |
| `dev@test.local` | Senior Developer | Technical tasks, capacity |
| `contributor@test.local` | Contributor | Limited access, 20 hrs/week |
| `client@test.local` | Client | Client portal view |

### Demo Mode

To enable quick-login buttons (no typing passwords):

```bash
npm run dev:demo
```

This starts Docker + seeds data + enables `NEXT_PUBLIC_DEMO_MODE=true` automatically.

### Useful Docker Commands

```bash
npm run docker:start       # Start Supabase containers
npm run docker:stop        # Stop containers
npm run docker:reset       # Reset database + re-run migrations
npm run docker:seed        # Reset + create seed users
npm run docker:studio      # Open Supabase Studio (localhost:54323)
npm run docker:health      # Verify setup
npm run docker:clean       # Remove all containers
```

---

## 3B. Cloud Setup (Supabase + Vercel)

### Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New Project**
3. Set a name, strong database password, and closest region
4. Wait for provisioning (~5 minutes)

### Get Credentials

1. Go to **Project Settings > API**
2. Copy **Project URL** (e.g., `https://abcdefg.supabase.co`)
3. Copy **anon/public key** (this is your publishable key)
4. Note your **project ref** from the dashboard URL

### Push Database Schema

```bash
npx supabase login          # Opens browser to authenticate
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push        # Applies all migrations
```

### Update Environment

Edit `.env.local` with your cloud credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-anon-public-key
SETUP_SECRET=your-generated-secret    # openssl rand -hex 32
```

### Deploy to Vercel

1. Push your repo to GitHub
2. Import in [vercel.com/new](https://vercel.com/new)
3. Add environment variables in Vercel project settings
4. Deploy

### Create First Superadmin

1. Visit your deployed app and click **Sign Up**
2. Create an account with your email
3. Navigate to: `https://your-app.vercel.app/setup?key=YOUR_SETUP_SECRET`
4. Click **Become Superadmin**
5. You now have full admin access

> After the first superadmin is created, the setup page permanently shows "Setup Complete" and cannot be used again.

---

## 4. First Steps as Superadmin

Once logged in as superadmin, here's the recommended setup order:

### Step 1: Create Departments

Go to **Departments** (sidebar) > **Create Department**

Departments are organizational groups. Common examples:
- Design, Development, Marketing, Operations, Leadership

### Step 2: Create Roles

Go to **Admin > Role Management** > **Create Role**

Each role belongs to a department and has a set of permissions. For each role:
1. Set a **name** and **department**
2. Set **hierarchy level** (100 = highest, 1 = lowest)
3. Set **reporting role** (who this role reports to)
4. Configure **permissions** (see Permission Reference below)

### Step 3: Create Accounts (Clients)

Go to **Accounts** > **Create Account**

Accounts represent your clients. Set:
- Account name, description
- Primary contact info
- Account manager (assign a user)
- Service tier (basic/premium/enterprise)

### Step 4: Invite Team Members

Team members sign up at `/signup`. After signup they land on a **Pending Approval** page.

To approve:
1. Go to **Admin > Role Management** (or the pending users notification)
2. View pending registrations
3. Approve users and assign them a role

### Step 5: Create Projects

Go to **Projects** > **Create Project**

Each project belongs to an account. Set:
- Name, description, account
- Priority, dates, estimated hours
- Assign team members

### Step 6: Set Up Workflows (Optional)

Go to **Admin > Workflows** > **Create Workflow**

Build visual workflows with drag-and-drop nodes:
- **Start** — entry point
- **Role** — assign to a role (e.g., Designer, Developer)
- **Approval** — requires approve/reject decision
- **Form** — collect structured data
- **Conditional** — branch based on conditions
- **End** — completion point

Attach workflows to projects to track handoffs between teams.

---

## 5. Permission Reference

Permissions are grouped by category. Assign them to roles via **Admin > Role Management > Edit Role**.

### Role Management
| Permission | Description |
|-----------|-------------|
| Manage User Roles | Create/edit/delete roles, assign users, approve registrations |
| Manage Users | View, edit, and delete user accounts |

### Department Management
| Permission | Description |
|-----------|-------------|
| Manage Departments | Create, edit, and delete departments |
| View Departments | View departments user belongs to |
| View All Departments | Override: view all departments |

### Account Management
| Permission | Description |
|-----------|-------------|
| Manage Accounts | Create, edit, and delete accounts |
| Manage Account Users | Add/remove users from accounts |
| View Accounts | View accounts user has access to |
| View All Accounts | Override: view all accounts |

### Project Management
| Permission | Description |
|-----------|-------------|
| Manage Projects | Create, edit, delete projects in assigned accounts |
| View Projects | View assigned projects |
| View All Projects | Override: view all projects |
| Manage All Projects | Override: edit any project |

### Analytics
| Permission | Description |
|-----------|-------------|
| View All Department Analytics | See analytics for entire department |
| View All Account Analytics | See analytics for entire account |
| View All Analytics | Override: organization-wide analytics |

### Capacity & Time
| Permission | Description |
|-----------|-------------|
| Edit Own Availability | Set personal weekly availability |
| View Team Capacity | See team/department capacity |
| View All Capacity | Override: organization-wide capacity |
| Manage Time | Log and edit own time entries |
| View All Time Entries | Override: see all time entries (admin) |

### Workflows
| Permission | Description |
|-----------|-------------|
| Manage Workflows | Create, edit, delete workflow templates |
| Execute Workflows | Hand off work in assigned workflow steps |
| Skip Workflow Nodes | Hand off out-of-order (admin only) |

### Client Portal
| Permission | Description |
|-----------|-------------|
| Manage Client Invitations | Send client invites, view feedback |

### How Permissions Work

Permissions are evaluated in this order:

1. **Superadmin?** — full access to everything, always
2. **Override permission?** (e.g., `View All Projects`) — global access regardless of assignment
3. **Base permission + context?** (e.g., `View Projects` + assigned to that project) — access only if both conditions are true
4. **Deny** — no access

---

## 6. Project Structure

```
movalab/
  app/                    # Next.js App Router pages
    (main)/               # Layout group (sidebar + auth)
      admin/              # Admin pages (workflows, client portal, feedback)
    api/                  # API routes (REST endpoints)
    dashboard/            # Main dashboard
    projects/             # Project list + detail
    accounts/             # Account management
    departments/          # Department views
    admin/                # Admin tools (roles, time tracking, database, RBAC)
    analytics/            # Analytics dashboards
    capacity/             # Capacity management
    time-entries/         # Personal time tracking
    profile/              # User profile
    login/ signup/ setup/ # Auth flows
  components/             # React components
    ui/                   # shadcn/ui primitives
    dashboard/            # Dashboard widgets
    org-chart/            # Org chart components
    workflow-editor/      # Workflow builder components
    sidebar/              # Navigation sidebar
  lib/                    # Business logic & utilities
    permissions.ts        # Permission enum definitions
    permission-checker.ts # Permission evaluation engine
    rbac.ts               # RBAC helper functions
    supabase.ts           # Client-side Supabase client
    supabase-server.ts    # Server-side Supabase clients
    services/             # Service layer (capacity, time, availability)
  supabase/
    migrations/           # Database schema (SQL)
    seed.sql              # Test data
    config.toml           # Docker service configuration
  scripts/                # Setup & utility scripts
  docs/                   # Documentation
```

---

## 7. Troubleshooting

**"Database connection failed"**
- Check `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `PUBLISHABLE_DEFAULT_KEY`
- For Docker: verify containers are running with `docker ps`
- Run `npm run docker:health` to diagnose

**"Unauthorized" on all pages**
- Clear browser cookies for localhost
- Check that Supabase Auth is running: `curl http://127.0.0.1:54321/auth/v1/health`

**Docker containers won't start**
- Make sure Docker Desktop is running
- Try `docker system prune` to clean up, then `npm run docker:start`
- Check port conflicts (54321, 54322, 54323)

**Migrations fail**
- Run `npx supabase db reset` to start fresh
- Check `supabase/migrations/` for syntax errors

**Test users can't login**
- Seed data may not have loaded. Run `npm run docker:seed`
- Password for all test users: `Test1234!`

**Build errors**
- Run `npm install` to ensure all dependencies are installed
- Check Node.js version: `node --version` (must be 18+)
- Run `npm run build` to see specific errors

---

## 8. Useful Links

- **Supabase Studio** (local): http://localhost:54323
- **Email Testing** (local): http://localhost:54324 (catches signup confirmation emails)
- **Discord**: [discord.gg/99SpYzNbcu](https://discord.gg/99SpYzNbcu)
- **GitHub Issues**: [github.com/itigges22/movalab/issues](https://github.com/itigges22/movalab/issues)
