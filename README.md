# MovaLab

**Professional Services Automation for the Modern Agency**

MovaLab is a cloud-based platform that consolidates agency operations into a single, intelligent system. Built for marketing agencies, creative studios, and consulting firms with 5-50 employees who are tired of juggling Monday.com, Notion, Harvest, Float, and spreadsheets just to answer "do we have capacity for this project?"

Originally developed for a student-run marketing agency managing 11 client accounts across 8 departments with 60+ members, MovaLab replaces what used to require Basecamp, Monday.com, Notion, MS Planner, and Slack with a single unified system.

**[Try the Live Demo](https://demo.movalab.dev)** | **[Visit movalab.dev](https://movalab.dev)**

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js&labelColor=aliceblue&color=bbd3dd&logoColor=%23000000)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=TypeScript&labelColor=aliceblue&color=bbd3dd)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=for-the-badge&logo=Supabase&labelColor=aliceblue&color=bbd3dd)
[![Discord](https://img.shields.io/discord/1450515917724188757?style=for-the-badge&logo=discord&label=Join%20Our%20Discord!&labelColor=aliceblue&color=bbd3dd)](https://discord.gg/99SpYzNbcu)

---

## 🎯 The Problem

Professional services organizations struggle with:

- **Tool fragmentation** — Projects in Monday.com, time in Toggl, communication in Slack, capacity in spreadsheets
- **Lack of visibility** — Can't answer "who's overloaded?" or "do we have capacity?" without hours of investigation
- **Organizational chaos** — Team rotations, unclear accountability, tribal knowledge lost when people leave
- **Client communication** — "Any updates?" emails because clients have no visibility into progress
- **Ignored SOPs** — 30-page PDFs that no one reads, informal workflows, inconsistent quality

The result? Burnout, missed deadlines, over-commitment, and margins that erode with every project.

## 💡 The Solution

MovaLab replaces your fragmented tool stack with one unified platform:

| What You Have Now | What MovaLab Provides |
|-------------------|----------------------|
| Monday/Asana/Basecamp | Project & task management (Kanban, Gantt, Table views) |
| Harvest/Toggl | Time tracking (clock in/out + manual entry) |
| Float/spreadsheets | Real-time capacity planning with proportional allocation |
| Static SOP documents | Visual workflow builder with enforced handoffs |
| Slack status updates | Automated project visibility for clients and leadership |

**One platform. One source of truth. 40-60% reduction in software costs.**

---

## ✨ Core Features

### 📊 Intelligent Capacity Planning
- **Proportional allocation** — Users on 3 accounts split their 40 hrs/week capacity proportionally (13.3 hrs each)
- **Real-time utilization** — Track individual, department, and organization-wide capacity
- **Multi-level analytics** — Individual → Department → Account → Organization views
- **Prevents over-commitment** — Know if you can take new work before saying yes

### 🔄 Visual Workflow Automation
- **Drag-and-drop workflow builder** — Transform SOPs into visual, enforceable workflows
- **Node types** — Department handoffs, role assignments, client approvals, conditional branches
- **Complete audit trail** — Track every transition, handoff, and approval
- **Guardrails, not handcuffs** — Structure that guides without being rigid

### ⏱️ Flexible Time Tracking
- **Clock in/out** — Start timer, work, allocate hours across tasks when done
- **Manual entry** — Log hours directly on specific tasks
- **Auto clock-out** — Sessions auto-close after 16 hours (prevents forgotten sessions)
- **User dashboard** — View, filter, and analyze logged time with charts and 14-day edit window

### 👥 Dynamic Permissions
- **~40 consolidated permissions** across 15 categories (reduced from 136 via RBAC refactoring)
- **Context-aware access** — Permissions adapt based on project assignments and account management
- **Row Level Security** — Data access controlled at PostgreSQL level, not just application logic
- **Hierarchical reporting** — Clear chains of accountability

### 📈 Multiple Task Views
- **Kanban boards** — Drag-and-drop task management (To Do → In Progress → Review → Done)
- **Gantt charts** — Timeline visualization with dependencies and critical paths
- **Table views** — Sortable, filterable lists for bulk updates
- **Workflow views** — Track projects through custom approval workflows
- **Analytics dashboards** — Performance metrics, resource allocation, project health

### 🤝 Client Portal
- **Project visibility** — Clients see real-time progress without pestering your team
- **Built-in approvals** — Review, approve, or request revisions directly
- **Feedback collection** — Post-project satisfaction scoring and insights
- **Secure isolation** — Clients see only their own projects (RLS enforced)

---

## 🛠️ Tech Stack

**Modern & Scalable**
- Next.js 15 (App Router) + React Server Components
- TypeScript for type safety
- Supabase (PostgreSQL + Row Level Security)
- Tailwind CSS + shadcn/ui
- Recharts for analytics

**Security-First**
- Row Level Security on every table
- ~40 consolidated permissions (MANAGE pattern)
- Rate limiting (Upstash Redis)
- Input validation (Zod schemas)
- Audit logging for critical changes
- HTTP-only cookies, security headers

---

## 🚀 Quick Setup (Local Development)

> **✨ Zero-configuration Docker setup!** No cloud accounts needed. Everything runs locally.
>
> 📚 **First time?** See our [Complete Setup Guide](CONTRIBUTING.md#one-command-setup) for detailed instructions.

### Prerequisites

Before you begin, ensure you have:

- ✅ **Node.js 18.0+** ([Download](https://nodejs.org/))
- ✅ **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop)) - Must be running
- ✅ **Docker Hub Account** (Recommended) - [Create free account](https://hub.docker.com/signup) to avoid rate limits
- ✅ **Windows users:** Git Bash (included with [Git for Windows](https://gitforwindows.org/)) or [WSL2](https://docs.microsoft.com/en-us/windows/wsl/install)
- ⏱️ **5 minutes** setup time

> **💡 Important:** Authenticate with Docker Hub to avoid rate limit errors:
> ```bash
> docker login
> ```
> This increases pull limits from 100 to 200 per 6 hours and prevents "Rate exceeded" errors during setup.

### One-Command Setup

**macOS / Linux:**
```bash
git clone https://github.com/itigges22/movalab.git
cd movalab
./scripts/first-time-setup.sh
```

**Windows - Choose Your Terminal:**

<details>
<summary><strong>📘 Git Bash</strong> (Recommended for Windows)</summary>

```bash
# In Git Bash terminal:
git clone https://github.com/itigges22/movalab.git
cd movalab
./scripts/first-time-setup.sh
```
</details>

<details>
<summary><strong>💻 Command Prompt (CMD)</strong></summary>

```cmd
REM In Command Prompt:
git clone https://github.com/itigges22/movalab.git
cd movalab
scripts\first-time-setup.bat
```
</details>

<details>
<summary><strong>⚡ PowerShell</strong></summary>

```powershell
# In PowerShell:
git clone https://github.com/itigges22/movalab.git
cd movalab
scripts\first-time-setup.bat
```
</details>

> **💡 Windows Tip:** All three terminals work! Use whichever you're comfortable with. The `.bat` file automatically finds Git Bash and runs the setup.

**That's it!** The script automatically:
- ✅ Checks all prerequisites (Node, Docker, Supabase CLI)
- ✅ Installs dependencies
- ✅ Starts local Supabase (PostgreSQL + Auth + Storage + Studio)
- ✅ Applies database migrations (42+ tables with RLS policies)
- ✅ Loads seed data (8 test users, 3 accounts, 6 projects, 20 tasks)
- ✅ Runs health checks and verifies everything works

**Setup Flow:**
```
1. Clone repo → 2. Run script → 3. Script validates prerequisites →
4. Starts Docker → 5. Runs migrations → 6. Creates test data →
7. Health check ✅ → 8. Ready to code! 🚀
```

### Start Developing

```bash
npm run dev              # Start Next.js dev server
```

Open [http://localhost:3000](http://localhost:3000) and login:
- **Email:** `superadmin@test.local`
- **Password:** `Test1234!`

---

### 🆘 Need Help?

**Having trouble?** We've got you covered:

- 📖 **[Detailed Setup Guide](CONTRIBUTING.md#development-setup)** - Step-by-step with screenshots
- 🔧 **[Troubleshooting Guide](docs/implementation/TESTING-REPORT.md#troubleshooting)** - Common issues and solutions
- 🔄 **[Environment Switching](docs/implementation/ENVIRONMENT-SWITCHING.md)** - Switch between local Docker and cloud Supabase
- 💬 **[Discord Community](https://discord.gg/99SpYzNbcu)** - Get help from other users

**Quick fixes:**
```bash
docker login            # Authenticate to avoid rate limits (do this first!)
npm run docker:health   # Check if everything is working
npm run docker:reset    # Reset database if something went wrong
```

**Common Issues:**

<details>
<summary><strong>"Rate exceeded" error during Docker pull</strong></summary>

**Problem:** Docker Hub rate limit hit (100 pulls per 6 hours for anonymous users)

**Solution:**
```bash
# Authenticate with Docker Hub (increases limit to 200/6hrs)
docker login

# Then restart the setup
npx supabase stop
./scripts/first-time-setup.sh
```

**OR wait 6 hours** for the rate limit to reset.

[More details](https://github.com/supabase/cli/issues/419)
</details>

<details>
<summary><strong>"stdout is not a tty" error on Windows</strong></summary>

**Problem:** Running bash script from PowerShell or CMD without proper terminal

**Solution:** Use the batch file instead:
```cmd
scripts\first-time-setup.bat
```

Or open Git Bash and run:
```bash
./scripts/first-time-setup.sh
```
</details>

### Test User Accounts

All test users have password: `Test1234!`

| Email | Role | Purpose |
|-------|------|---------|
| `superadmin@test.local` | Superadmin | Full system access |
| `exec@test.local` | Executive Director | Leadership, org-wide access |
| `manager@test.local` | Account Manager | Multi-account oversight |
| `pm@test.local` | Project Manager | Project coordination |
| `designer@test.local` | Senior Designer | Creative work |
| `dev@test.local` | Senior Developer | Technical implementation |
| `contributor@test.local` | Contributor | Part-time contributor (20 hrs/week) |
| `client@test.local` | Client | Client portal access |

### Docker Commands

```bash
npm run docker:start      # Start Supabase services
npm run docker:stop       # Stop Supabase (preserves data)
npm run docker:reset      # Reset database and re-run migrations
npm run docker:seed       # Reset database + create seed users
npm run docker:studio     # Open Supabase Studio (database UI)
npm run docker:health     # Verify setup
```

### Service URLs

- **App:** http://localhost:3000
- **Supabase Studio:** http://localhost:54323 (database UI)
- **API:** http://localhost:54321
- **PostgreSQL:** localhost:54322

---

## 🌐 Cloud Setup (Production)

For deploying to production with cloud Supabase:

### Prerequisites
- Node.js 18.0+
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (`npm install -g supabase`)
- Supabase account ([free tier works](https://supabase.com))
- Vercel/Netlify account (optional, for hosting)

### Setup Steps

1. **Clone and Install**
   ```bash
   git clone https://github.com/itigges22/movalab.git
   cd movalab
   npm install
   ```

2. **Create Supabase Project**
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
   - Choose a name, set a database password, pick a region
   - Wait for the project to finish provisioning

3. **Find Your Credentials** (in the Supabase Dashboard)
   - Go to **Project Settings** → **API**
   - Copy the **Project URL** (e.g., `https://abcdefg.supabase.co`)
   - Copy the **anon/public key** (this is your publishable key)
   - Copy the **Project Reference** from the URL: `https://supabase.com/dashboard/project/<project-ref>`

4. **Push Database Schema**
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```
   This applies all migrations (42+ tables, RLS policies, functions) to your cloud database.

5. **Generate a Setup Secret**
   ```bash
   openssl rand -hex 32
   ```
   Save this value — you'll need it in the next step and during first-time setup.

6. **Environment Configuration**

   Copy the template and fill in your values:
   ```bash
   cp .env.local.template .env.local
   ```

   Edit `.env.local` — comment out the local Docker section and uncomment the cloud section:
   ```env
   # Supabase (Required)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-anon-public-key

   # First-Time Setup (Required for initial superadmin creation)
   SETUP_SECRET=your-generated-secret-from-step-5
   ```

   > **For Vercel:** Add these same variables in your Vercel project's **Settings → Environment Variables**.

7. **Launch**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

### Initial Setup (First-Time Only)

1. **Sign Up** — Create an account at `/signup` with your email
2. **Become Superadmin** — Navigate to `/setup?key=YOUR_SETUP_SECRET` and enter your secret key
3. **Build Organization** — Create departments and roles via Admin → Roles
4. **Invite Team** — Members sign up, you approve via Admin → Pending Users
5. **Set Capacity** — Users set weekly availability in their profile
6. **Create Accounts** — Add client accounts and start managing projects

> **Detailed guide:** See [docs/setup/FIRST_TIME_SETUP.md](docs/setup/FIRST_TIME_SETUP.md) for the complete walkthrough with troubleshooting.

---

## 📁 Project Structure

```
MovaLab/
├── app/                    # Next.js App Router
│   ├── accounts/          # Client account management
│   ├── projects/          # Project detail pages
│   ├── capacity/          # Capacity planning
│   ├── analytics/         # Analytics & reporting
│   ├── admin/             # Admin pages
│   ├── time-entries/      # User time tracking dashboard
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui base components
│   ├── kanban-*.tsx      # Kanban boards
│   ├── gantt-chart.tsx   # Gantt visualization
│   ├── capacity-*.tsx    # Capacity planning
│   └── workflow-*.tsx    # Workflow builder
├── lib/                   # Business logic & utilities
│   ├── *-service.ts      # Service layer (encapsulates business logic)
│   ├── permissions.ts    # ~40 permission definitions
│   ├── rbac.ts           # Permission checking logic
│   └── supabase-*.ts     # Supabase client configs
├── types/                 # TypeScript definitions
└── docs/                  # Documentation
    ├── architecture/FEATURELIST.md
    └── security/SECURITY.md
```

---

## 🔍 Why MovaLab vs Alternatives

| Feature | MovaLab | Basecamp | Monday.com | Notion |
|---------|---------|----------|------------|--------|
| **Capacity Planning** | ✅ Built-in, proportional | ❌ None | 🟡 Add-on only | ❌ Manual formulas |
| **Time Tracking** | ✅ Clock + manual entry | ❌ None | 🟡 Basic | ❌ Manual only |
| **Context Permissions** | ✅ Assignment-based | ❌ Basic | 🟡 Board-based | ❌ Page-based |
| **Dynamic Departments** | ✅ Derived from work | ❌ Static | ❌ Static | ❌ Static |
| **Workflow Automation** | ✅ Visual builder | ❌ None | 🟡 Limited | ❌ None |
| **Client Portal** | ✅ Built-in | ❌ None | 🟡 Separate product | ❌ None |
| **RLS Security** | ✅ Database-level | ❌ App-level | ❌ App-level | ❌ App-level |
| **Single Source of Truth** | ✅ Yes | ❌ No | ❌ No | ❌ No |

**MovaLab Advantage:** Purpose-built for professional services with integrated capacity planning, sophisticated permissions, and real-time visibility across all work.

---

## 📊 Key Metrics

### Available Hours
Total team capacity proportionally split across assigned accounts. Prevents over-counting when people work on multiple clients.

### Allocated Hours
Future commitments based on task estimates. Shows if you're over-committing before work begins.

### Actual Hours
Real logged time — the ground truth of work performed. What you bill and what actually happened.

### Utilization
`(Actual ÷ Available) × 100`
- **60-80%** — Healthy with buffer
- **80-95%** — High productivity
- **95-110%** — Risk of burnout
- **>110%** — Critical, redistribute immediately

---

## 🎯 Perfect for Small Creative Agencies

MovaLab is purpose-built for agencies where:
- Teams wear multiple hats across several clients
- Capacity is tight and over-commitment kills margins
- Turnover means knowledge walks out the door
- Enterprise tools are overkill (and overpriced)
- You need structure without bureaucracy

**Agency-Friendly Features:**
- Single source of truth across all client work
- Proportional capacity planning that actually works
- Workflows that enforce quality without slowing you down
- Client portal that eliminates status update emails
- Enterprise-grade security at SMB-friendly pricing

---

## 🚀 Roadmap

### Near-Term (Q1-Q2 2025)

**Analytics & Insights**
- Project health scoring and risk indicators
- Workflow analytics (completion times, bottleneck identification)
- Team wellbeing dashboard for leadership
- Enhanced capacity forecasting

**Client & Account Enhancements**
- Full client dashboard with project visibility
- External data source integrations (social media analytics per account)
- Strategic plans tied to accounts and projects
- Client feedback improvements

### Mid-Term (Q3-Q4 2025)

**Revenue & Business Operations**
- Service offerings library (tied to workflow templates)
- Proposals and estimates
- Bill of materials / project budgeting
- QuickBooks and/or Stripe integration for revenue tracking

**Collaboration Analytics**
- Network visualizations (who collaborates with whom)
- Department collaboration mapping
- Cross-account team insights

**CRM Functions**
- New client outreach tracking
- Pipeline management for prospects
- Lead-to-account conversion

### Long-Term (2026+)

**Platform Maturity**
- Executive analytics dashboard / leadership intelligence hub
- Full mobile compatibility
- Performance recognition system (achievements, badges, tiers)
- Advanced reporting and custom dashboards

*Roadmap priorities may shift based on user feedback and design partner needs.*

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

MovaLab was originally developed in partnership with PRISM, a faculty-led, student-run marketing agency at Virginia Tech managing 11 client accounts with 60+ team members. It's designed to be adaptable for any professional services organization.

For feature requests, bug reports, or questions about adapting MovaLab for your organization, please open an issue on GitHub or join our [Discord community](https://discord.gg/99SpYzNbcu).

---

## 🆘 Support & Documentation

### Live Sites

- 🌐 **[movalab.dev](https://movalab.dev)** - Main website and documentation
- 🎮 **[demo.movalab.dev](https://demo.movalab.dev)** - Interactive demo (no signup required!)

### Getting Started Guides

- 📘 **[Contributing Guide](CONTRIBUTING.md)** - Complete setup walkthrough (START HERE!)
- 🎮 **[Demo Mode Guide](docs/setup/DEMO_MODE.md)** - Running demos locally and in the cloud
- 🐳 **[Docker Setup](docs/setup/docker-setup.md)** - Local development with Docker
- 🚀 **[First Time Setup](docs/setup/FIRST_TIME_SETUP.md)** - Cloud deployment guide
- 🔄 **[Environment Switching](docs/implementation/ENVIRONMENT-SWITCHING.md)** - Local Docker ↔ Cloud Supabase

### Technical Documentation

- 💻 **[Developer Guide](CLAUDE.md)** - Comprehensive development documentation
- 📋 **[Feature List](docs/implementation/00-INDEX.md)** - Complete feature catalog
- 🗄️ **[Database Schema](supabase/migrations/README.md)** - Migration guide and database structure
- 🔒 **[Security Guide](docs/security/SECURITY.md)** - Security architecture and best practices
- 📚 **[All Documentation](docs/README.md)** - Full documentation index

### Get Help

- 💬 **[Discord Community](https://discord.gg/99SpYzNbcu)** - Chat with other users and maintainers
- 🐛 **[GitHub Issues](https://github.com/itigges22/movalab/issues)** - Report bugs or request features
- 📧 **Email Support** - For private inquiries

---

## 📄 License

MovaLab is licensed under the **Sustainable Use License**.

**You can:**
- Use MovaLab for your agency's internal operations
- Self-host for your own business
- Modify the code for your internal use
- Offer consulting services helping others implement MovaLab

**You cannot:**
- Host MovaLab as a paid service for others
- Resell or white-label MovaLab
- Embed MovaLab in a commercial product

This is a "fair-code" license similar to n8n and other source-available projects. It protects against commercial exploitation while allowing agencies to use and benefit from the platform.

See [LICENSE](LICENSE) for complete terms.

---

**Built for agencies who believe operational excellence — not just creative excellence — drives profitability.**

*MovaLab: Because your team deserves better than spreadsheet chaos and Slack pandemonium.*
