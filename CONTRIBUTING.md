# Contributing to MovaLab

Thank you for your interest in contributing to MovaLab! This document provides guidelines for contributing to the project.

## Ways to Contribute

- **Bug Reports**: Found something broken? Open an issue with details
- **Feature Requests**: Have an idea? We'd love to hear it
- **Code Contributions**: Fix bugs or implement new features
- **Documentation**: Improve docs, fix typos, add examples
- **Testing**: Help test new features and report issues

## Development Setup

### Prerequisites

- Node.js 18.0 or higher
- npm, pnpm, yarn, or bun
- Supabase account (free tier works)
- Git

### Getting Started

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/MovaLab.git
   cd MovaLab
   ```

3. **Install dependencies**
   ```bash
   bun install
   # or: npm install
   ```

4. **Set up Supabase** (see [Database Setup](#database-setup) below)

5. **Set up environment variables**

   Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

6. **Start the development server**
   ```bash
   bun run dev
   # or: npm run dev
   ```

7. **Open** [http://localhost:3000](http://localhost:3000)

## Database Setup

MovaLab uses [Supabase](https://supabase.com) (PostgreSQL) with Row Level Security (RLS) for data protection. The database schema includes 45+ tables with complex relationships and security policies.

### Creating Your Supabase Project

1. **Create a free account** at [supabase.com](https://supabase.com)

2. **Create a new project**
   - Click "New Project"
   - Choose your organization
   - Enter a project name (e.g., "movalab-dev")
   - Generate a strong database password (save this!)
   - Select a region close to you
   - Click "Create new project"

3. **Wait for setup** - This takes 1-2 minutes

4. **Get your credentials**
   - Go to **Settings** → **API**
   - Copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy the **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Setting Up the Database Schema

The database schema is managed through migrations. To set up your development database:

#### Option 1: Request Schema Access (Recommended for Contributors)

Contact the maintainers to get the current schema export:
- Open a GitHub issue titled "Request: Database Schema for Development"
- Or email the maintainer (see SECURITY.md)

We'll provide you with:
- A SQL file containing the complete schema
- Instructions for running it in your Supabase project

#### Option 2: Use Supabase CLI (Advanced)

If you have access to the migration files:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
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

### Important Notes

- **RLS is mandatory** - All tables have Row Level Security policies
- **Don't disable RLS** - This protects data isolation between users
- **Test with real auth** - Many features require authenticated users
- **136 permissions** - The RBAC system has granular permission controls

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
- Be patient - maintainers are volunteers

## License

By contributing, you agree that your contributions will be licensed under the Sustainable Use License. This means:

- You can use and modify the software for internal business purposes or personal use
- You cannot host MovaLab as a commercial service or resell it
- Your contributions help improve a product used by agencies worldwide
- MovaLab remains source-available while protecting against commercial exploitation

This is not an OSI-approved open source license. MovaLab uses a "fair-code" model similar to n8n, Sentry, and other commercial source-available projects. If you have questions about what the license permits, please open an issue before contributing.

See the [LICENSE](LICENSE) file for complete details.
