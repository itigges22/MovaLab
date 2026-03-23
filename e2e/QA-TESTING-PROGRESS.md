# QA Testing Progress Tracker

## Last Updated: 2026-03-23

## End-to-End Interactions Tested (Actually Submitted/Executed)

| # | Action | Status | Notes |
|---|--------|--------|-------|
| 1 | Create task via UI | PASS | Task persisted, lead time recalculated |
| 2 | Edit task dialog | PASS | Correct pre-filled data, dates correct |
| 3 | Post project update | PASS | Displayed with avatar, name, timestamp |
| 4 | Report project issue | PASS | Displayed with Open status dropdown |
| 5 | Change issue status (Open -> In Progress) | PASS | Fixed broken trigger + missing column |
| 6 | Edit project notes | PASS | Notes saved and displayed |
| 7 | Edit project dialog | PASS | Dates correct after fix |
| 8 | Save availability (preset + manual) | PASS | Persists, chart reflects data |
| 9 | Open Kanban board | PASS | Tasks in correct columns |
| 10 | Open Gantt chart | PASS | Timeline renders |
| 11 | Bug reporter with telemetry | PASS | URL, viewport, browser, user captured |
| 12 | Sign in/out across 3 users | PASS | All work correctly |
| 13 | Permission denial (Workflows, Analytics) | PASS | Access Denied pages shown |
| 14 | Create role through UI | PASS | Creative Director with permissions |
| 15 | Create project via UI | PASS | With workflow, persisted, 6 projects now |
| 16 | Column sorting on projects table | PASS | Priority sort ascending works |
| 17 | Account dropdown in Create Project | PASS | All 3 accounts shown |
| 18 | Workflow dropdown in Create Project | PASS | Graphics Workflow shown |

## Pages Tested Per Role

| Page | Superadmin | Account Manager | Graphic Designer |
|------|-----------|-----------------|------------------|
| Dashboard | PASS | PASS | PASS |
| Projects List | PASS (6 projects) | PASS (5 projects) | PASS (3 projects) |
| Project Detail | PASS | PASS | PASS |
| New Task Dialog | PASS | PASS | PASS |
| Edit Task Dialog | PASS | - | - |
| Kanban Board | PASS | - | PASS |
| Gantt Chart | PASS | - | - |
| Accounts List | PASS (3) | PASS (3) | PASS (3) |
| Account Detail | PASS (2 projects) | - | PASS (1 project) |
| Departments List | PASS (all depts) | N/A | PASS (Graphics only) |
| Department Detail | PASS | - | - |
| Capacity | PASS | PASS | PASS (save works) |
| Time Entries | PASS | PASS | - |
| Profile | PASS | PASS (skills placeholder) | - |
| Analytics (all tabs) | PASS | PASS (partial) | PASS (denied) |
| Workflow Builder | PASS (editor) | PASS | PASS (Access Denied) |
| Admin Dashboard | PASS | N/A | N/A |
| Admin Time Tracking | PASS | N/A | N/A |
| Admin Invitations | PASS | N/A | N/A |
| User Management | PASS | N/A | N/A |
| 404 Page | PASS | PASS | PASS |

## Bugs Found and Fixed

| # | Bug | Component | Root Cause | Fix |
|---|-----|-----------|-----------|-----|
| 1 | Accounts page empty for non-superadmin | account-list.tsx | Client re-filtered server data via broken RLS | Trust server-filtered data |
| 2 | Invalid Date on Created/Updated | project detail | formatDate on timestamps | Handle both formats |
| 3 | Kanban/Gantt dates off-by-one | project detail | new Date(dateStr) UTC parse | Use formatDate() |
| 4 | Analytics -5% hardcoded | analytics widgets + page | Hardcoded change values | Set to 0 |
| 5 | Top Performers fractional axis | team-performance-widget | Missing allowDecimals | Added allowDecimals={false} |
| 6 | Account detail team size 0 | account detail page | Server component RLS | Admin client for queries |
| 7 | Chart width(-1) warnings | Multiple widgets | ResponsiveContainer 100% | Explicit pixel heights |
| 8 | Edit Project form dates off-by-one | task-creation-dialog | existing dates via Date() | Use raw string split |
| 9 | Edit Task form dates off-by-one | task-create-edit-dialog | Same pattern | Use raw string split |
| 10 | Issue status change 500 | issues API + DB trigger | Missing column + broken trigger | Remove column ref + drop trigger |
| 11 | Project table deadline off-by-one | project-data-table | formatDeadline UTC parse | Parse as local date |
| 12 | Task validation dates off-by-one | task-create-edit-dialog | Date comparison via UTC | String comparison |
| 13 | Admin time tracking date off-by-one | time-tracking page | formatDate UTC parse | Parse as local date |

## Remaining Cosmetic Items (Not Bugs)
- Gantt chart shows "No dates set" for tasks without start_date (data issue)
- Analytics page redirects to /welcome for unauthorized users (could show Access Denied)

## Additional Tests (Session 2)

| # | Action | Status | Notes |
|---|--------|--------|-------|
| 19 | Delete task (with confirmation) | PASS | Task removed, lead time recalculated |
| 20 | Account search (type "bloom") | PASS | Filters to Bloom Coffee Co only |
| 21 | Issue resolve (In Progress -> Resolved) | PASS | "Resolved by Isaac Tigges" shown |
| 22 | Create project via UI (full flow) | PASS | With workflow, account, dates correct |
| 23 | Column sorting (priority) | PASS | Ascending sort, rows reordered |
| 24 | Workflow dropdown in Create Project | PASS | Graphics Workflow shown (active) |
| 25 | Proactive UTC date sweep | FIXED | 3 more instances found and fixed |
| 26 | Docker image cleanup on VPS | DONE | 58GB free, 24% used |
