# Contributing to MovaLab

Thank you for your interest in contributing to MovaLab! This document provides guidelines for contributing to the project.

## Ways to Contribute

- **Bug Reports**: Found something broken? Open an issue with details
- **Feature Requests**: Have an idea? We'd love to hear it
- **Code Contributions**: Fix bugs or implement new features
- **Documentation**: Improve docs, fix typos, add examples
- **Testing**: Help test new features and report issues

## Development Setup

> Everything runs locally with Docker -- no cloud accounts required.

### Prerequisites

- **Node.js 18.0+** ([Download](https://nodejs.org/))
- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- **Docker Hub Account** (Recommended) -- [Create free account](https://hub.docker.com/signup)
- **Git**
- **Windows users:** Git Bash (included with [Git for Windows](https://gitforwindows.org/)) or [WSL2](https://docs.microsoft.com/en-us/windows/wsl/install)

That's it! No Supabase account, no cloud setup, no credentials management.

> **Docker Authentication (Recommended):** Authenticate with Docker Hub to avoid rate limit errors:
> ```bash
> docker login
> ```
> **Why?** Anonymous users: 100 pulls/6hrs. Authenticated users: 200 pulls/6hrs. This prevents "Rate exceeded" errors during setup.

> **Windows Note:** The setup script requires bash. Use Git Bash (recommended) or WSL2. Open Git Bash and run `./scripts/first-time-setup.sh`

### One-Command Setup

1. **Fork the repository** on GitHub: https://github.com/itigges22/MovaLab.git

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/MovaLab.git
   cd MovaLab
   ```

3. **Run the setup script**

   **macOS / Linux:**
   ```bash
   npm run setup
   ```

   **Windows - Choose Your Terminal:**

   <details>
   <summary><strong>Git Bash</strong> (Recommended)</summary>

   ```bash
   # In Git Bash terminal:
   npm run setup
   ```
   </details>

   <details>
   <summary><strong>Command Prompt (CMD)</strong></summary>

   ```cmd
   REM In Command Prompt:
   scripts\first-time-setup.bat
   ```
   </details>

   <details>
   <summary><strong>PowerShell</strong></summary>

   ```powershell
   # In PowerShell:
   scripts\first-time-setup.bat
   ```
   </details>

   > **Windows Tip:** All three terminals work! The `.bat` file automatically finds Git Bash and runs the setup.

   This script will automatically:
   - Verify Node.js and Docker are installed
   - Install Supabase CLI (if needed)
   - Install npm dependencies
   - Create `.env.local` from template
   - Start local Supabase with Docker
   - Apply all 7 database migrations
   - Load seed data (3 system roles only -- clean slate)

4. **Start developing**
   ```bash
   npm run dev
   ```

5. **Open** [http://localhost:3000](http://localhost:3000)

### First-Run Onboarding

On first launch, the app redirects to `/onboarding` where a setup wizard guides you through creating the first **superadmin** account. Check the terminal output for the one-time setup token.

After the superadmin is created, you can:
- Create departments and roles via Admin > Roles
- Invite team members via the invitation system (Admin > Invite Users)
- Invitation emails are captured by Inbucket at http://localhost:54324

## Docker-Based Development

MovaLab uses **local Supabase** (PostgreSQL + Auth + Storage) via Docker. Everything runs on your machine -- no cloud dependencies.

### Docker Commands

```bash
# Start/stop Supabase services
npm run docker:start         # Start all services
npm run docker:stop          # Stop services (preserves data)

# Database management
npm run docker:reset         # Reset DB, re-run migrations + seed
npm run docker:seed          # Same as docker:reset (clean slate)
npm run docker:health        # Verify setup

# Database UI
npm run docker:studio        # Open Supabase Studio at localhost:54323
```

### Service URLs

When Docker is running, you'll have access to:

- **App:** http://localhost:3000
- **Supabase API:** http://127.0.0.1:54321
- **Supabase Studio:** http://localhost:54323 (database admin UI)
- **PostgreSQL:** localhost:54322
- **Inbucket (email):** http://localhost:54324

### Database Schema

The database schema is defined in `/supabase/migrations/`:

| Migration File | Description |
|----------------|-------------|
| `20250129000000_baseline.sql` | Full baseline schema (tables, functions, views, RLS, triggers) |
| `20251230120000_fix_workflow_instances_rls.sql` | Workflow RLS policy fix |
| `20251231000000_project_assignments_source_tracking.sql` | Assignment source tracking |
| `20260228000000_client_portal_and_rls_fixes.sql` | Client portal and RLS fixes |
| `20260320000000_fix_clock_race_and_uuid_validation.sql` | Clock race condition and UUID validation |
| `20260320100000_fix_rls_privilege_escalation.sql` | RLS privilege escalation fix |
| `20260321000000_onboarding_system.sql` | Onboarding/setup wizard system |

Migrations run automatically when you start Supabase.

### Seed Data

The seed file (`/supabase/seed.sql`) creates a **clean slate**:

- **3 system roles** only: Superadmin, Client, No Assigned Role
- No departments, users, accounts, or projects
- The first user creates the superadmin account via the `/onboarding` wizard

The `scripts/create-seed-users.ts` file exists as a developer utility but is **not** run by any npm script.

### Troubleshooting

**"Rate exceeded" error during setup?**
```bash
# Authenticate with Docker Hub to increase rate limits
docker login

# Then restart the setup
npx supabase stop
npm run setup
```

**Docker not running?**
```bash
# Check Docker status
docker info

# If not running, start Docker Desktop
# Then: npm run docker:start
```

**Database connection failed?**
```bash
# Reset everything
npm run docker:stop
npm run docker:start
npm run docker:health
```

**Migrations not applied?**
```bash
npm run docker:reset
```

**Still having issues?**
- Run the health check: `npm run docker:health`
- Check logs: `supabase status`
- Ask for help in our [Discord](https://discord.gg/99SpYzNbcu)

## Database Migrations (Advanced)

If you need to add new tables or modify the schema:

```bash
# Create a new migration file
supabase migration new your_migration_name

# Write your SQL in the generated file
# Then reset to apply:
npm run docker:reset
```

### Database Structure Overview

The schema includes these main areas:

| Area | Tables | Description |
|------|--------|-------------|
| **Users & Auth** | `user_profiles`, `user_roles`, `roles` | User management and RBAC |
| **Accounts** | `accounts`, `account_members` | Client account management |
| **Projects** | `projects`, `project_assignments`, `tasks` | Project and task tracking |
| **Time Tracking** | `time_entries`, `clock_sessions`, `user_availability` | Capacity and time management |
| **Workflows** | `workflow_templates`, `workflow_nodes`, `workflow_instances` | Visual workflow automation |
| **Forms** | `form_templates`, `form_responses` | Dynamic form builder |
| **Onboarding** | `setup_tokens`, `onboarding_state`, `user_invitations` | First-run setup and invitations |

### Important Notes

- **RLS is mandatory** -- All tables have Row Level Security policies
- **Don't disable RLS** -- This protects data isolation between users
- **Test with real auth** -- Many features require authenticated users
- **~40 permissions** -- The RBAC system has granular permission controls (consolidated from 136 in Phase 9)

## Code Style

- **TypeScript**: All code should be written in TypeScript with proper types
- **Formatting**: Follow existing code patterns in the codebase
- **Components**: Use functional components with hooks
- **Naming**: Use descriptive names for variables, functions, and components

## Pull Request Process

1. **Create a branch** for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear, focused commits

3. **Test your changes** locally

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request** against the `main` branch

6. **Describe your changes** clearly in the PR description

### PR Requirements

- Provide a clear description of what changed and why
- Ensure the build passes (`npm run build`)
- Test your changes thoroughly
- Keep PRs focused on a single change when possible

## Reporting Issues

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS information if relevant
- Screenshots if applicable

## Feature Requests

When requesting features:

- Describe the problem you're trying to solve
- Explain your proposed solution
- Consider alternatives you've thought about
- Provide context on how it would be used

## Questions?

- Open a GitHub Discussion for general questions
- Check existing issues before creating new ones
- Be patient -- maintainers are volunteers

## License

By contributing, you agree that your contributions will be licensed under the Sustainable Use License. This means:

- You can use and modify the software for internal business purposes or personal use
- You cannot host MovaLab as a commercial service or resell it
- Your contributions help improve a product used by agencies worldwide
- MovaLab remains source-available while protecting against commercial exploitation

This is not an OSI-approved open source license. MovaLab uses a "fair-code" model similar to n8n, Sentry, and other commercial source-available projects. If you have questions about what the license permits, please open an issue before contributing.

See the [LICENSE](LICENSE) file for complete details.
