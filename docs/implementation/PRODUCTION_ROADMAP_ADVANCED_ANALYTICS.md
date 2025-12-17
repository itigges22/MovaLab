# MovaLab - Advanced Analytics Feature Roadmap
## Production Implementation Guide for Claude Code

---

## 🎯 Development Priorities (CRITICAL)

**TOP PRIORITIES FOR EVERY FEATURE:**
1. **Performance** - Fast page loads, optimized queries, minimal re-renders
2. **Security** - RBAC on every endpoint, RLS on every query, input validation everywhere
3. **Simplicity** - If it requires certification to use, it's too complex. Intuitive UI/UX always.

**NO user should need training to use this platform. Period.**

---

## 🛠️ Required MCP Tools for Claude Code

Claude Code MUST use these MCP servers for development:

1. **context7** - For accessing updated documentation and context
2. **nextjs-dev** - For Next.js development assistance and best practices
3. **chrome-devtools** - For extensive front-end testing and debugging
4. **supabase** - For database schema modifications and migrations
5. **github** - For version control and code review
6. **vercel** - For deployment testing and performance monitoring

**Every feature must be:**
- Tested in Chrome DevTools before marking complete
- Deployed to Vercel staging before production
- Performance-tested (Lighthouse score 90+)
- Security-reviewed (no RBAC bypasses, all inputs validated)

---

## 🔐 RBAC Requirements (APPLIES TO EVERY FEATURE)

**Two Static System Roles:**
- **Superadmin** (`is_superadmin = true`) - Access to EVERYTHING
- **Unassigned** (`role_name = 'Unassigned'`) - Access to almost NOTHING

**EVERY new feature must:**
1. Check RBAC permissions on frontend (hide UI elements user can't access)
2. Check RBAC permissions on backend API routes (reject unauthorized requests)
3. Apply RLS policies on database queries (PostgreSQL level security)
4. Respect context-aware permissions (project assignments, account management)
5. Default to Unassigned users having NO access unless explicitly granted

**New permissions should be added to the 136 existing permissions across 15 categories.**

---

## 📊 Implementation Phases

```
PHASE 1: WORKFLOW FOUNDATION (Core Architecture)
├─ Feature 1: Workflow/Supply Chain Builder (n8n-style visual editor)
├─ Feature 2: Dynamic Request Form Builder (admin-configurable forms)
├─ Feature 3: Client Portal & Account Integration
└─ Feature 4: Workflow Execution Engine (handoff logic, history tracking)

PHASE 2: ANALYTICS FOUNDATION (Data Collection)
├─ Feature 5: ELO Rating System (admin-configurable factors & weights)
├─ Feature 6: Enhanced Wellbeing Analytics (builds on clock in/out)
├─ Feature 7: Workflow Analytics Engine (time in nodes, bottlenecks)
└─ Feature 8: Project Health Indicators Backend (calculation logic)

PHASE 3: DASHBOARD ENHANCEMENTS (Visibility)
├─ Feature 9: Personal Dashboard Enhancement (ELO, trends, insights)
├─ Feature 10: Leadership Capacity Dashboard (color-coded heatmap)
├─ Feature 11: Skills Tracking Integration (with ELO, workflow visibility)
└─ Feature 12: Department/Account Analytics Pages

PHASE 4: ORGANIZATIONAL ANALYTICS (Leadership Tools)
├─ Feature 13: Org Analytics Page Consolidation (executive dashboard)
├─ Feature 14: Collaboration Network Visualization (org analytics addition)
└─ Feature 15: Leadership Intelligence Hub (new permission-gated page)

PHASE 5: RECOGNITION & ENGAGEMENT (Culture Building)
├─ Feature 16: Performance Tier System (leverages ELO + factors)
├─ Feature 17: Welcome Page Enhancement (performance showcase)
├─ Feature 18: Achievements System (admin-configurable badges)
└─ Feature 19: Competitive Challenges (optional gamification)
```

---

## 🚀 PHASE 1: WORKFLOW FOUNDATION

### Feature 1: Workflow/Supply Chain Builder (n8n-style Visual Editor)

**What it does:**
Visual workflow builder where admins create project/task workflows by dragging and dropping nodes. Each node represents a department/role, and connections define valid handoff paths.

**Key Implementation Points:**
- Visual canvas with drag-and-drop nodes (similar to n8n)
- Node types: Department, Role, Client Approval, Conditional Branch
- Each node can require a request form (feature 2)
- Connections show valid handoff paths
- Workflows are templates that projects/tasks follow
- Users can see "next available nodes" when handing off work
- Out-of-order handoffs are documented but allowed (enables innovation)

**Database Structure:**
```
Table: workflow_templates
- id, name, description, created_by, is_active, created_at

Table: workflow_nodes
- id, workflow_template_id, node_type (department/role/client/conditional)
- entity_id (references department/role/account), position_x, position_y
- label, requires_form (boolean), form_template_id
- settings (JSONB - node-specific config)

Table: workflow_connections
- id, workflow_template_id, from_node_id, to_node_id
- condition (JSONB - optional conditional logic)

Table: workflow_instances
- id, workflow_template_id, project_id, task_id (one of these)
- current_node_id, status, started_at, completed_at

Table: workflow_history
- id, workflow_instance_id, from_node_id, to_node_id
- handed_off_by, handed_off_to, handoff_at
- out_of_order (boolean), form_response (JSONB)
- notes, project_update_id, project_issue_id (nullable references)
```

**Integration with Existing Tables:**
- Projects table: Add `workflow_instance_id` (nullable)
- Tasks table: Add `workflow_instance_id` (nullable)
- Project_updates: Add `workflow_history_id` (to tie updates to workflow steps)
- Project_issues: Add `workflow_history_id` (to attribute issues to workflow steps)

**API Endpoints:**
```
POST   /api/admin/workflows/templates        - Create workflow template
GET    /api/admin/workflows/templates        - List all templates
GET    /api/admin/workflows/templates/[id]   - Get template with nodes
PATCH  /api/admin/workflows/templates/[id]   - Update template
DELETE /api/admin/workflows/templates/[id]   - Delete template
POST   /api/admin/workflows/templates/[id]/nodes     - Add node
PATCH  /api/admin/workflows/nodes/[id]                - Update node
DELETE /api/admin/workflows/nodes/[id]                - Delete node
POST   /api/admin/workflows/templates/[id]/connections - Add connection
DELETE /api/admin/workflows/connections/[id]          - Delete connection

POST   /api/workflows/instances/start        - Start workflow instance (assign to project/task)
GET    /api/workflows/instances/[id]         - Get workflow instance with history
GET    /api/workflows/instances/[id]/next-nodes - Get available next nodes for handoff
POST   /api/workflows/instances/[id]/handoff - Hand off work to next node
GET    /api/workflows/instances/[id]/history - Get complete workflow history
```

**UI Components:**
```
Route: /admin/workflows (new admin page)
- Workflow template list with create button
- Each template opens visual editor

Route: /admin/workflows/[id]/editor (new page)
- React Flow or similar canvas library
- Draggable nodes panel (department, role, client nodes)
- Properties panel for selected node (assign form, configure settings)
- Connection tool for linking nodes
- Save/publish controls
- Test workflow button

Component: WorkflowHandoffDialog (used in project/task detail pages)
- Shows current node in workflow
- Displays available next nodes based on connections
- Shows required form (if any) for handoff
- Manual user selection for assignment
- Notes/comments field
- Submit handoff button

Component: WorkflowHistoryTimeline (project/task detail pages)
- Visual timeline of workflow progression
- Shows: node → node transitions with timestamps
- Highlights out-of-order handoffs
- Links to project_updates and project_issues at each step
- Shows who handled work at each node
```

**RBAC Permissions:**
```
New permissions to add:
- manage:workflows (create/edit workflow templates)
- view:workflows (see workflow templates and instances)
- execute:workflows (hand off work in workflows)
- skip:workflow_nodes (permission to hand off out-of-order)
```

**Migration Strategy for Existing Projects/Tasks:**
- Existing projects/tasks have no workflow_instance_id (null)
- Admin can optionally assign workflow templates to existing projects retroactively
- OR new "Default Workflow" template is auto-created and assigned to existing projects
- Workflow history starts from point of migration (no retroactive history)

**ELO System Integration Hook:**
- Workflow handoffs that skip nodes are tracked
- Workflow completion times (node to node) feed into ELO calculations
- Quality ratings (feature 5) are collected at specific workflow nodes

---

### Feature 2: Dynamic Request Form Builder

**What it does:**
Admin creates custom request forms (like your existing DRF, CRF, Post Request forms) that can be attached to workflow nodes. When users hand off work, they fill out the required form.

**Key Implementation Points:**
- Visual form builder with drag-and-drop fields
- Field types: Text, Number, Date, Dropdown, Multi-select, File upload, Text area
- Conditional fields: Show field B only if field A = specific value
- Form templates are reusable across workflow nodes
- Form responses stored as JSONB for flexibility
- Forms can reference existing data (project name, account, etc.) as pre-filled fields

**Database Structure:**
```
Table: form_templates
- id, name, description, created_by, is_active, created_at
- fields (JSONB array of field definitions)

Field definition structure:
{
  id: "field_1",
  type: "text" | "number" | "date" | "dropdown" | "multiselect" | "file" | "textarea",
  label: "Design Specifications",
  required: true,
  placeholder: "Enter specs...",
  options: ["Option 1", "Option 2"], // for dropdown/multiselect
  conditional: {
    show_if: "field_2",
    equals: "value"
  }
}

Table: form_responses
- id, form_template_id, workflow_history_id
- submitted_by, submitted_at
- response_data (JSONB - field_id: value mappings)
```

**API Endpoints:**
```
POST   /api/admin/forms/templates         - Create form template
GET    /api/admin/forms/templates         - List all templates
GET    /api/admin/forms/templates/[id]    - Get template details
PATCH  /api/admin/forms/templates/[id]    - Update template
DELETE /api/admin/forms/templates/[id]    - Delete template

POST   /api/forms/responses                - Submit form response
GET    /api/forms/responses/[id]           - Get form response
GET    /api/workflows/history/[id]/form    - Get form response for workflow step
```

**UI Components:**
```
Route: /admin/forms (new admin page)
- Form template list with create button
- Each template opens form builder

Route: /admin/forms/[id]/builder (new page)
- Field palette (drag field types onto canvas)
- Form preview panel
- Field properties editor (when field selected)
- Conditional logic builder
- Save/publish controls

Component: DynamicFormRenderer (used in WorkflowHandoffDialog)
- Renders form based on form_template fields JSONB
- Handles conditional field visibility
- Validates required fields before submission
- Handles file uploads (stored in Supabase Storage)
- Submits to form_responses table

Component: FormResponseViewer (project/task detail, workflow history)
- Displays submitted form data in readable format
- Shows field labels and submitted values
- Handles file download links
```

**RBAC Permissions:**
```
New permissions:
- manage:forms (create/edit form templates)
- view:forms (see form templates and responses)
- submit:forms (fill out forms during workflow handoffs)
```

**Integration with Existing Forms:**
- Migrate existing DRF, CRF, Post Request forms as form templates
- Create form templates matching their structure
- Associate with relevant workflow nodes
- Existing PDF forms can be replaced or coexist with dynamic forms

---

### Feature 3: Client Portal & Account Integration

**What it does:**
Clients get their own portal to view projects, approve deliverables, and provide feedback. Account creation auto-generates client portal space.

**Key Implementation Points:**
- Every account gets a "client portal" automatically created
- Account managers can send invite emails to client contacts
- Clients create limited accounts with `client:*` permissions
- Clients can only see their account's projects
- Clients appear as final workflow nodes (if workflow includes client approval)
- Client feedback is private (only viewable by admin/account manager)

**Database Structure:**
```
Table: client_portal_invitations
- id, account_id, email, invited_by, invited_at
- token (unique), accepted_at, expires_at, status

Table: client_users (or extend user_profiles with client_type flag)
- user_id, account_id, client_contact_name
- client_contact_email, client_company_position

Table: client_feedback
- id, project_id, workflow_history_id (if via workflow approval)
- client_user_id, satisfaction_score (1-10)
- what_went_well (text), what_needs_improvement (text)
- performance_metrics (JSONB - optional), submitted_at
- visibility (private - only admin/AM see feedback)
```

**API Endpoints:**
```
POST   /api/accounts/[id]/invite-client     - Send client invite email
GET    /api/accounts/[id]/client-invites    - List pending invites
POST   /api/client/accept-invite/[token]    - Accept invite, create client user

GET    /api/client/portal                   - Client's dashboard (their projects)
GET    /api/client/portal/projects          - Client's projects list
GET    /api/client/portal/projects/[id]     - Project detail (client view)
POST   /api/client/portal/projects/[id]/approve   - Approve project
POST   /api/client/portal/projects/[id]/reject    - Reject project (send back in workflow)
POST   /api/client/portal/projects/[id]/feedback  - Submit feedback

GET    /api/admin/client-feedback            - Admin view all client feedback
GET    /api/accounts/[id]/client-feedback     - Account manager view their client feedback
```

**UI Components:**
```
Route: /client/portal (new client-facing route)
- Clean, simplified dashboard for clients
- Shows their projects with statuses
- Projects awaiting approval prominently displayed
- Recent activity feed (their account only)

Route: /client/portal/projects/[id] (project detail for clients)
- Project overview (simplified, non-technical)
- Current status and timeline
- Deliverables/files available for download
- Approve/Reject buttons (if project at client approval node)
- Feedback form (after approval)

Component: ClientInviteDialog (accounts page, account managers)
- Email input for client contact
- Sends invite email with acceptance link
- Shows pending invites

Route: /admin/client-feedback (new admin page)
- Lists all client feedback across accounts
- Filterable by account, date, satisfaction score
- Shows feedback privately (never exposed to general team)
- Analytics: avg satisfaction by account, trending feedback
```

**RBAC Permissions:**
```
New permissions:
- client:view_projects (see their account's projects)
- client:approve_projects (approve/reject at workflow nodes)
- client:provide_feedback (submit feedback)
- view:client_feedback (admin/account managers only)
- send:client_invites (account managers)
```

**Workflow Integration:**
- Workflow nodes can be type "Client Approval"
- When project reaches client approval node, it appears in client portal
- Client approval moves workflow forward, rejection moves backward
- Rejection creates workflow_history entry with out_of_order flag
- Client feedback form appears after approval

**Migration for Existing Accounts:**
- Run migration: Create client portal space for all existing accounts
- Account managers notified to invite clients
- Accounts without client users continue functioning normally
- Client portal is opt-in for accounts that want it

---

### Feature 4: Workflow Execution Engine (Backend Logic)

**What it does:**
Core business logic that powers workflow handoffs, enforces workflow rules, tracks history, and integrates with projects/tasks.

**Key Implementation Points:**
- Service layer functions for workflow operations
- Validates handoffs against workflow template connections
- Creates workflow_history entries for audit trail
- Links project_updates and project_issues to workflow steps
- Handles out-of-order handoffs (documents them, allows them)
- Automatically updates project/task current_node_id

**Implementation (Service Layer):**
```typescript
// lib/workflow-service.ts

async function startWorkflowInstance(params: {
  workflowTemplateId: string;
  projectId?: string;
  taskId?: string;
  startedBy: string;
}): Promise<WorkflowInstance>
  - Creates workflow_instance
  - Sets current_node_id to starting node
  - Returns instance with starting node details

async function getNextAvailableNodes(params: {
  workflowInstanceId: string;
}): Promise<WorkflowNode[]>
  - Queries workflow_connections from current_node_id
  - Returns array of valid next nodes
  - Includes node details (department, role, form requirements)

async function handoffWorkflow(params: {
  workflowInstanceId: string;
  toNodeId: string;
  assignedToUserId: string;
  formResponseData?: object;
  notes?: string;
}): Promise<WorkflowHistory>
  - Validates handoff is valid (or marks out_of_order)
  - Creates form_response if form required
  - Creates workflow_history entry
  - Updates workflow_instance current_node_id
  - Assigns project/task to new user
  - Returns history entry

async function getWorkflowHistory(params: {
  workflowInstanceId: string;
}): Promise<WorkflowHistory[]>
  - Returns complete workflow progression
  - Includes user details, form responses, timestamps
  - Includes linked project_updates and project_issues

async function completeWorkflow(params: {
  workflowInstanceId: string;
  completedBy: string;
}): Promise<void>
  - Marks workflow_instance as completed
  - Updates related project/task status to complete
  - Creates final workflow_history entry
```

**Integration Points:**
- Project creation: Optionally select workflow template
- Task creation: Inherit workflow from project OR select separately
- Project/task assignment: Respect workflow current node (assign to users in that department/role)
- Project updates: Link to current workflow_history_id
- Project issues: Link to workflow_history_id where issue occurred
- Time entries: Analyze by workflow node (time spent at each stage)

**Background Jobs (if needed):**
- Auto-escalate stalled workflows (if project stuck at node for X days)
- Notify users when work handed off to them
- Generate workflow analytics (avg time at each node, bottlenecks)

**RBAC Integration:**
- Check `execute:workflows` permission for handoffs
- Check node-specific permissions (if node is "Leadership Review", check leadership permissions)
- Allow superadmin to force-handoff to any node
- Log all handoffs with user attribution for audit

---

## 🧮 PHASE 2: ANALYTICS FOUNDATION

### Feature 5: ELO Rating System (Admin-Configurable)

**What it does:**
Replaces simple quality ratings with an ELO scoring system that adjusts based on performance outcomes. Admin configures factors and weights per role.

**Key Implementation Points:**
- Each user has ELO scores per role (separate ELO for Graphics, Copy, Account Management)
- Admin configures factors that influence ELO (deadline adherence, client satisfaction, revisions, etc.)
- Admin sets weights for each factor per role
- ELO updates automatically based on project/task outcomes
- ELO displayed when assigning work (shows user skill level)
- Admin can turn ELO system on/off if it causes culture issues

**Database Structure:**
```
Table: elo_configuration
- id, role_id, is_enabled (boolean per role)
- factors (JSONB array of factor definitions)
- created_by, updated_at

Factor definition structure:
{
  factor_id: "deadline_adherence",
  factor_label: "Meeting Deadlines",
  weight: 0.40, // 40%
  calculation_method: "percentage", // or "boolean", "score_1_10"
  elo_impact: {
    excellent: +25, // criteria met excellently
    good: +10,
    neutral: 0,
    poor: -10,
    critical: -25
  }
}

Predefined factors (admin selects and configures):
- deadline_adherence (% of deadlines met)
- client_satisfaction (1-10 score from client feedback)
- revision_frequency (how many times work sent back)
- workflow_efficiency (time spent vs. estimated time)
- collaboration_rating (peer ratings during workflow)
- quality_rating (peer 1-10 ratings)
- project_completion_rate (% of assigned projects completed)
- peer_feedback_score (aggregated peer feedback)

Table: user_elo_scores
- id, user_id, role_id
- current_elo (default: 1500), peak_elo, lowest_elo
- last_updated, total_projects_counted

Table: elo_history
- id, user_id, role_id, project_id, task_id (one of these)
- previous_elo, new_elo, delta, calculated_at
- factors_applied (JSONB - which factors triggered change and by how much)
```

**ELO Calculation Logic:**
```typescript
// lib/elo-service.ts

async function calculateELO(params: {
  userId: string;
  roleId: string;
  projectId?: string;
  taskId?: string;
}): Promise<number>
  - Get elo_configuration for role
  - Get user's current ELO from user_elo_scores
  - Calculate each factor's performance:
    - deadline_adherence: Did they meet deadline? (boolean or %)
    - client_satisfaction: Get client_feedback score
    - revision_frequency: Count workflow backwards movements
    - workflow_efficiency: actual_hours / estimated_hours
    - quality_rating: avg of quality ratings received
  - Apply factor weights from configuration
  - Calculate ELO delta based on factor performance
  - Update user_elo_scores and create elo_history entry
  - Return new ELO

async function getELOLeaderboard(params: {
  roleId?: string;
  limit?: number;
}): Promise<ELOLeaderboard[]>
  - Get top ELO scores (optionally filtered by role)
  - Returns user details + current ELO + role

async function getUserELOHistory(params: {
  userId: string;
  roleId?: string;
}): Promise<ELOHistory[]>
  - Get user's ELO progression over time
  - Optionally filter by specific role
  - Returns chart-ready time series data
```

**Standardization Approach (Solving "Tomatoes to Airplanes"):**
- Each role has its own ELO scale (Graphics ELO vs Copy ELO)
- ELO is NOT compared across roles (no "org-wide ELO leaderboard")
- Instead: "Graphics ELO Leaderboard" and "Copy ELO Leaderboard" separate
- Display ELO as role-relative: "Graphics ELO: 1650 (85th percentile among Graphics designers)"
- Admin sets baseline ELO per role (some roles start at 1500, others at 1200 based on typical difficulty)
- OR use percentile rankings within role ("Top 15% of Account Managers")

**Admin Configuration Page:**
```
Route: /admin/elo-configuration (new admin page card)
- Tab for each role (Graphics, Copy, Account Management, etc.)
- Per role:
  - Enable/Disable ELO toggle
  - Factor selection (checkboxes for predefined factors)
  - Weight sliders for each selected factor (must sum to 100%)
  - ELO impact configuration (excellent, good, neutral, poor, critical)
  - Preview calculation example
  - Save configuration

UI: Factor Configuration
- Factor name: "Deadline Adherence"
- Weight: [Slider: 40%]
- Impact levels:
  - Excellent (100% deadlines met): +25 ELO
  - Good (90-99%): +10 ELO
  - Neutral (80-89%): 0 ELO
  - Poor (60-79%): -10 ELO
  - Critical (<60%): -25 ELO
```

**API Endpoints:**
```
GET    /api/admin/elo-configuration               - Get all role configurations
GET    /api/admin/elo-configuration/[roleId]      - Get role's configuration
PATCH  /api/admin/elo-configuration/[roleId]      - Update role configuration
POST   /api/admin/elo-configuration/[roleId]/toggle - Enable/disable ELO for role

GET    /api/elo/user/[userId]                     - Get user's ELO across all roles
GET    /api/elo/user/[userId]/history             - Get user's ELO history
GET    /api/elo/leaderboard                       - Get ELO leaderboards (by role)
POST   /api/elo/calculate                         - Trigger ELO calculation (auto or manual)
```

**UI Display (Assignment Interfaces):**
```
When assigning project/task to user:
- Show user's relevant role ELO
- Example: "Sarah (Graphics Designer) - ELO: 1680 (92nd percentile)"
- Sort assignment options by ELO (highest first) + capacity
- Visual indicator: 🔥 High ELO, ⭐ Above Average, 📈 Improving
```

**RBAC Permissions:**
```
New permissions:
- manage:elo_configuration (admin configure factors/weights)
- view:elo_scores (see ELO leaderboards and user scores)
- view:own_elo (users always see their own ELO)
```

**Automatic ELO Triggers:**
- Project completion: Calculate ELO for all assigned users
- Task completion: Calculate ELO if task is significant (>8 hours estimated)
- Client feedback submission: Recalculate ELO incorporating satisfaction
- Workflow completion: Calculate ELO based on workflow efficiency
- Manual trigger: Admin can force recalculation for a user

**Migration for Existing Users:**
- All users start at default ELO (1500 or role-specific baseline)
- Retroactive calculation: Optionally calculate ELO from historical project data
- OR start fresh: ELO begins calculating from feature deployment forward

---

### Feature 6: Enhanced Wellbeing Analytics

**What it does:**
Builds on existing `workload_sentiment` field in user_profiles. Tracks wellbeing over time, displays trends, alerts leadership when sentiment declines.

**Key Implementation Points:**
- Prompt users for sentiment (1-10) when clocking in/out
- Store sentiment history for trend analysis
- Display personal sentiment trends on dashboard
- Leadership sees team wellbeing on capacity dashboard
- Auto-alerts when user's sentiment drops significantly

**Database Structure:**
```
Table: sentiment_history
- id, user_id, sentiment_score (1-10)
- context (clock_in, clock_out, weekly_checkin)
- timestamp, notes (optional user notes on why they feel that way)

// user_profiles.workload_sentiment already exists - now actively used
```

**API Endpoints:**
```
POST   /api/wellbeing/record                  - Record sentiment (triggered by clock in/out)
GET    /api/wellbeing/user/[userId]/history   - Get user's sentiment history
GET    /api/wellbeing/user/[userId]/current   - Get current sentiment + trend
GET    /api/wellbeing/department/[id]         - Dept avg sentiment + trends
GET    /api/wellbeing/organization            - Org-wide sentiment metrics
GET    /api/wellbeing/alerts                  - Users with declining sentiment
```

**UI Components:**
```
Enhancement to existing clock in/out widget:
- After clicking "Clock In" or "Clock Out", show:
  "How manageable is your workload? (1-10)"
  [1] [2] [3] [4] [5] [6] [7] [8] [9] [10]
  Optional: "Any notes?" [text field]
  - 5 second interaction, optional skip button
  - Updates user_profiles.workload_sentiment
  - Creates sentiment_history entry

Personal Dashboard enhancement (existing /dashboard route):
- New card: "Your Wellbeing Trend"
- Line chart showing sentiment over past 30 days
- Current sentiment score prominently displayed
- Color-coded: Green (7-10), Yellow (4-6), Red (1-3)

Leadership Capacity Dashboard enhancement:
- Add wellbeing column to capacity heatmap
- Show avg sentiment per user
- Color-code users: Green (healthy), Yellow (neutral), Red (at risk)
- Filter: "Show only users with declining sentiment"
```

**Leadership Alerts:**
```
Automated alerts (via notifications or email):
- Trigger: User's sentiment drops 3+ points in 2 weeks
- Trigger: User's sentiment <4 for 3 consecutive check-ins
- Trigger: User's sentiment + high workload (>90% utilization)
- Notification: "Check in with [User] - wellbeing score declining"
```

**RBAC Permissions:**
```
Use existing permissions:
- view:team_capacity (see team wellbeing)
- view:all_capacity (see org-wide wellbeing)
```

**Integration with Capacity Calculations:**
- Capacity status (Green/Yellow/Red) now factors in sentiment
- Red capacity = high utilization OR low sentiment OR both
- Capacity recommendations consider sentiment when assigning work

---

### Feature 7: Workflow Analytics Engine

**What it does:**
Analyzes workflow_history to identify bottlenecks, measure time at each node, and surface inefficiencies.

**Key Implementation Points:**
- Calculate avg time spent at each workflow node
- Identify nodes where work consistently stalls
- Count revision loops (backward workflow movements)
- Compare workflow efficiency across departments/accounts
- Display analytics on department/account dashboards

**Database Structure:**
```
// Uses existing workflow_history table from Feature 1
// Analytical queries, no new tables needed

Optional: Materialized view for performance
CREATE MATERIALIZED VIEW workflow_analytics AS
SELECT 
  workflow_template_id,
  node_id,
  AVG(time_at_node) as avg_time,
  COUNT(*) as total_handoffs,
  COUNT(CASE WHEN out_of_order THEN 1 END) as out_of_order_count
FROM workflow_history
GROUP BY workflow_template_id, node_id;
```

**Analytics Calculations:**
```typescript
// lib/workflow-analytics-service.ts

async function getWorkflowBottlenecks(params: {
  workflowTemplateId: string;
}): Promise<BottleneckAnalysis[]>
  - Query workflow_history for this template
  - Calculate avg time at each node
  - Identify nodes with longest avg times
  - Return sorted list of bottleneck nodes

async function getRevisionFrequency(params: {
  workflowTemplateId?: string;
  departmentId?: string;
  dateRange?: [Date, Date];
}): Promise<RevisionStats>
  - Count backward workflow movements (out_of_order = true)
  - Calculate revision rate (revisions / total handoffs)
  - Return per node revision stats

async function getWorkflowEfficiency(params: {
  workflowTemplateId: string;
}): Promise<EfficiencyMetrics>
  - Calculate total workflow time (first node → completion)
  - Compare against estimated total time
  - Calculate efficiency score
  - Return metrics with comparisons

async function getDepartmentWorkflowPerformance(params: {
  departmentId: string;
}): Promise<DepartmentWorkflowStats>
  - Get all workflows involving this department
  - Calculate avg time dept spends on their workflow nodes
  - Compare to other departments
  - Return comparative analysis
```

**API Endpoints:**
```
GET    /api/analytics/workflow/bottlenecks         - Org-wide bottlenecks
GET    /api/analytics/workflow/[templateId]/bottlenecks - Workflow-specific bottlenecks
GET    /api/analytics/workflow/revisions            - Revision frequency analysis
GET    /api/analytics/workflow/efficiency           - Workflow efficiency metrics
GET    /api/analytics/workflow/department/[id]      - Dept workflow performance
GET    /api/analytics/workflow/project/[id]         - Single project workflow analysis
```

**UI Components:**
```
Route: /admin/workflows/[id]/analytics (add analytics tab to workflow editor)
- Bottleneck visualization (nodes color-coded by avg time)
- Time spent chart (bar chart showing avg time per node)
- Revision frequency heatmap (which nodes cause most revisions)
- Out-of-order handoffs list (innovation or mistakes?)

Component: WorkflowTimelineAnalytics (on project detail page)
- Visual timeline showing actual time spent at each node
- Compare to typical time at each node
- Highlight delays or faster-than-usual nodes
```

**Integration Points:**
- Department dashboards: Show workflow efficiency metrics
- Account dashboards: Show which accounts have smooth workflows
- Project health indicators: Factor in workflow stagnation
- ELO calculations: Workflow efficiency impacts ELO

**RBAC Permissions:**
```
New permission:
- view:workflow_analytics (see workflow analytics dashboards)
```

---

### Feature 8: Project Health Indicators Backend Logic

**What it does:**
Implements real calculation logic for existing frontend project health badges (currently using mock data).

**Key Implementation Points:**
- Calculate health status based on multiple factors
- Factors: deadline proximity, workflow stagnation, open issues, hours over estimate
- Auto-recalculate on project changes
- Store health status and last calculated timestamp
- Health history tracking optional

**Health Calculation Algorithm:**
```typescript
// lib/project-health-service.ts

async function calculateProjectHealth(projectId: string): Promise<HealthStatus>

RED (Critical) if ANY:
- Past end_date and status != 'complete'
- No workflow_history activity in 72+ hours (if workflow enabled)
- No project_updates in 72+ hours
- 3+ open project_issues with status = 'open'
- actual_hours > 150% of estimated_hours

YELLOW (At Risk) if ANY:
- Within 3 days of end_date and status = 'planning' or 'in_progress'
- No activity in 48+ hours
- 2 open project_issues
- actual_hours > 120% of estimated_hours
- Workflow stuck at same node for 48+ hours

GREEN (Healthy):
- Everything else
- On track, activity regular, minimal issues

Return: {
  status: 'green' | 'yellow' | 'red',
  factors: string[], // which factors triggered this status
  calculated_at: timestamp
}
```

**Database Structure:**
```
Add to projects table:
- health_status (enum: green, yellow, red)
- health_calculated_at (timestamp)
- health_factors (JSONB array of reasons)

Optional:
Table: project_health_history
- id, project_id, health_status, factors, calculated_at
```

**API Endpoints:**
```
GET    /api/projects/[id]/health          - Get project health
POST   /api/projects/[id]/recalculate-health - Force recalculation
GET    /api/projects/health-summary        - All projects health distribution
GET    /api/projects/health/alerts         - Red/Yellow projects
```

**Automatic Recalculation Triggers:**
- Project update posted → recalculate
- Project issue created/resolved → recalculate
- Workflow handoff → recalculate
- Time entry logged → recalculate
- Daily cron job → recalculate all projects

**UI Integration:**
```
Existing UI (Kanban, lists, project detail) already shows health badges
Now these badges display real calculated status instead of mock data

Enhancement to project detail page:
- Show health status prominently at top
- List factors contributing to status
- "Health History" chart (if enabled) showing status over time
```

**RBAC Integration:**
- Use existing view:projects permission
- Health status visible to anyone who can see the project

---

## 📊 PHASE 3: DASHBOARD ENHANCEMENTS

### Feature 9: Personal Dashboard Enhancement

**What it does:**
Enhances existing `/dashboard` route with ELO scores, wellbeing trends, workflow insights, and performance metrics.

**Key Implementation Points:**
- Existing dashboard is foundation - ADD new sections
- Show ELO scores by role with trends
- Display wellbeing sentiment chart
- Show recent workflow handoffs and current assignments
- Performance metrics: completion rate, avg quality, utilization
- Keep existing capacity, project updates, clock widget

**UI Enhancements:**
```
Route: /dashboard (existing - enhance with new cards)

New Cards to Add:

Card: "Your ELO Scores"
- Show ELO for each role user has
- Example: "Graphics Designer: 1650 ELO (85th percentile) ↑ +25"
- Mini line chart showing ELO trend past 30 days
- Link to detailed ELO history page

Card: "Wellbeing & Workload"
- Current sentiment score (large display)
- Sentiment trend line chart (30 days)
- Current utilization % (from existing capacity data)
- Color-coded status: Green/Yellow/Red

Card: "Active Workflows"
- List current projects/tasks in workflows
- Show: current node, next available nodes, time at current node
- Quick handoff buttons

Card: "Performance Summary"
- Completion rate (% of assigned tasks completed on time)
- Avg quality rating received (if quality ratings exist)
- Total projects completed this month/quarter
- Client satisfaction avg (if applicable)

Keep Existing:
- Capacity widget
- Clock in/out widget
- Assigned tasks list
- Project updates feed
- Upcoming deadlines
```

**API Endpoints:**
```
GET    /api/dashboard/personal             - Aggregate personal dashboard data
  Returns:
    - ELO scores by role
    - Wellbeing trend
    - Active workflows
    - Performance summary
    - Existing capacity/tasks/updates
```

**RBAC:**
- Users always see their own dashboard (no permission needed)

---

### Feature 10: Leadership Capacity Dashboard Enhancement

**What it does:**
Enhances existing capacity dashboard at `/dashboard/capacity` with color-coded heatmap, wellbeing integration, and forecasting.

**Key Implementation Points:**
- Existing capacity page shows hours/utilization - enhance with health indicators
- Add color-coded user grid (Green/Yellow/Red capacity status)
- Integrate wellbeing scores into capacity status
- Add forecasting (predicted bottlenecks based on upcoming deadlines)
- Filter by department, account, role

**UI Enhancements:**
```
Route: /dashboard/capacity (existing - enhance)

New Section: "Team Capacity Heatmap"
- Grid of users (cards or tiles)
- Each user shows:
  - Name, role, photo
  - Current utilization % (existing data)
  - Wellbeing sentiment score
  - Background color: Green/Yellow/Red based on capacity status
  - Active project count
- Click user → drill into detailed capacity view

Capacity Status Calculation:
GREEN: <70% utilization, sentiment 7+, quality 7+
YELLOW: 70-90% utilization, sentiment 5-7, quality 6+
RED: >90% utilization OR sentiment <5 OR quality <6

New Section: "Capacity Forecast"
- Chart showing upcoming capacity vs demand
- Based on: upcoming task due dates + estimated hours
- Alert: "Graphics dept will exceed capacity in 2 weeks"

Enhanced Filters:
- Department dropdown
- Account dropdown
- Date range selector
- Capacity status (show only Red, only Yellow, etc.)

New Section: "Users Needing Attention"
- List users in Red status
- Show: declining sentiment, overwork, quality issues
- Quick actions: "Reassign workload", "Send check-in message"
```

**API Endpoints:**
```
GET    /api/capacity/leadership/heatmap    - User capacity statuses
GET    /api/capacity/leadership/forecast   - Predicted bottlenecks
GET    /api/capacity/leadership/alerts     - Users at risk
```

**RBAC Permissions:**
- `view:team_capacity` (see your department)
- `view:all_capacity` (see org-wide)

---

### Feature 11: Skills Tracking Integration

**What it does:**
Enhances existing `skills` JSONB field in user_profiles. Tracks skill application through workflow, displays skills on assignment interfaces, integrated with ELO.

**Key Implementation Points:**
- Skills are tagged on tasks/projects during creation
- Skills are confirmed/updated on workflow completion
- Skills displayed when assigning work (match skills to task requirements)
- Skills progression tracked (beginner → intermediate → advanced)
- Skills contribute to ELO calculations

**Database Structure:**
```
Table: skill_definitions
- id, name, category, description

Table: user_skills
- user_id, skill_id, proficiency_level (1-3: beginner, intermediate, advanced)
- evidence_count (# of projects/tasks using this skill)
- last_used_at, created_at

Table: task_skills
- task_id, skill_id, required (boolean), applied (boolean)

Table: project_skills
- project_id, skill_id, required, applied
```

**API Endpoints:**
```
GET    /api/skills                          - List all skill definitions
GET    /api/skills/user/[userId]            - User's skill portfolio
POST   /api/skills/user/[userId]            - Add/update user skill
POST   /api/skills/task/[taskId]            - Tag task with skills
GET    /api/skills/match                    - Find users by skill requirements
GET    /api/skills/department/[id]          - Dept skill distribution
```

**UI Components:**
```
Component: SkillTagging (on task/project creation)
- Multi-select dropdown of skill_definitions
- Mark skills as "required" vs "nice to have"
- Saves to task_skills or project_skills

Component: SkillMatchDisplay (on assignment interfaces)
- When assigning task, show users with required skills
- Example: "Sarah - Has skills: Graphic Design (Advanced), Branding (Intermediate)"
- Sort by skill match + capacity + ELO

User Profile Enhancement:
- "Skills" section showing skill_definitions with proficiency levels
- Evidence count: "Applied on 15 projects"
- Last used date

Admin Page: /admin/skills
- Manage skill_definitions (CRUD operations)
- Create skill categories
- View org-wide skill coverage
```

**Workflow Integration:**
- Task requires "Graphic Design" skill
- Workflow handoff shows users with Graphic Design skill
- On completion, user's Graphic Design evidence_count increments
- Proficiency level auto-upgrades after X applications

**ELO Integration:**
- Skills contribute to ELO if configured in elo_configuration
- Example factor: "skill_diversity" (how many skills user has)
- Higher proficiency in relevant skills → bonus ELO

**RBAC Permissions:**
```
New permissions:
- manage:skills (admin manage skill_definitions)
- view:team_skills (see department skill distribution)
```

---

### Feature 12: Department & Account Analytics Pages

**What it does:**
Creates dedicated analytics pages for department heads and account managers with aggregate performance metrics.

**Key Implementation Points:**
- Dept analytics: quality avg, capacity, collaboration, skills, wellbeing, ELO distribution
- Account analytics: client satisfaction, project health, hours invested, timeline performance
- Comparative benchmarking (dept vs org avg, account vs account)
- Drill-down to individuals or projects

**Database Structure:**
```
// No new tables - aggregate queries on existing data

Optional for performance:
Materialized views for dept/account aggregates
Refresh daily or on-demand
```

**API Endpoints:**
```
GET    /api/analytics/department/[id]           - Dept aggregate metrics
GET    /api/analytics/department/[id]/trends    - Historical trends
GET    /api/analytics/account/[id]              - Account metrics
GET    /api/analytics/account/[id]/trends       - Historical trends
GET    /api/analytics/comparison/departments    - Dept comparison
GET    /api/analytics/comparison/accounts       - Account comparison
```

**UI Components:**
```
Route: /dashboard/departments/[id]/analytics (new route or tab on dept page)

Department Analytics Page:
- Overview Cards:
  - Avg Quality Score (with trend)
  - Capacity Utilization %
  - Active Projects Count
  - Wellbeing Avg Sentiment
  
- Charts:
  - Quality trend over time
  - Capacity utilization by week
  - ELO distribution histogram
  - Skill coverage matrix
  
- Collaboration Section:
  - Cross-dept collaboration count
  - Collaboration network mini-graph (dept-focused)
  
- Team Performance:
  - List of team members with key metrics
  - Sortable/filterable table
  - Drill down to individual dashboards

Route: /dashboard/accounts/[id]/analytics (new route or tab on account page)

Account Analytics Page:
- Overview Cards:
  - Client Satisfaction Avg (with trend)
  - Projects Completed This Quarter
  - Hours Invested
  - Project Health Distribution (% Green/Yellow/Red)
  
- Charts:
  - Satisfaction trend over time
  - Project completion timeline
  - Hours invested by project type
  - Workflow efficiency (if workflows used)
  
- Team Composition:
  - List of assigned team members
  - Skills representation
  - Capacity allocation to this account
  
- Project List:
  - All projects for this account
  - Health status, completion %, owner
  - Click to drill into project details
```

**RBAC Permissions:**
```
New permissions:
- view:department_analytics (dept heads see their dept)
- view:account_analytics (account managers see their accounts)
- view:all_analytics (admins/execs see everything)
```

**Comparative Benchmarking:**
- Show: "Graphics Dept Quality: 7.8 vs Org Avg: 7.4"
- Show: "Account X Satisfaction: 8.2 vs Account Avg: 7.6"
- Helps contextualize performance

---

## 🎯 PHASE 4: ORGANIZATIONAL ANALYTICS

### Feature 13: Org Analytics Page Consolidation

**What it does:**
Consolidates and enhances existing org analytics page with executive-level metrics, comprehensive trends, and strategic insights.

**Key Implementation Points:**
- Existing route appears to be capacity trends - expand to full org analytics
- Add: org-wide quality, satisfaction, health distribution, ELO, wellbeing
- Add: department comparisons, account comparisons
- Add: predictive indicators (forecasts, alerts)
- Keep existing capacity trends chart

**UI Enhancements:**
```
Route: /dashboard/org-analytics (existing - expand)

Current: Capacity Trends Chart (keep this)

Add Overview Cards:
- Avg Org Quality Score (with trend arrow)
- Overall Capacity Utilization %
- Client Satisfaction Index (avg across accounts)
- Project Health Distribution (pie: % Green/Yellow/Red)
- Avg Wellbeing Score
- Active Projects Count
- Completion Rate (% projects on time)

Add Charts:
- Quality Score Trend (line chart over quarters/years)
- Capacity Utilization Trend (existing - enhance)
- Client Satisfaction Trend
- Project Health Over Time
- Collaboration Density (how connected is org)
- ELO Distribution (histogram across org)

Add Comparison Tables:
- Department Performance Comparison (quality, capacity, etc.)
- Account Performance Comparison (satisfaction, hours, etc.)

Add Predictive Alerts Section:
- "Forecasted Capacity Bottlenecks" (based on upcoming deadlines)
- "Declining Satisfaction Trends" (accounts with downward trends)
- "At-Risk Projects" (current Red/Yellow projects)
- "Team Members Needing Support" (low wellbeing, overwork)

Add Drill-Down Links:
- Click dept name → go to dept analytics
- Click account name → go to account analytics
- Click project health → see list of unhealthy projects
```

**API Endpoints:**
```
GET    /api/analytics/organization          - All org-wide metrics
GET    /api/analytics/organization/trends   - Historical trends
GET    /api/analytics/organization/forecasts - Predictive indicators
GET    /api/analytics/organization/comparisons - Dept/account comparisons
```

**RBAC Permissions:**
```
Use existing:
- view:org_analytics (execs, admins)
- view:all_capacity (included)
```

---

### Feature 14: Collaboration Network Visualization

**What it does:**
Interactive network graph showing who collaborates with whom. Added as a section on org analytics page.

**Key Implementation Points:**
- D3.js or similar for network graph rendering
- Nodes = users, edges = collaboration (shared projects)
- Edge thickness = collaboration frequency
- Node color = department
- Interactive: click node to see details, filter by time/dept

**UI Implementation:**
```
Add to: /dashboard/org-analytics page

New Section: "Collaboration Network"
- Full-width interactive graph
- Nodes: all active users
- Edges: shared project assignments or stakeholder relationships
- Edge weight: # of shared projects (thicker = more collaboration)
- Node color: department
- Node size: total project count or collaboration breadth

Interactivity:
- Click node → highlight connected nodes, show user details panel
- Filter by department (show only dept's collaborations)
- Filter by date range (show collaborations in time period)
- Filter by intensity (hide weak connections, show only strong)

Insights Panel:
- "Most Connected Users" (highest collaboration count)
- "Cross-Dept Bridges" (users connecting siloed depts)
- "Isolated Users" (low collaboration count)
- "Department Silos" (depts that rarely collaborate with others)
```

**API Endpoints:**
```
GET    /api/collaboration/network           - Graph data (nodes + edges)
GET    /api/collaboration/metrics           - Collaboration metrics
GET    /api/collaboration/user/[id]         - Individual collaboration network
```

**Graph Calculation:**
```typescript
// lib/collaboration-service.ts

async function generateCollaborationGraph(params: {
  departmentId?: string;
  dateRange?: [Date, Date];
  minCollaborations?: number;
}): Promise<NetworkGraph>
  - Query project_assignments + project_stakeholders
  - Find users who share projects
  - Count shared projects (edge weight)
  - Return: { nodes: User[], edges: { from, to, weight }[] }

async function getCollaborationMetrics(): Promise<CollaborationMetrics>
  - Calculate avg collaborations per person
  - Identify most connected users
  - Identify cross-dept bridges
  - Calculate dept collaboration matrix
```

**RBAC Permissions:**
```
Use existing:
- view:org_analytics (see full network)
- Regular users see their personal network on their dashboard
```

---

### Feature 15: Leadership Intelligence Hub

**What it does:**
New permission-gated page showing personalized insights for leadership roles. More detailed than org analytics, includes people-level insights.

**Key Implementation Points:**
- New route with strict RBAC (only users with permission see it)
- Shows: team member performance details, wellbeing alerts, ELO progressions
- Automated weekly intelligence report integrated into this page
- Action items: check-ins needed, capacity redistributions, recognition opportunities

**UI Implementation:**
```
Route: /dashboard/leadership-hub (new route)
Access: view:leadership_intelligence permission

Page Sections:

Section: "This Week's Intelligence"
- Auto-generated summary (like Feature 14's weekly report)
- Projects at risk (Red/Yellow)
- Team members needing attention (declining wellbeing, low ELO)
- Capacity alerts (upcoming bottlenecks)
- Positive highlights (achievements, improvements)

Section: "Team Performance"
- Sortable/filterable table of all users
- Columns: Name, Role, ELO, Utilization %, Wellbeing, Tier, Projects Active
- Click user → detailed drill-down

Section: "Action Items"
- "Check In With" (users flagged for support)
- "Recognize" (users with recent achievements)
- "Redistribute Work" (users overloaded + users with capacity)
- Each item has quick action buttons

Section: "Trends & Forecasts"
- Charts showing org trends (quality, capacity, satisfaction)
- Predictive indicators (bottlenecks, risks)
- Recommendations based on data

Section: "Department Health"
- Cards for each department
- Show: capacity status, quality avg, wellbeing avg
- Click → go to dept analytics
```

**API Endpoints:**
```
GET    /api/leadership/intelligence         - Aggregated leadership data
GET    /api/leadership/alerts               - Action items and alerts
GET    /api/leadership/team-performance     - Team member metrics
GET    /api/leadership/weekly-report        - Auto-generated report
```

**RBAC Permissions:**
```
New permission:
- view:leadership_intelligence (leadership, execs, admins)
```

**Automated Weekly Report Integration:**
```
Instead of emailing weekly report (Feature 14 original concept):
- Generate report data weekly
- Display on this page under "This Week's Intelligence"
- Optionally still email as summary with link to hub
- Report data refreshes weekly Monday mornings
```

**Navigation:**
- Add to nav bar if user has permission
- Show between Analytics and Admin in nav

---

## 🏆 PHASE 5: RECOGNITION & ENGAGEMENT

### Feature 16: Performance Tier System

**What it does:**
Assigns users to performance tiers (Contributor, Skilled, Specialist, High Performer, Leadership Track) based on ELO and other factors.

**Key Implementation Points:**
- Tiers are separate from roles (roles = job function, tiers = performance level)
- Tier criteria based on: ELO, completion rate, collaboration, client satisfaction
- Admin-configurable thresholds for tier advancement
- Automatic tier assignment (weekly or monthly)
- Tier advancement notifications and celebrations

**Database Structure:**
```
Table: performance_tier_definitions
- id, name, display_order, description
- criteria (JSONB - ELO thresholds, completion rate, etc.)
- benefits (text - what unlocks at this tier)

Default tiers:
1. Contributor (baseline)
2. Skilled Contributor
3. Cross-Functional Specialist
4. High Performer
5. Leadership Track

Table: user_tier_assignments
- user_id, tier_id, assigned_at, metrics_snapshot (JSONB)

Table: tier_history
- user_id, tier_id, start_date, end_date
```

**Admin Configuration Page:**
```
Route: /admin/performance-tiers (new admin page card)

For each tier:
- Name and description
- Criteria configuration:
  - Min ELO (if ELO enabled)
  - Min completion rate %
  - Min collaboration count
  - Min client satisfaction
  - Min quality rating
  - All criteria must be met OR weighted score
- Benefits text (what unlocks)
- Save configuration
```

**Tier Calculation Logic:**
```typescript
// lib/tier-service.ts

async function assignUserTier(userId: string): Promise<Tier>
  - Get user metrics: ELO, completion rate, collaboration count, etc.
  - Get tier_definitions sorted by display_order (highest first)
  - Check if user meets criteria for each tier (top-down)
  - Assign highest tier user qualifies for
  - Create user_tier_assignment or update existing
  - Create tier_history entry if tier changed
  - Return assigned tier

async function calculateTierCriteriaMet(userId: string, tierId: string): Promise<object>
  - Check each criterion for this tier
  - Return: { elo: true/false, completion_rate: true/false, ... }
  - Used for "gap analysis" (what user needs for next tier)
```

**API Endpoints:**
```
GET    /api/tiers                           - All tier definitions
GET    /api/tiers/user/[userId]             - User's current tier
GET    /api/tiers/user/[userId]/history     - User's tier history
GET    /api/tiers/user/[userId]/requirements - Gap analysis for next tier
POST   /api/admin/tiers/calculate           - Trigger tier calculation (all users)
```

**UI Components:**
```
Personal Dashboard:
- Tier badge prominently displayed
- "Progress to Next Tier" section showing gap analysis

Profile Pages:
- Tier badge visible on user profiles
- Tier history timeline

Tier Advancement Notification:
- When user advances tier, show celebration modal
- "Congratulations! You've advanced to High Performer tier"
- List benefits unlocked
```

**RBAC Permissions:**
```
New permissions:
- manage:performance_tiers (admin configure tiers)
- view:tier_assignments (leadership see tier distribution)
```

**Automatic Calculation:**
- Weekly cron job calculates tiers for all users
- Notifications sent to users who advanced or dropped tier
- Leadership notified of tier changes

---

### Feature 17: Welcome Page Enhancement (Performance Showcase)

**What it does:**
Enhances existing welcome page with performance highlights, leaderboards, and celebrations.

**Key Implementation Points:**
- Existing welcome page has project updates card and newsletter card
- ADD: Performance spotlight, leaderboards, recent achievements
- Keep existing layout, add new sections

**UI Enhancements:**
```
Route: / or /dashboard/home (existing welcome page - enhance)

Current: Project Updates Card + Newsletter Card (keep these)

Add New Section: "Performance Spotlight"
- "Performer of the Month" (highest ELO gain or highest tier user)
- Show: photo, name, role, tier, recent achievement
- "Department of the Month" (highest avg quality + lowest stagnation)
- Show: dept name, key metrics

Enhance Project Updates Card:
- Instead of ALL project updates, show:
  - Recent significant updates (high-priority projects only)
  - Achievement unlocks ("Sarah earned 'Client Delight' badge")
  - Tier advancements ("Mike advanced to High Performer")
  - Project completions (major projects only)
- Essentially become "Activity Highlights" card

Add New Section: "Leaderboards" (optional, collapsible)
- Tabs for different metrics: ELO, Quality Score, Collaboration
- Top 5 users per metric
- Opt-in visibility (users can hide themselves from leaderboards)

Add New Section: "Active Challenges" (if Feature 19 enabled)
- Show current competitions with standings
- Link to challenges page
```

**API Endpoints:**
```
GET    /api/welcome/spotlight               - Performer/dept of month
GET    /api/welcome/activity-highlights     - Recent significant activities
GET    /api/welcome/leaderboards            - Top performers by metric
```

**RBAC:**
- Welcome page visible to all authenticated users

---

### Feature 18: Achievements System (Admin-Configurable)

**What it does:**
Badge/achievement system where admin defines achievements and users earn them automatically.

**Key Implementation Points:**
- Admin creates achievement definitions with criteria
- Achievements auto-awarded when criteria met
- Displayed on profiles and dashboards
- Celebration notifications when earned

**Database Structure:**
```
Table: achievement_definitions
- id, name, description, category, badge_image_url
- criteria (JSONB - how it's earned)
- rarity (common, rare, legendary)
- is_active (boolean)

Criteria structure:
{
  type: "collaboration_count" | "elo_threshold" | "project_count" | "quality_avg" | "client_satisfaction",
  threshold: 10, // varies by type
  timeframe: "all_time" | "month" | "quarter"
}

Table: user_achievements
- user_id, achievement_id, earned_at
- progress (JSONB - for tracking progress toward achievement)
```

**Admin Page:**
```
Route: /admin/achievements (new admin page card)

Achievement List:
- Show all achievement_definitions
- Create button

Create/Edit Achievement:
- Name, description
- Category dropdown (Collaboration, Quality, Volume, Client Satisfaction, etc.)
- Badge image upload
- Rarity selector
- Criteria configuration:
  - Type dropdown (collaboration_count, elo_threshold, etc.)
  - Threshold value
  - Timeframe
- Active toggle
- Save
```

**Achievement Types (Predefined Options):**
```
Collaboration:
- "Silo Breaker" - Collaborated with 10+ users
- "Bridge Builder" - Collaborated across 5+ departments

Quality:
- "Quality Champion" - Maintained 9.0+ avg quality for 3 months
- "Zero Revisions" - 10 projects with no revisions required

Volume:
- "Workhorse" - Completed 50+ projects in semester
- "Speed Demon" - Completed 10 projects in 1 month

Client Satisfaction:
- "Client Delight" - Received 9.5+ satisfaction on 5+ projects
- "Client Champion" - 100% client satisfaction over quarter

Improvement:
- "Rising Star" - ELO improved 200+ points in quarter
- "Comeback Kid" - Recovered from low tier to high performer

Skills:
- "Generalist" - Proficient in 5+ skills
- "Specialist" - Advanced level in 1 skill
```

**API Endpoints:**
```
POST   /api/admin/achievements              - Create achievement
GET    /api/admin/achievements              - List all achievements
PATCH  /api/admin/achievements/[id]         - Update achievement
DELETE /api/admin/achievements/[id]         - Delete achievement

GET    /api/achievements/user/[userId]      - User's earned achievements
POST   /api/achievements/check              - Check and award achievements (cron job)
GET    /api/achievements/progress/[userId]  - Progress toward unearned achievements
```

**UI Components:**
```
User Profile:
- "Achievements" section showing badge grid
- Click badge → show details (earned date, description)

Personal Dashboard:
- "Recent Achievements" widget (newly earned badges)
- "Progress" widget (close to earning achievements)

Achievement Unlock Notification:
- Modal popup: "Achievement Unlocked! Silo Breaker"
- Show badge image and description
- Close button

Welcome Page:
- "Recent Achievements" feed (within enhanced project updates card)
```

**Automatic Awarding:**
```
Daily/weekly cron job:
- Query users and their metrics
- Check against all active achievement_definitions criteria
- Award achievements where criteria met
- Create user_achievements entries
- Send notifications to users
```

**RBAC Permissions:**
```
New permissions:
- manage:achievements (admin create/edit achievements)
```

---

### Feature 19: Competitive Challenges (Optional Gamification)

**What it does:**
Time-bound competitions (MVP of Month, Quality Sprint, etc.) with leaderboards and prizes. OPTIONAL feature, implement last.

**Key Implementation Points:**
- Admin creates challenges with duration and criteria
- Challenges can be individual, department, or account-based
- Real-time leaderboards
- Winners announced and featured

**Database Structure:**
```
Table: challenges
- id, name, description, type (individual/department/account)
- start_date, end_date, status (active/completed)
- criteria (JSONB - how it's scored)
- prizes (text)

Table: challenge_participants
- challenge_id, participant_id (user/dept/account)
- current_score, rank, last_updated

Table: challenge_winners
- challenge_id, winner_id, final_score, prize_awarded
```

**Admin Page:**
```
Route: /admin/challenges (new admin page card)

Create Challenge:
- Name, description
- Type: Individual, Department, Account
- Start/end dates
- Scoring criteria (ELO gain, quality improvement, collaboration count, etc.)
- Prizes (text description)
- Launch button
```

**User-Facing Page:**
```
Route: /dashboard/challenges (new route)

Active Challenges:
- List of active challenges
- Each shows: name, time remaining, current leaderboard
- User's current rank (if participating)

Challenge Detail:
- Full leaderboard
- Rules and prizes
- Real-time score updates
```

**API Endpoints:**
```
POST   /api/admin/challenges                - Create challenge
GET    /api/challenges/active               - List active challenges
GET    /api/challenges/[id]/leaderboard     - Challenge leaderboard
POST   /api/challenges/[id]/complete        - End challenge, announce winners
```

**RBAC Permissions:**
```
New permissions:
- manage:challenges (admin create challenges)
```

---

## 📝 Implementation Notes for Claude Code

### General Development Guidelines

**1. Performance Optimization:**
- Use React Server Components for data fetching (already used in existing app)
- Minimize client-side state (use server components where possible)
- Implement proper database indexing on foreign keys, timestamps, user_id fields
- Use Supabase RLS for security (never bypass with service role in client-facing APIs)
- Paginate large lists (project lists, user lists, etc.)
- Cache expensive calculations (ELO, workflow analytics) using materialized views or Redis

**2. Security Requirements:**
- EVERY API route must check RBAC permissions
- Use existing `requirePermission` middleware pattern
- Validate ALL inputs with Zod schemas
- Never expose sensitive data (client feedback, private ELO, sentiment scores) without permission checks
- Respect RLS policies on all database queries
- Rate limit public endpoints (already implemented with Upstash Redis)

**3. UI/UX Simplicity:**
- Follow existing design patterns (shadcn/ui components, Tailwind classes)
- Use consistent card layouts, typography, spacing
- Avoid information overload (progressive disclosure, collapsible sections)
- Mobile-responsive (all features must work on tablet/phone)
- Loading states for async operations
- Error states with helpful messages
- Success confirmations for destructive actions

**4. Testing Strategy:**
- Use Chrome DevTools to test each feature
- Test RBAC: Verify unassigned users have no access, verify permission checks work
- Test with multiple user roles (admin, dept head, regular user, client)
- Test performance: Lighthouse scores 90+ on all pages
- Test database queries: Verify RLS policies work correctly
- Test edge cases: Empty states, error states, large datasets

**5. Migration Strategy:**
- ALL database changes must have migrations in `supabase/migrations/`
- Migrations must be reversible where possible
- Existing data must not be lost (add columns as nullable, backfill if needed)
- Test migrations on staging before production

### MCP Tool Usage

**context7:**
- Load project context at start of each feature implementation
- Reference existing code patterns (API routes, service layers, components)
- Load FEATURELIST.md for database schema understanding

**nextjs-dev:**
- Ask for Next.js 14 App Router best practices
- Server Component vs Client Component decisions
- API route patterns
- Caching strategies

**chrome-devtools:**
- Test every new UI component
- Check console for errors
- Verify network requests (no failed API calls)
- Test responsive design breakpoints
- Check Lighthouse performance scores

**supabase:**
- Create migrations for new tables
- Set up RLS policies for new tables
- Test RLS policies with different user roles
- Create indexes for performance

**github:**
- Commit after each feature (not mid-feature)
- Clear commit messages describing feature added
- Branch per phase (phase-1-workflow, phase-2-analytics, etc.)

**vercel:**
- Deploy to staging after each phase
- Test deployed version (catch environment-specific bugs)
- Monitor performance metrics
- Check build logs for warnings

### Feature Implementation Checklist

For EACH feature, Claude Code must:

- [ ] Create database migration files
- [ ] Set up RLS policies
- [ ] Create API endpoints with RBAC checks
- [ ] Create Zod validation schemas for inputs
- [ ] Implement service layer business logic
- [ ] Create UI components (Server Components preferred)
- [ ] Add RBAC permission checks to UI
- [ ] Test with Chrome DevTools
- [ ] Verify unassigned users cannot access
- [ ] Verify superadmin can access everything
- [ ] Test mobile responsiveness
- [ ] Check Lighthouse performance score
- [ ] Deploy to staging and test
- [ ] Document any new permissions added
- [ ] Update existing code if integration needed

### Deployment & Rollout

**Phase-by-Phase Deployment:**
1. Deploy Phase 1 (Workflow Foundation) to staging → test heavily → production
2. Train admins on workflow builder → admins create workflows → enable for users
3. Deploy Phase 2 (Analytics Foundation) → verify data collection → production
4. Deploy Phase 3 (Dashboard Enhancements) → users see new dashboards → gather feedback
5. Deploy Phase 4 (Org Analytics) → leadership reviews → adjust as needed
6. Deploy Phase 5 (Recognition) → soft launch → iterate based on culture response

**Rollback Plan:**
- Each phase must be independently reversible
- Feature flags for enabling/disabling new features
- Database migrations must not break existing features
- Keep old pages/routes functional during transition

---

## 🎉 Success Criteria

**Feature implementation is successful when:**

1. **Performance:** All pages load in <2 seconds, Lighthouse scores 90+
2. **Security:** No RBAC bypasses, all RLS policies working, no data leaks
3. **Simplicity:** New users understand features without training
4. **RBAC:** Unassigned users have no access, superadmin has full access, permissions work correctly
5. **Integration:** New features work seamlessly with existing platform
6. **Adoption:** Users actually use the features (track via analytics)
7. **Culture:** Features improve culture (measure via wellbeing scores, feedback)
8. **Scalability:** System handles 100+ users, 1000+ projects without performance issues

**Metrics to Track Post-Launch:**
- Feature adoption rate (% users using new features)
- Page load times (must remain fast)
- Error rates (minimize bugs)
- User satisfaction (collect feedback)
- RBAC violations (should be zero)
- Performance scores (maintain 90+ Lighthouse)

---

## 📚 Additional Resources

**Documentation to Reference:**
- Existing FEATURELIST.md (database schema, current features)
- Existing SECURITY.md (security patterns, RLS examples)
- Supabase docs (Row Level Security, real-time, storage)
- Next.js 14 docs (App Router, Server Components, API routes)
- shadcn/ui docs (component library)
- React Flow docs (for workflow canvas)

**Key Existing Patterns to Follow:**
- Permission checking: Use `requirePermission` middleware in API routes
- Database queries: Use Supabase RLS (never service role on client-facing routes)
- UI components: Follow shadcn/ui patterns (Card, Button, Dialog, etc.)
- Service layer: Business logic in `/lib/*-service.ts` files
- API routes: Follow `/app/api/*` structure with proper error handling

---

**This roadmap provides the complete implementation plan for Claude Code. Each feature is designed to integrate seamlessly with the existing MovaLab platform while maintaining the core principles of performance, security, and simplicity.**
