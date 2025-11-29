# Phase 1: API Routes Documentation

This document describes all API routes for Phase 1 (Workflow Foundation).

## Summary

- **30 Total API Routes**
- **10 Admin Workflow Routes**: Workflow template and node management
- **5 Admin Form Routes**: Form template management
- **5 Workflow Execution Routes**: Start workflows, hand off work, view history
- **3 Form Response Routes**: Submit and retrieve form responses
- **7 Client Portal Routes**: Client invitations, projects, feedback

---

## 1. Admin Workflow Routes

### 1.1 Workflow Templates

#### `GET /api/admin/workflows/templates`
**Permission:** `VIEW_WORKFLOWS`
**Description:** List all active workflow templates
**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "id": "uuid",
      "name": "Standard Project Workflow",
      "description": "...",
      "is_active": true,
      "created_by": "uuid",
      "created_at": "2025-...",
      "updated_at": "2025-..."
    }
  ]
}
```

#### `POST /api/admin/workflows/templates`
**Permission:** `MANAGE_WORKFLOWS`
**Body:**
```json
{
  "name": "New Workflow",
  "description": "Workflow description"
}
```
**Response:**
```json
{
  "success": true,
  "template": { ...template object }
}
```

#### `GET /api/admin/workflows/templates/[id]`
**Permission:** `VIEW_WORKFLOWS`
**Description:** Get workflow template with nodes and connections
**Response:**
```json
{
  "success": true,
  "template": {
    ...template fields,
    "nodes": [...nodes],
    "connections": [...connections]
  }
}
```

#### `PATCH /api/admin/workflows/templates/[id]`
**Permission:** `MANAGE_WORKFLOWS`
**Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_active": true
}
```

#### `DELETE /api/admin/workflows/templates/[id]`
**Permission:** `MANAGE_WORKFLOWS`
**Description:** Soft delete (sets is_active = false)

### 1.2 Workflow Nodes

#### `POST /api/admin/workflows/templates/[id]/nodes`
**Permission:** `MANAGE_WORKFLOWS`
**Body:**
```json
{
  "node_type": "department",
  "entity_id": "dept-uuid",
  "position_x": 100,
  "position_y": 200,
  "label": "Design Team",
  "requires_form": true,
  "form_template_id": "form-uuid",
  "settings": {}
}
```

#### `PATCH /api/admin/workflows/nodes/[nodeId]`
**Permission:** `MANAGE_WORKFLOWS`
**Body:** Partial node update

#### `DELETE /api/admin/workflows/nodes/[nodeId]`
**Permission:** `MANAGE_WORKFLOWS`

### 1.3 Workflow Connections

#### `POST /api/admin/workflows/templates/[id]/connections`
**Permission:** `MANAGE_WORKFLOWS`
**Body:**
```json
{
  "from_node_id": "uuid",
  "to_node_id": "uuid",
  "condition": null
}
```

#### `DELETE /api/admin/workflows/connections/[connectionId]`
**Permission:** `MANAGE_WORKFLOWS`

---

## 2. Admin Form Routes

#### `GET /api/admin/forms/templates`
**Permission:** `VIEW_FORMS`
**Description:** List all active form templates

#### `POST /api/admin/forms/templates`
**Permission:** `MANAGE_FORMS`
**Body:**
```json
{
  "name": "Client Intake Form",
  "description": "...",
  "fields": [
    {
      "id": "field_1",
      "type": "text",
      "label": "Client Name",
      "required": true,
      "placeholder": "Enter name..."
    },
    {
      "id": "field_2",
      "type": "dropdown",
      "label": "Service Type",
      "required": true,
      "options": ["Web Design", "Branding", "Marketing"]
    }
  ]
}
```

#### `GET /api/admin/forms/templates/[id]`
**Permission:** `VIEW_FORMS`

#### `PATCH /api/admin/forms/templates/[id]`
**Permission:** `MANAGE_FORMS`

#### `DELETE /api/admin/forms/templates/[id]`
**Permission:** `MANAGE_FORMS`

---

## 3. Workflow Execution Routes

#### `POST /api/workflows/instances/start`
**Permission:** `EXECUTE_WORKFLOWS`
**Description:** Start a workflow instance on a project or task
**Body:**
```json
{
  "workflow_template_id": "uuid",
  "project_id": "uuid",
  "start_node_id": "uuid"
}
```
**Response:**
```json
{
  "success": true,
  "instance": {
    "id": "uuid",
    "workflow_template_id": "uuid",
    "project_id": "uuid",
    "current_node_id": "uuid",
    "status": "active",
    "started_at": "2025-..."
  }
}
```

#### `GET /api/workflows/instances/[id]`
**Permission:** `VIEW_WORKFLOWS` + context check (user assigned to project)
**Description:** Get workflow instance details

#### `GET /api/workflows/instances/[id]/next-nodes`
**Permission:** `VIEW_WORKFLOWS` + context check
**Description:** Get available next nodes from current position
**Response:**
```json
{
  "success": true,
  "next_nodes": [
    {
      "id": "uuid",
      "node_type": "role",
      "label": "Project Manager",
      "requires_form": false
    }
  ]
}
```

#### `POST /api/workflows/instances/[id]/handoff`
**Permission:** `EXECUTE_WORKFLOWS` + context check
**Description:** Hand off work to next node
**Body:**
```json
{
  "to_node_id": "uuid",
  "handed_off_to": "user-uuid",
  "form_response_id": "uuid",
  "notes": "Handoff notes",
  "out_of_order": false
}
```

#### `GET /api/workflows/instances/[id]/history`
**Permission:** `VIEW_WORKFLOWS` + context check
**Description:** Get complete workflow history
**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": "uuid",
      "from_node_id": "uuid",
      "to_node_id": "uuid",
      "handed_off_by": "uuid",
      "handed_off_to": "uuid",
      "handed_off_at": "2025-...",
      "out_of_order": false,
      "notes": "..."
    }
  ]
}
```

---

## 4. Form Response Routes

#### `POST /api/workflows/forms/responses`
**Permission:** `SUBMIT_FORMS`
**Description:** Submit a form response
**Body:**
```json
{
  "form_template_id": "uuid",
  "workflow_history_id": "uuid",
  "response_data": {
    "field_1": "John Doe",
    "field_2": "Web Design"
  }
}
```

#### `GET /api/workflows/forms/responses/[id]`
**Permission:** `VIEW_FORMS` + context check
**Description:** Get form response by ID

#### `GET /api/workflows/history/[historyId]/form`
**Permission:** `VIEW_FORMS` + context check
**Description:** Get form response for a specific workflow history entry

---

## 5. Client Portal Routes

### 5.1 Client Invitations

#### `POST /api/accounts/[id]/invite-client`
**Permission:** `SEND_CLIENT_INVITES` + account manager check
**Description:** Send client portal invitation
**Body:**
```json
{
  "email": "client@example.com",
  "expires_in_days": 7
}
```
**Response:**
```json
{
  "success": true,
  "invitation": {
    "id": "uuid",
    "email": "client@example.com",
    "token": "secure-token",
    "expires_at": "2025-..."
  }
}
```

#### `GET /api/accounts/[id]/client-invites`
**Permission:** Context check (account manager or admin)
**Description:** List client invitations for an account

#### `POST /api/client/accept-invite/[token]`
**Permission:** Public (token-based)
**Description:** Accept client invitation
**Body:**
```json
{
  "name": "John Doe",
  "company_position": "CEO"
}
```

### 5.2 Client Projects

#### `GET /api/client/portal/projects`
**Permission:** `CLIENT_VIEW_PROJECTS` + context check (client's account only)
**Description:** Get all projects for client's account

#### `GET /api/client/portal/projects/[id]`
**Permission:** `CLIENT_VIEW_PROJECTS` + context check
**Description:** Get project details with workflow status

#### `POST /api/client/portal/projects/[id]/approve`
**Permission:** `CLIENT_APPROVE_PROJECTS` + context check + workflow node check
**Description:** Approve project at workflow approval node
**Body:**
```json
{
  "workflow_instance_id": "uuid",
  "notes": "Looks great!"
}
```

#### `POST /api/client/portal/projects/[id]/reject`
**Permission:** `CLIENT_APPROVE_PROJECTS` + context check + workflow node check
**Body:**
```json
{
  "workflow_instance_id": "uuid",
  "notes": "Needs changes to XYZ",
  "issues": ["Issue 1", "Issue 2"]
}
```

### 5.3 Client Feedback

#### `POST /api/client/portal/projects/[id]/feedback`
**Permission:** `CLIENT_PROVIDE_FEEDBACK` + context check
**Body:**
```json
{
  "satisfaction_score": 9,
  "what_went_well": "Great communication",
  "what_needs_improvement": "Faster turnaround",
  "workflow_history_id": "uuid"
}
```

#### `GET /api/admin/client-feedback`
**Permission:** `VIEW_CLIENT_FEEDBACK`
**Description:** Admin view of all client feedback

#### `GET /api/accounts/[id]/client-feedback`
**Permission:** Context check (account manager or admin)
**Description:** View feedback for specific account

---

## Implementation Notes

### Authentication Pattern
All routes follow this pattern:
1. Create Supabase client
2. Get authenticated user
3. Fetch user profile with roles
4. Check permissions
5. Validate request body (Zod)
6. Execute service layer function
7. Return response

### Error Handling
- `401 Unauthorized`: No user session
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `400 Bad Request`: Invalid input
- `500 Internal Server Error`: Server error

### Context Checks
Many routes require context-aware permission checks:
- User must be assigned to project
- User must be account manager
- Client must belong to the account
- User must have access to workflow instance

### Service Layer Integration
All routes use service layer functions from:
- `/lib/workflow-service.ts`
- `/lib/form-service.ts`
- `/lib/client-portal-service.ts`

### Validation
All routes use Zod schemas from `/lib/validation-schemas.ts`

---

## Testing Checklist

- [ ] All routes return correct status codes
- [ ] Permission checks work for all roles
- [ ] Context checks prevent unauthorized access
- [ ] Input validation catches invalid data
- [ ] Service layer errors handled gracefully
- [ ] RLS policies enforced
- [ ] Client portal access properly restricted
- [ ] Workflow handoffs validate connections
- [ ] Form responses validate against templates
- [ ] Out-of-order handoffs tracked correctly
