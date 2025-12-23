# MovaLab Features - Part 3 of 4: UI Components, Dashboards & Admin

**Last Updated:** December 22, 2025

---

## 8. DASHBOARDS

### 8.1 Main Dashboard

**Location:** `/app/dashboard/page.tsx`
**Access:** All authenticated users

### Dashboard Sections

| Section | Purpose | Components |
|---------|---------|------------|
| **Unified Projects** | Workflow inbox + assigned projects | `unified-projects-section.tsx` |
| **Capacity Dashboard** | Current week utilization | `capacity-dashboard.tsx` |
| **Profile Card** | User info, roles, departments | Memoized component |
| **Quick Actions** | Navigation shortcuts | Memoized component |
| **Availability Dialog** | Set work schedule | `drag-availability-calendar.tsx` |

### Unified Projects Section

**Features:**
- Workflow inbox (projects assigned to me)
- Assigned projects list
- Quick project actions
- Project status overview
- Click to navigate to project detail

### Capacity Dashboard Widget

**Displays:**
- Current week utilization percentage
- Visual charts and graphs
- Available hours
- Logged hours
- Remaining capacity
- Trend indicators

### Profile Card

**Shows:**
- User name and email
- Profile image
- Roles (comma-separated list)
- Departments (comma-separated list)
- Quick stats

### Quick Actions Card

**Conditional Links:**
- View My Accounts
- View My Departments
- View Admin Page (if `MANAGE_USER_ROLES`)
- View Org Analytics (if `VIEW_ALL_ANALYTICS`)

### Availability Dialog

**Features:**
- Set work availability
- Drag-to-set calendar interface
- Save availability changes
- Refreshes capacity dashboard on save

### Performance Optimizations

**Techniques:**
- Code splitting with Next.js dynamic imports
- Memoized components (ProfileCard, QuickActionsCard)
- Suspense boundaries with loading skeletons
- SSR disabled for heavy client components
- Lazy loading of availability calendar

**Example:**
```typescript
const CapacityDashboard = dynamic(() => import('@/components/capacity-dashboard'), {
  ssr: false,
  loading: () => <Skeleton className="h-64" />
});
```

### 8.2 Welcome Page

**Location:** `/app/welcome/page.tsx`
**Access:** All authenticated users

**Features:**
- Company newsletters feed
- Getting started guide
- Recent announcements
- Quick links to key features
- Newsletter cards with publish dates

---

## 9. ADMIN FEATURES

### 9.1 Admin Hub

**Location:** `/app/(main)/admin/page.tsx`
**Access:** Various admin permissions

### Admin Feature Categories

**1. User Management:**
- **Role Management** (`/admin/roles`) - Org chart, permissions
- **Superadmin Setup** (`/admin/superadmin-setup`) - Promote/demote
- **Time Tracking Admin** (`/admin/time-tracking`) - Oversight
- **Pending Users** (`/admin/users/pending`) - Approval queue

**2. Workflow & Client Management:**
- **Workflow Management** (`/admin/workflows`) - Templates
- **Client Portal** (`/admin/client-portal`) - Invitations
- **Client Feedback** (`/admin/client-feedback`) - View all feedback

**3. System Settings:**
- **Database Management** (`/admin/database`) - Direct queries
- **RBAC Diagnostics** (`/admin/rbac-diagnostics`) - Debug permissions

### 9.2 Database Management

**Location:** `/app/admin/database/page.tsx`
**Access:** Superadmin only

**Features:**
- Direct database queries
- Schema inspection
- Data operations (read/write)
- System diagnostics
- Table browsing
- Query execution

**Warning:** Direct database access. Use with caution.

### 9.3 RBAC Diagnostics

**Location:** `/app/admin/rbac-diagnostics/page.tsx`
**API:** `/api/admin/rbac-diagnostics/*`
**Access:** Superadmin or `MANAGE_USER_ROLES`

### Diagnostic Features

| Feature | Purpose |
|---------|---------|
| **Permission Analysis** | View user permissions |
| **Role Mapping** | See permission inheritance |
| **Conflict Detection** | Find permission conflicts |
| **Access Pattern Review** | Audit access patterns |

### Troubleshooting Tools

**Why can/can't user access X?**
- User ID input
- Permission name input
- Context parameters (optional)
- Detailed breakdown of evaluation:
  - Is superadmin?
  - Has override permission?
  - Has base permission?
  - In correct context?
  - Result: ALLOW or DENY

**Test Interface:**
- Simulate permission checks
- Test different user contexts
- Debug permission denials
- Generate audit reports

**API Routes:**
- `GET /api/admin/rbac-diagnostics` - Run diagnostics
- `POST /api/admin/rbac-diagnostics/test` - Test permission check

### 9.4 Newsletter Management

**Location:** Welcome page + admin dialogs
**Service:** `lib/newsletter-service.ts`
**Components:** `newsletter-*.tsx` (4 components)
**Database:** `newsletters`

### Newsletter Features

| Feature | Component |
|---------|-----------|
| Create newsletter | `newsletter-creation-dialog.tsx` |
| Edit newsletter | `newsletter-edit-dialog.tsx` |
| Delete newsletter | `newsletter-delete-dialog.tsx` |
| Display newsletter | `newsletter-card.tsx` |

**Newsletter Fields:**
- Title
- Rich text content
- Created by (user reference)
- Is published (boolean)
- Published timestamp

**Newsletter Display:**
- Welcome page feed
- Chronological ordering (newest first)
- Published newsletters only
- Author attribution
- Publication date

**Access:**
- View: `VIEW_NEWSLETTERS`
- Manage: `MANAGE_NEWSLETTERS`

### 9.5 Milestone Management

**Location:** Gantt chart integration
**Service:** `lib/milestone-service.ts`
**Components:** `milestone-*.tsx`
**Database:** `milestones`

**Features:**
- Create project milestones
- Milestone dates
- Milestone colors (hex codes)
- Gantt chart markers
- Milestone descriptions

**Milestone Fields:**
- Name
- Description
- Date
- Color (default: #3b82f6)

**Access:** Via project management (same permissions)

---

## 10. UI COMPONENTS & LIBRARIES

### 10.1 shadcn/ui Components

**Location:** `/components/ui/*`

**Complete Component List (26 Components):**
- Alert, AlertDialog
- Avatar
- Badge
- Button
- Card
- Checkbox
- Context Menu
- Dialog
- Dropdown Menu
- Error Boundary
- Field
- Input
- Label
- Progress
- Scroll Area
- Select
- Separator
- Skeleton
- Slider
- Switch
- Table
- Tabs
- Textarea
- Tooltip
- Command
- Popover

### 10.2 Specialized UI Components

**Kanban Board**

**Location:** `components/ui/shadcn-io/kanban/index.tsx`
**Library:** @dnd-kit/core
**Database:** `account_kanban_configs`

**Features:**
- Drag-and-drop task cards
- Custom columns per account
- Column reordering
- Task card details
- Visual feedback on drag
- Status transition tracking

**Important:** Operates on TASKS (individual work items), NOT projects.

**Components:**
- `kanban-config-dialog.tsx` - Configure columns
- Kanban board renderer

---

**Gantt Chart**

**Location:** `components/ui/shadcn-io/gantt/index.tsx`
**Libraries:** date-fns, jotai (state management)

**Features:**
- Timeline visualization
- Task dependencies with arrows
- Milestone markers
- Drag-to-reschedule tasks
- Zoom levels:
  - Daily view
  - Monthly view
  - Quarterly view
  - Yearly view
- Task duration editing
- Context menus
- Dependency highlighting

**Important:** Operates on TASKS (individual work items), NOT projects.

**Components:**
- Gantt chart renderer
- Timeline controls
- Dependency calculator

---

**Workflow Canvas**

**Location:** `components/workflow-editor/workflow-canvas.tsx`
**Library:** @xyflow/react

**Features:**
- Node-based workflow editor
- Drag-and-drop nodes from palette
- Connection drawing between nodes
- Pan/zoom canvas controls
- Node configuration dialogs
- Visual feedback on hover/select
- Auto-layout algorithms

**Components (in `components/workflow-editor/`):**
- `workflow-canvas.tsx` - Main canvas (12 components total)
- `workflow-node.tsx` - Node component
- `labeled-edge.tsx` - Edge with label
- `node-config-dialog.tsx` - Configure node settings
- `edge-config-dialog.tsx` - Configure edge settings
- `node-sidebar.tsx` - Node type palette

---

**Org Chart Canvas**

**Location:** `components/org-chart/org-chart-canvas.tsx`
**Library:** @xyflow/react

**Features:**
- Role hierarchy visualization
- Drag-and-drop role positioning
- Connection lines (reporting structure)
- Role detail panel
- Permission editing inline
- Hierarchical layout

**Components (in `components/org-chart/`):**
15+ components including:
- `org-chart-canvas.tsx` - Main canvas
- `org-chart-node.tsx` - Role node
- `org-chart-edge.tsx` - Connection line
- `org-chart-toolbar.tsx` - Canvas controls
- `role-creation-dialog.tsx` - Create role
- `role-edit-dialog.tsx` - Edit role
- `role-detail-panel.tsx` - Role details sidebar
- `permission-editor.tsx` - Permission checkboxes
- `reporting-role-dialog.tsx` - Set reporting structure
- `user-assignment-dialog.tsx` - Assign users
- And 5+ more...

---

### 10.3 Account Components

**Location:** `components/account-*.tsx`

| Component | Purpose |
|-----------|---------|
| `account-create-dialog.tsx` | Create new account |
| `account-edit-dialog.tsx` | Edit account details |
| `account-list.tsx` | Account list view |
| `account-overview.tsx` | Account detail page |
| `accounts-client-wrapper.tsx` | Server/client data wrapper |

---

### 10.4 Project Components

**Location:** `components/project-*.tsx`

| Component | Purpose |
|-----------|---------|
| `project-creation-dialog.tsx` | Create new project |
| `project-hours-slider.tsx` | Hour estimation slider |
| `project-updates-card.tsx` | Updates feed card |
| `assigned-projects-section.tsx` | User's assigned projects |
| `unified-projects-section.tsx` | Dashboard projects section |

---

### 10.5 Task Components

**Location:** `components/task-*.tsx`, `components/ui/shadcn-io/gantt/`, `components/ui/shadcn-io/kanban/`

| Component | Purpose |
|-----------|---------|
| `task-creation-dialog.tsx` | Create new task |
| `task-create-edit-dialog.tsx` | Unified task dialog |
| `task-edit-dialog.tsx` | Edit task details |
| `gantt-chart.tsx` | Gantt timeline view |
| `kanban-config-dialog.tsx` | Kanban column config |

---

### 10.6 Department Components

**Location:** `components/department-*.tsx`

| Component | Purpose |
|-----------|---------|
| `department-create-dialog.tsx` | Create department |
| `department-delete-dialog.tsx` | Delete confirmation |
| `department-list.tsx` | Department list |
| `department-overview.tsx` | Department detail |
| `department-role-dialog.tsx` | Role assignment |
| `department-admin-tabs.tsx` | Admin tabs |

---

### 10.7 Workflow Execution Components

**Location:** `components/workflow-*.tsx`

| Component | Purpose |
|-----------|---------|
| `workflow-progress.tsx` | Workflow status display |
| `workflow-progress-button.tsx` | Handoff button |
| `workflow-timeline.tsx` | History timeline |
| `workflow-visualization.tsx` | Visual flow display |
| `workflow-visualization-node.tsx` | Node in visualization |

---

### 10.8 Capacity & Time Components

**Location:** `components/capacity-*.tsx`, `components/time-*.tsx`, `components/clock-*.tsx`, `components/availability-*.tsx`

| Component | Purpose |
|-----------|---------|
| `capacity-dashboard.tsx` | Capacity metrics widget |
| `capacity-trend-chart.tsx` | Historical charts |
| `availability-calendar.tsx` | Availability display |
| `drag-availability-calendar.tsx` | Drag-to-set calendar |
| `clock-widget.tsx` | Clock in/out widget (navigation) |
| `clock-out-dialog.tsx` | Clock out with task selection |
| `time-entries-list.tsx` | Time entries table (Phase 9) |
| `time-entries-summary.tsx` | Summary stats cards (Phase 9) |
| `time-entries-chart.tsx` | Time visualizations (Phase 9) |

---

### 10.9 Utility Components

**Location:** `components/*.tsx`

| Component | Purpose |
|-----------|---------|
| `role-guard.tsx` | Permission-based component guard |
| `navigation.tsx` | Main navigation bar |
| `client-navigation.tsx` | Client-specific nav |
| `breadcrumb.tsx` | Breadcrumb trail |
| `login-form.tsx` | Login form |
| `database-status.tsx` | DB connection status |
| `resource-hints.tsx` | Helper tooltips |
| `setup-instructions.tsx` | Setup guide |
| `people-management-dialog.tsx` | User management |
| `group-management-dialog.tsx` | Group management |
| `user-inbox.tsx` | User notifications |
| `emergency-reset.tsx` | Emergency reset |
| `chunk-error-handler.tsx` | Error boundary |
| `not-found-content.tsx` | 404 content |
| `auth-provider-wrapper.tsx` | Auth context wrapper |
| `client-only.tsx` | Client-only wrapper |
| `inline-form-builder.tsx` | Inline form creation |

---

## 11. NAVIGATION & ROUTING

### Public Routes
- `/` - Landing page
- `/login` - Login page
- `/signup` - Registration
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset form
- `/pending-approval` - Pending approval message
- `/client/accept-invite/[token]` - Accept client invitation

### Authenticated Routes
- `/dashboard` - Main dashboard
- `/welcome` - Welcome page with newsletters
- `/profile` - User profile
- `/accounts` - Account list
- `/accounts/[accountId]` - Account detail (tabs: Overview, Active Projects, Finished Projects, Team, Feedback)
- `/projects` - Project list
- `/projects/[projectId]` - Project detail (tabs: Overview, Tasks, Workflow, Updates, Issues, Team)
- `/departments` - Department list
- `/departments/[departmentId]` - Department detail
- `/departments/[departmentId]/admin` - Department admin
- `/capacity` - Capacity management
- `/analytics` - Analytics dashboard
- `/time-entries` - Time entries page (Phase 9)

### Admin Routes (Route Group: `(main)/admin`)
- `/admin` - Admin hub
- `/admin/roles` - Role management (org chart)
- `/admin/superadmin-setup` - Superadmin configuration
- `/admin/database` - Database management
- `/admin/rbac-diagnostics` - RBAC diagnostics
- `/admin/time-tracking` - Time tracking admin
- `/admin/users/pending` - Pending users
- `/admin/workflows` - Workflow templates list
- `/admin/workflows/[id]/edit` - Workflow editor
- `/admin/client-portal` - Client portal management
- `/admin/client-feedback` - Client feedback admin

### Special Routes
- `/auth/callback` - OAuth callback handler
- `/superadmin-setup` - Initial superadmin bootstrap

---

## 12. ANALYTICS & REPORTING

### 12.1 Analytics Page

**Location:** `/app/analytics/page.tsx`
**Access:** Context-aware permissions

### Analytics Scope

| Scope | Permission | Data Visible |
|-------|------------|--------------|
| **Own Data** | Implicit (all users) | User's own metrics |
| **Department** | `VIEW_ALL_DEPARTMENT_ANALYTICS` | Department aggregates |
| **Account** | `VIEW_ALL_ACCOUNT_ANALYTICS` | Account aggregates |
| **Organization** | `VIEW_ALL_ANALYTICS` | Company-wide metrics |

### Current Analytics Widgets

**Organization Capacity Widget:**
- Company-wide capacity metrics
- Department breakdowns
- Utilization trends
- Resource allocation overview

### Planned Analytics Features

- Project progress tracking
- User activity analytics
- Custom report generation
- Export functionality (CSV, PDF)
- Historical trend analysis
- Predictive capacity planning

---

## Summary Statistics

**Part 3 Features:**
- ✅ Main Dashboard with 5 sections
- ✅ Welcome page with newsletters
- ✅ Admin hub with 10+ admin features
- ✅ RBAC diagnostics tooling
- ✅ Database management interface
- ✅ Newsletter management system
- ✅ Milestone management
- ✅ 26 shadcn/ui components
- ✅ 4 specialized UI components (Kanban, Gantt, Workflow Canvas, Org Chart)
- ✅ 100+ application-specific components
- ✅ 40+ page routes
- ✅ Analytics dashboard with 4 scope levels

**Next:** Part 4 covers Database Schema, API Routes Reference, and Architecture Patterns.
