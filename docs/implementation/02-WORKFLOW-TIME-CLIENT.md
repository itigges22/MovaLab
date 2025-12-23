# MovaLab Features - Part 2 of 4: Workflows, Time Tracking & Client Portal

**Last Updated:** December 22, 2025

---

## 5. WORKFLOW SYSTEM

### 5.1 Workflow Builder (Visual Editor)

**Visual Node-Based Workflow Designer**

| Feature | Technology | Location |
|---------|-----------|----------|
| Drag-and-drop canvas | @xyflow/react | `/app/(main)/admin/workflows/[id]/edit` |
| Node configuration | React dialogs | Workflow editor |
| Template management | CRUD API | `/app/(main)/admin/workflows` |

**Files:**
- **Service:** `lib/workflow-service.ts`, `lib/workflow-execution-service.ts`, `lib/workflow-validation.ts`
- **Components:** `components/workflow-editor/*` (12+ components)
- **Database:** `workflow_templates`, `workflow_nodes`, `workflow_connections`

### Node Types (8 Total)

| Node Type | Purpose | Configuration |
|-----------|---------|---------------|
| **Start** | Entry point | Label only (exactly 1 per workflow) |
| **Department** | Hand off to department | Select department, auto-assigns based on membership |
| **Role** | Assign to specific role | Select role |
| **Approval** | Requires approval | Approval settings |
| **Form** | Collect structured data | Inline form builder |
| **Conditional** | Branch based on conditions | Conditional logic |
| **Sync** | Wait for multiple paths | Convergence point |
| **End** | Exit point | Label only (can have multiple) |

### Workflow Editor Features

**Canvas Controls:**
- Pan/zoom
- Node palette sidebar
- Connection drawing
- Node deletion
- Edge deletion
- Tutorial/help dialog

**Node Configuration:**
- Node labels/names
- Entity selection (department, role, etc.)
- Form template (inline created)
- Conditional logic
- Position persistence (x, y coordinates)

**Connection Features:**
- Define valid transition paths
- Conditional transitions
- Connection labels
- Edge styling

**Template Management:**
- Create/edit/delete templates
- Activate/deactivate
- Template versioning
- Name and description

**API Routes:**
- `GET /api/admin/workflows/templates` - List templates
- `POST /api/admin/workflows/templates` - Create template
- `GET /api/admin/workflows/templates/[id]` - Get template
- `PUT /api/admin/workflows/templates/[id]` - Update template
- `DELETE /api/admin/workflows/templates/[id]` - Delete template
- `GET /api/admin/workflows/templates/[id]/nodes` - Get nodes
- `POST /api/admin/workflows/templates/[id]/nodes` - Create node
- `GET /api/admin/workflows/templates/[id]/connections` - Get connections
- `POST /api/admin/workflows/templates/[id]/connections` - Create connection
- `DELETE /api/admin/workflows/nodes/[nodeId]` - Delete node
- `DELETE /api/admin/workflows/connections/[connectionId]` - Delete connection

**Access:** `MANAGE_WORKFLOWS` permission

### 5.2 Workflow Execution

**Running Workflows on Projects**

**Database:** `workflow_instances`, `workflow_active_steps`, `workflow_history`
**Components:** `workflow-progress.tsx`, `workflow-visualization.tsx`, `workflow-timeline.tsx`

### Workflow Lifecycle

| Stage | Description | Database Field |
|-------|-------------|----------------|
| Start | Create instance for project | `workflow_instances.status = 'active'` |
| Progression | Move through nodes | `current_node_id` updates |
| Completion | Reach end node | `status = 'completed'`, `completed_at` set |

### Workflow Features

**Workflow Instances:**
- One active workflow per project
- Snapshot at start (preserves state if template changes)
- Snapshot at completion
- Started/completed timestamps

**Progression Methods:**
1. **Normal Handoff:** Follow defined connections
2. **Out-of-Order Handoff:** Skip nodes (requires `SKIP_WORKFLOW_NODES` permission)
3. **Automatic:** System-triggered transitions

**Node Assignment Enforcement (Phase 9):**
- Users must be assigned to current node to progress
- Override with `EXECUTE_ANY_WORKFLOW` permission
- Validates assignment before allowing handoff

**Multi-Path Execution:**
- Parallel workflow branches
- Branch ID tracking
- Sync node convergence
- Multiple active steps per instance

**Workflow History:**
- Complete audit trail
- Transition timestamps
- User who made transition
- Transition type (normal, out_of_order, auto)
- Form responses linked
- Notes per transition

### Workflow Queries

| View | API Route | Description |
|------|-----------|-------------|
| My Pipeline | `GET /api/workflows/my-pipeline` | Projects assigned to me |
| My Approvals | `GET /api/workflows/my-approvals` | Awaiting my approval |
| My Projects | `GET /api/workflows/my-projects` | Active projects |
| My Past Projects | `GET /api/workflows/my-past-projects` | Completed workflows |

### Workflow API Routes

**Instance Management:**
- `POST /api/workflows/instances/start` - Start workflow
- `GET /api/workflows/instances/[id]` - Get instance
- `GET /api/workflows/instances/[id]/history` - Get history
- `GET /api/workflows/instances/[id]/active-steps` - Get active steps
- `GET /api/workflows/instances/[id]/next-nodes` - Get next possible nodes
- `POST /api/workflows/instances/[id]/handoff` - Hand off workflow
- `POST /api/workflows/progress` - Progress workflow

**Step Management:**
- `POST /api/workflows/steps/assignments` - Assign user to step

**Access:**
- Execute: `EXECUTE_WORKFLOWS` (with node assignment), `EXECUTE_ANY_WORKFLOW` (override)
- Skip nodes: `SKIP_WORKFLOW_NODES`
- Manage: `MANAGE_WORKFLOWS`, `MANAGE_ALL_WORKFLOWS`

### 5.3 Form System (Inline with Workflows)

**Dynamic Forms within Workflow Nodes**

**Note:** Forms are created INLINE within workflow nodes. No standalone form builder.

**Service:** `lib/form-service.ts`
**Components:** `components/inline-form-builder.tsx`
**Database:** `form_templates`, `form_responses`

### Form Field Types (12 Total)

| Type | Purpose | Example |
|------|---------|---------|
| text | Short text input | Name, title |
| textarea | Long text input | Description, notes |
| number | Numeric input | Budget, quantity |
| email | Email validation | Contact email |
| date | Date picker | Deadline, start date |
| dropdown | Single selection | Priority, status |
| multiselect | Multiple selections | Tags, categories |
| checkbox | Boolean | Agree to terms |
| file | File upload | Attachment, image |

### Conditional Logic

**Operators:**
- `equals` - Field equals value
- `not_equals` - Field does not equal value
- `greater_than` - Numeric comparison
- `less_than` - Numeric comparison
- `contains` - Text contains substring

**Example:**
```json
{
  "conditional": {
    "field": "service_type",
    "operator": "equals",
    "value": "Web Development"
  }
}
```

### Form Features

- **Dynamic field visibility** based on other field values
- **Required field validation**
- **Field reordering** during creation
- **Response storage** in JSONB
- **Linked to workflow history**
- **Submitter attribution**

**API Routes:**
- `GET /api/workflows/forms/responses` - Get form responses
- `POST /api/workflows/forms/responses` - Submit form
- `GET /api/workflows/history/[historyId]/form` - Get form for history entry

---

## 6. TIME TRACKING & CAPACITY MANAGEMENT

### 6.1 Time Entry System

**Clock Widget + Time Entries Page**

**Components:** `clock-widget.tsx`, `clock-out-dialog.tsx`, `time-entries-*.tsx` (3 components)
**Service:** `lib/services/time-entry-service.ts`
**Database:** `time_entries`, `clock_sessions`

### Clock Widget (Navigation Bar)

| Feature | Description |
|---------|-------------|
| Clock In | Start time tracking session |
| Clock Out | End session, select task/project, log hours |
| Active Indicator | Shows currently clocked in |
| Duration Display | Live session time |
| Discard Session | Cancel without logging |

**Auto Clock-Out Protection:**
- Automatically closes sessions after 16 hours
- Prevents overnight session corruption
- Database function: `auto_clock_out_stale_sessions()`
- Flagged with `is_auto_clock_out = true`

### Time Entries Page (New in Phase 9)

**Location:** `/app/time-entries/page.tsx`

**Three Tabs:**

#### 1. Summary Tab

| Metric | Description |
|--------|-------------|
| Hours this week | Monday-Sunday total |
| Hours this month | Calendar month total |
| Daily average | Last 30 days (only days with entries) |
| Total entries | Count of all entries |

#### 2. List Tab

**Features:**
- Table with all time entries
- Date range filter (default: last 30 days)
- Project dropdown filter
- Task dropdown filter
- Sort by: date, hours, project
- Pagination (20 entries/page)
- Entry details: task, project, hours, date, description
- Clock session indicator

**Actions:**
- **Edit:** Update hours and description (14-day window)
- **Delete:** Permanent removal with confirmation (14-day window)

**14-Day Edit Window:**
```typescript
const daysSinceEntry = differenceInDays(new Date(), entryDate);
const canEdit = daysSinceEntry <= 14;
```

#### 3. Charts Tab

**Visualizations (Recharts):**
1. **Daily Trend Line Chart** - Last 30 days
2. **Bar Chart** - Hours by project
3. **Pie Chart** - Project distribution
4. **Summary Insights:**
   - Most active project
   - Total projects worked on
   - Average daily hours

### Time Entry Features

**Entry Fields:**
- Hours logged (max 24 per entry)
- Entry date
- Week start date (auto-calculated, Monday-based ISO weeks)
- Task association
- Project association
- Description/notes
- Clock session linking (optional)

**Constraints:**
- Max 24 hours per single entry
- ISO week calculation (Monday = week start)
- Automatic task hour accumulation
- Project hour accumulation

**API Routes:**
- `POST /api/clock` - Clock in
- `POST /api/clock/out` - Clock out
- `POST /api/clock/discard` - Discard session
- `GET /api/time-entries` - Get time entries
- `POST /api/time-entries` - Create time entry
- `PUT /api/time-entries/[id]` - Update time entry (14-day window)
- `DELETE /api/time-entries/[id]` - Delete time entry (14-day window)

**Admin Routes:**
- `GET /api/admin/time-entries` - View all entries
- `PUT /api/admin/time-entries/[id]` - Update any entry
- `DELETE /api/admin/time-entries/[id]` - Delete any entry

**Access:**
- Log time: `MANAGE_TIME` (own entries)
- View entries: **Implicit** (own), `VIEW_TIME_ENTRIES` (team), `VIEW_ALL_TIME_ENTRIES` (all)
- Admin: `VIEW_ALL_TIME_ENTRIES`

### 6.2 Availability Management

**Set Work Schedules**

**Location:** `/app/capacity/page.tsx`, Dashboard availability dialog
**Service:** `lib/services/availability-service.ts`
**Components:** `drag-availability-calendar.tsx`, `availability-calendar.tsx`
**Database:** `user_availability`

### Drag-to-Set Availability Calendar

**Features:**
- Visual weekly calendar grid
- Drag to mark unavailable hours
- Hour-by-hour granularity (24 hours × 7 days)
- Gray blocks for unavailable times
- Schedule persistence

**Availability Fields:**
- Week start date (Monday ISO standard)
- Available hours (total per week, default: 40)
- Schedule data (JSONB: hours per day)
- Notes field
- Constraint: Max 168 hours (full week)

**API Routes:**
- `GET /api/availability` - Get user availability
- `POST /api/availability` - Set availability
- `PUT /api/availability` - Update availability

**Access:** Implicit (own availability), admins can manage others

### 6.3 Capacity Planning

**Proportional Capacity Allocation**

**Service:** `lib/services/capacity-service.ts`
**Components:** `capacity-dashboard.tsx`, `capacity-trend-chart.tsx`
**Database:** `user_availability`, `task_week_allocations`, `time_entries`, `weekly_capacity_summary` (view)

### Capacity Metrics

| Metric | Calculation | Purpose |
|--------|-------------|---------|
| **Available Hours** | User capacity ÷ # of accounts | Proportional split |
| **Allocated Hours** | Sum of task estimates for week | Planned work |
| **Actual Hours** | Sum of time entries logged | Completed work |
| **Utilization Rate** | (Actual ÷ Available) × 100 | Productivity % |
| **Remaining Capacity** | Available - Actual | Available time |

### Utilization Interpretation

| Range | Status | Action |
|-------|--------|--------|
| < 60% | Under-utilized | Room for more work |
| 60-80% | Healthy | Good buffer |
| 80-95% | High utilization | Productive team |
| 95-110% | Over-allocated | Risk of burnout |
| > 110% | Critical | Immediate redistribution |

### Proportional Allocation Example

**Problem:** Traditional systems over-count capacity.
- Sarah works 40 hrs/week on 3 accounts
- Traditional: 40 hrs counted for each = 120 hrs total ❌

**MovaLab Solution:** Proportional split
- Sarah's 40 hrs ÷ 3 accounts = 13.3 hrs per account ✅

### Capacity Views

| View | API Route | Scope |
|------|-----------|-------|
| User Capacity | `GET /api/capacity` | Individual metrics |
| Department Capacity | `GET /api/capacity/department` | Department aggregate |
| Account Capacity | `GET /api/capacity/account` | Account aggregate |
| Organization Capacity | `GET /api/capacity/organization` | Company-wide |
| Capacity History | `GET /api/capacity/history` | Historical trends |

### Database View: weekly_capacity_summary

Pre-calculated weekly metrics for performance:
```sql
SELECT
  user_id,
  week_start_date,
  available_hours,
  SUM(allocated_hours) as allocated,
  SUM(actual_hours) as actual,
  (actual / available * 100) as utilization,
  (available - actual) as remaining
FROM (joins on availability, allocations, time_entries)
GROUP BY user_id, week_start_date, available_hours;
```

**Access:**
- View own: **Implicit** (all users)
- View team: `VIEW_TEAM_CAPACITY`
- View all: `VIEW_ALL_CAPACITY`

---

## 7. CLIENT PORTAL

### 7.1 Client Invitations

**Email-Based Client Onboarding**

**Location:** `/app/(main)/admin/client-portal/page.tsx`
**Service:** `lib/client-portal-service.ts`
**Database:** `client_invitations`

### Invitation Flow

1. **Admin sends invitation**
   - Specify email address
   - Set expiry period (1-365 days)
   - Unique token generated

2. **Client receives email**
   - Link to acceptance page
   - Token embedded in URL

3. **Client accepts**
   - Public route: `/api/client/accept-invite/[token]`
   - Token validation
   - Expiry checking
   - Auto-role assignment (client role)
   - Account association

### Invitation Management

| Feature | API Route |
|---------|-----------|
| Send invitation | `POST /api/accounts/[accountId]/invite-client` |
| List invitations | `GET /api/accounts/[accountId]/client-invites` |
| Accept invitation | `GET /api/client/accept-invite/[token]` |

**Invitation Fields:**
- Email address
- Expiry date
- Token (UUID)
- Status (pending, accepted, expired)
- Invited by (user reference)
- Sent timestamp
- Acceptance timestamp

**Access:** `MANAGE_CLIENT_INVITES` permission

### 7.2 Client Feedback System

**Satisfaction Ratings & Feedback**

**API Routes:**
- `POST /api/client/portal/projects/[id]/feedback` - Submit feedback
- `GET /api/accounts/[accountId]/client-feedback` - View feedback
- `GET /api/admin/client-feedback` - Admin view all

**Database:** `client_feedback`

### Feedback Fields

| Field | Type | Purpose |
|-------|------|---------|
| Satisfaction score | Integer (1-10) | Overall rating |
| What went well | Text | Positive feedback |
| What needs improvement | Text | Constructive feedback |
| Project association | UUID | Link to project |
| Client attribution | UUID | Who submitted |
| Submission timestamp | Timestamptz | When submitted |

### Feedback Visualization

**Score Interpretation:**
- **≥ 8:** Positive (green badge, TrendingUp icon)
- **5-7:** Neutral (yellow badge)
- **< 5:** Negative (red badge, TrendingDown icon)

**Statistics:**
- Total feedback count
- Average satisfaction score
- Feedback distribution histogram
- Trend tracking

**Access:**
- Submit: Client role (hardcoded)
- View: Account team members, `MANAGE_CLIENT_INVITES`

### 7.3 Client Portal Project View

**Client-Accessible Project Pages**

**Features:**

| Feature | Access |
|---------|--------|
| View assigned projects | Read-only |
| View project details | Read-only |
| View tasks | Read-only |
| View updates feed | Read-only |
| View workflow progress | Read-only |
| **Approve workflow step** | `POST /api/client/portal/projects/[id]/approve` |
| **Reject workflow step** | `POST /api/client/portal/projects/[id]/reject` |
| **Submit feedback** | Form submission |

### Client Role (Hardcoded Permissions)

**Note:** Client permissions are NOT managed through the permission system. They are hardcoded based on `is_client` flag.

**Client Capabilities:**
1. View assigned projects (read-only)
2. Approve/reject at approval nodes
3. Submit satisfaction feedback
4. View workflow progress
5. View project updates

**Client Navigation:**
- Separate client-specific navigation component
- Dashboard for clients
- Project list view
- Feedback forms

**Access:** Client role (`is_client = true` flag)

---

## Summary Statistics

**Part 2 Features:**
- ✅ Workflow Builder with 8 node types
- ✅ Visual workflow editor with drag-and-drop
- ✅ Inline form builder (12 field types)
- ✅ Workflow execution with multi-path support
- ✅ Clock widget with auto-logout protection
- ✅ Time Entries Page with 3 tabs (Summary/List/Charts)
- ✅ 14-day edit window enforcement
- ✅ Drag-to-set availability calendar
- ✅ Proportional capacity allocation
- ✅ 5 capacity view levels (user/department/account/org/history)
- ✅ Client invitation system
- ✅ Client feedback with 1-10 ratings
- ✅ Client portal with approval capabilities

**Next:** Part 3 covers UI Components, Dashboards, and Admin Features.
