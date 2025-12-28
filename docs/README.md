# MovaLab Documentation

Welcome to the MovaLab documentation. This guide will help you get started with setting up, developing, and deploying MovaLab.

**Live Demo:** [demo.movalab.dev](https://demo.movalab.dev)
**Production:** [movalab.dev](https://movalab.dev)

---

## Getting Started

| Document | Description |
|----------|-------------|
| [FIRST_TIME_SETUP.md](./setup/FIRST_TIME_SETUP.md) | **Cloud deployment setup** - How to create the first superadmin account |
| [DEMO_MODE.md](./setup/DEMO_MODE.md) | **Demo mode guide** - Running MovaLab in demo mode (local & cloud) |
| [docker-setup.md](./setup/docker-setup.md) | **Docker setup** - Local development with Docker |

---

## Folder Structure

### `/setup`
Setup and deployment guides.
- `FIRST_TIME_SETUP.md` - First-time cloud deployment setup
- `DEMO_MODE.md` - Demo mode configuration (includes cron job setup)
- `docker-setup.md` - Docker environment configuration

### `/architecture`
System architecture, database design, and feature specifications.
- `FEATURELIST.md` - Complete feature inventory
- `DATABASE_CONNECTION.md` - Database connection patterns
- `DEPARTMENT_ARCHITECTURE_MIGRATION.md` - Department system design

### `/security`
Security implementation and troubleshooting guides.
- `SECURITY.md` - Security overview
- `SECURITY_IMPLEMENTATION.md` - Implementation details
- `SECURITY_TROUBLESHOOTING.md` - Common security issues

### `/permissions`
Role-based access control (RBAC) documentation.
- `PERMISSION_QUICK_REFERENCE.md` - Quick lookup guide
- `PERMISSION_SYSTEM_TESTING.md` - Testing procedures
- `PERMISSION_TESTING.md` - Test cases
- `PERMISSION_TESTING_SUMMARY.md` - Test results summary
- `PERMISSION_CHECKER_AUTH_BUG_FIX.md` - Auth bug fixes

### `/workflows`
Workflow system documentation and testing.
- `CONDITIONAL_NODE_HANDLE_FIX.md` - Conditional node handle connection fix

### `/testing`
Testing documentation, strategies, and audit reports.
- `TESTING_STRATEGY.md` - Overall testing approach
- `TESTING_PROGRESS.md` - Testing progress tracker
- `TEST_RESULTS.md` - Test execution results
- `FINAL_TEST_REPORT.md` - Final test summary
- `NOV26_TEST_REPORT.md` - November 26 test session
- `ACCOUNT_MANAGER_FRONTEND_AUDIT_REPORT.md` - Frontend audit
- `navigation-race-condition-fix.md` - Navigation fix
- `login-page-auth-fix.md` - Login page fix

### `/implementation`
Implementation phases and progress reports.
- `00-INDEX.md` - Implementation index
- `01-CORE-FEATURES.md` - Core features overview
- `02-WORKFLOW-TIME-CLIENT.md` - Workflow and time tracking
- `03-UI-DASHBOARDS-ADMIN.md` - UI and admin dashboards
- `04-DATABASE-API-ARCHITECTURE.md` - Database and API architecture
- `05-DOCKER-LOCAL-SETUP-COMPLETE.md` - Docker setup completion
- `PHASE1_*.md` - Phase 1 implementation docs
- `PHASE2_PROGRESS_REPORT.md` - Phase 2 progress

### `/capacity`
Capacity planning system documentation.
- `CAPACITY_SYSTEM_IMPLEMENTATION.md` - Implementation details
- `CAPACITY_IMPLEMENTATION_STATUS.md` - Current status
- `CAPACITY_SESSION_COMPLETE.md` - Session completion

### `/database`
Database-related documentation and findings.
- `DATABASE_SCOUT_FINDINGS_REPORT.md` - Scout findings
- `DATABASE_SCOUT_INVENTORY.md` - Database inventory
- `NESTED_QUERY_RLS_ISSUE.md` - RLS nested query issues

---

## Quick Links

- **[Main README](../README.md)** - Project overview and quick start
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines
- **[CLAUDE.md](../CLAUDE.md)** - Comprehensive developer documentation

---

## Need Help?

- **Discord:** [Join the MovaLab community](https://discord.gg/99SpYzNbcu)
- **GitHub Issues:** [Report bugs or request features](https://github.com/itigges22/MovaLab/issues)
