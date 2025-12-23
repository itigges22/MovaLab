# MovaLab Complete Feature Documentation - Index

**Last Updated:** December 22, 2025
**Status:** Production-Ready Platform
**Documentation Version:** 1.0

---

## Overview

This comprehensive feature documentation catalogs **every single feature, capability, and functionality** in the MovaLab platform. The documentation is organized into 4 parts for readability while maintaining complete coverage.

**Total Coverage:**
- ✅ 40 Permissions across 12 categories
- ✅ 48 Database tables with complete schema
- ✅ 80+ API routes with full reference
- ✅ 100+ UI components
- ✅ 40+ page routes
- ✅ 20+ service layer modules
- ✅ Complete architectural patterns

---

## Documentation Structure

### [Part 1: Core Features](./01-CORE-FEATURES.md)
**Focus:** Authentication, RBAC, Accounts, Projects, Tasks

**Covers:**
1. **Authentication & User Management**
   - Authentication system (3 client types)
   - User registration & approval workflow
   - User profiles with workload sentiment

2. **Role-Based Access Control (RBAC)**
   - 40 Permissions (post-Phase 9 consolidation)
   - Visual org chart editor
   - Hybrid permission model (base + override + context)
   - Department management with dynamic membership
   - Superadmin setup

3. **Account & Project Management**
   - Account management with proportional capacity
   - Project management (workflow-driven status)
   - Task management (List/Kanban/Gantt views)
   - Project updates feed
   - Project issues/blockers

4. **Row-Level Security (RLS)**
   - Database-level security enforcement
   - RLS patterns and best practices
   - Security guarantees

**Statistics:**
- 5 User management features
- 40 Permissions documented
- Account/project/task complete workflows
- 3 task view types

---

### [Part 2: Workflows, Time Tracking & Client Portal](./02-WORKFLOW-TIME-CLIENT.md)
**Focus:** Workflow system, time entries, capacity, client features

**Covers:**
5. **Workflow System**
   - Visual workflow builder (8 node types)
   - Drag-and-drop canvas (@xyflow/react)
   - Workflow execution engine
   - Multi-path workflow support
   - Node assignment enforcement (Phase 9)
   - Inline form builder (12 field types)

6. **Time Tracking & Capacity Management**
   - Clock widget (auto-logout protection)
   - Time Entries Page (Phase 9) with 3 tabs
   - 14-day edit window enforcement
   - Drag-to-set availability calendar
   - Proportional capacity allocation
   - 5 capacity view levels

7. **Client Portal**
   - Email-based client invitations
   - Client feedback system (1-10 ratings)
   - Client project view with approval actions
   - Hardcoded client permissions

**Statistics:**
- 8 Workflow node types
- 12 Form field types
- Time tracking with charts/visualizations
- Proportional capacity algorithm
- Client satisfaction ratings

---

### [Part 3: UI Components, Dashboards & Admin](./03-UI-DASHBOARDS-ADMIN.md)
**Focus:** Dashboards, admin tools, UI component catalog

**Covers:**
8. **Dashboards**
   - Main dashboard (5 sections)
   - Welcome page with newsletters
   - Performance optimizations

9. **Admin Features**
   - Admin hub (10+ admin features)
   - Database management interface
   - RBAC diagnostics tooling
   - Newsletter management
   - Milestone management

10. **UI Components & Libraries**
    - 26 shadcn/ui components
    - Specialized components:
      - Kanban Board (@dnd-kit)
      - Gantt Chart (custom)
      - Workflow Canvas (@xyflow/react)
      - Org Chart Canvas (@xyflow/react)
    - 100+ application-specific components
    - Component catalog organized by feature

11. **Navigation & Routing**
    - 40+ page routes
    - Public vs authenticated routes
    - Admin route group

12. **Analytics & Reporting**
    - 4 analytics scope levels
    - Organization capacity widgets
    - Planned features

**Statistics:**
- 26 shadcn/ui components
- 4 specialized visualizations
- 100+ application components
- 40+ routes
- 15+ org chart components

---

### [Part 4: Database, API & Architecture](./04-DATABASE-API-ARCHITECTURE.md)
**Focus:** Database schema, API reference, architectural patterns

**Covers:**
13. **Database Schema**
    - Complete 48-table inventory
    - Field definitions and constraints
    - RLS policy documentation
    - Database views (weekly_capacity_summary)
    - Database functions (2 total)

14. **API Routes Reference**
    - 80+ API routes categorized
    - Authentication & Users (5 routes)
    - Accounts (12 routes)
    - Projects (14 routes)
    - Tasks (4 routes)
    - Workflows (20+ routes)
    - Roles & Departments (8 routes)
    - Capacity & Time (15 routes)
    - Client Portal (6 routes)
    - Admin & Diagnostics (5 routes)

15. **Architectural Patterns**
    - Service layer pattern (20+ services)
    - Hybrid permission system (3 layers)
    - Row-level security patterns
    - Dynamic department membership
    - Proportional capacity allocation

16. **Development & Debugging**
    - Development commands
    - Environment variables
    - Performance optimizations
    - Database indexes

17. **Key Distinctions**
    - Kanban vs Workflow (task-level vs project-level)
    - Forms (inline only)
    - Client access (hardcoded)

**Statistics:**
- 48 Database tables
- 80+ API routes
- 20+ Service files
- Complete RLS coverage
- 2 Database functions

---

## Quick Reference

### By Feature Area

| Feature Area | Documentation Part | Key Sections |
|--------------|-------------------|--------------|
| **Authentication** | Part 1 | Section 1 |
| **Permissions & RBAC** | Part 1 | Section 2 |
| **Accounts & Projects** | Part 1 | Section 3 |
| **Tasks** | Part 1 | Section 3.3 |
| **Workflows** | Part 2 | Section 5 |
| **Time Tracking** | Part 2 | Section 6 |
| **Client Portal** | Part 2 | Section 7 |
| **Dashboards** | Part 3 | Section 8 |
| **Admin Tools** | Part 3 | Section 9 |
| **UI Components** | Part 3 | Section 10 |
| **Database Schema** | Part 4 | Section 13 |
| **API Routes** | Part 4 | Section 14 |
| **Architecture** | Part 4 | Section 15 |

### By User Role

| Role | Relevant Features | Documentation Parts |
|------|-------------------|---------------------|
| **Superadmin** | All features + admin tools | All parts |
| **Executive** | Analytics, capacity, all projects | Parts 1, 2, 3 |
| **Project Manager** | Projects, tasks, workflows, capacity | Parts 1, 2 |
| **Team Member** | Assigned projects/tasks, time tracking | Parts 1, 2 |
| **Client** | Client portal, feedback, approvals | Part 2 (Section 7) |
| **Developer** | Database, API, architecture | Part 4 |

### By Development Phase

| Phase | Features | Documentation |
|-------|----------|---------------|
| **Phase 1-7** | Core features, RBAC, projects | Parts 1, 3 |
| **Phase 8** | RBAC consolidation (136→58 permissions) | Part 1 (Section 2) |
| **Phase 9** | Final consolidation (58→40), Time Entries Page, Node Assignment | Parts 1, 2 |
| **Phase 10+** | Future enhancements | Planned features noted |

---

## How to Use This Documentation

### For Leadership/Stakeholders
**Goal:** Understand full platform capabilities

1. Start with this index for overview
2. Review Part 1 for core business features
3. Review Part 2 for workflow & time tracking
4. Review Part 3 for dashboards & admin tools
5. Skip Part 4 (technical details)

**Key Sections:**
- Section 3: Account & Project Management
- Section 5: Workflow System
- Section 6: Time Tracking & Capacity

### For Product Managers
**Goal:** Feature planning and roadmap

1. Read all 4 parts for complete understanding
2. Focus on Sections 1-12 for user-facing features
3. Review Section 17 (Key Distinctions) for important design decisions
4. Note "Planned Features" sections

**Key Sections:**
- All user-facing features (Sections 1-12)
- Analytics & Reporting (Section 12)
- Key Distinctions (Section 17)

### For Developers
**Goal:** Implementation details and architecture

1. Start with Part 4 (Database & Architecture)
2. Review Part 1 for RBAC implementation
3. Review Part 2 for workflow engine details
4. Use Part 3 for component reference
5. Refer to `/docs/architecture/CLAUDE.md` for development guide

**Key Sections:**
- Section 13: Database Schema
- Section 14: API Routes Reference
- Section 15: Architectural Patterns
- Section 16: Development & Debugging

### For QA/Testing
**Goal:** Complete test coverage

1. Use Parts 1-3 for feature test cases
2. Reference Section 14 (API Routes) for integration tests
3. Review Section 2 (RBAC) for permission testing
4. Check Section 16 for test commands

**Key Sections:**
- Section 2: RBAC (permission testing)
- All feature sections for functional tests
- Section 14: API Routes (integration tests)

### For Designers/UX
**Goal:** UI/UX components and patterns

1. Review Part 3 for all UI components
2. Focus on Section 10 (UI Components)
3. Review Section 8 (Dashboards) for layouts
4. Check Section 11 (Navigation) for routing

**Key Sections:**
- Section 8: Dashboards
- Section 10: UI Components
- Section 11: Navigation & Routing

---

## Additional Resources

**Core Documentation:**
- `/docs/architecture/CLAUDE.md` - Complete development guide with patterns
- `/docs/security/SECURITY.md` - Security architecture and best practices
- `/README.md` - Product overview and setup
- `/CONTRIBUTING.md` - Development setup and contribution guidelines

**Specialized Docs:**
- `/docs/workflows/` - Workflow system documentation
- `/docs/testing/` - Testing strategies and reports

**Community:**
- [Discord Community](https://discord.gg/99SpYzNbcu) - Get help, share feedback

---

## Version History

### Version 1.0 (December 22, 2025)
- Initial comprehensive feature documentation
- Complete coverage of all platform features
- Split into 4 parts for readability
- Covers post-Phase 9 RBAC consolidation (40 permissions)
- Includes Time Entries Page (Phase 9 feature)
- Documents node assignment enforcement (Phase 9)

---

## Documentation Maintenance

**Updating This Documentation:**
1. When adding new features, update relevant part
2. Update statistics in summary sections
3. Add to Quick Reference tables
4. Update version history
5. Coordinate with CLAUDE.md updates

**Review Schedule:**
- After each major feature release
- After RBAC changes
- Quarterly comprehensive review

---

**End of Index - Start with Part 1 →**
