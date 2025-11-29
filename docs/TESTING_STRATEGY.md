# TESTING STRATEGY
**PRISM PSA Platform - Comprehensive Testing Strategy**

Last Updated: November 26, 2025

---

## 🎯 Testing Objectives

1. **Performance**: All pages must load in 500ms-1sec
2. **Functionality**: Every feature must work as intended with no errors
3. **Reliability**: Zero Supabase, Vercel, or application errors
4. **Workflows**: All workflows (current and future) must execute correctly
5. **User Experience**: All buttons, forms, and interactions work smoothly

---

## 🛠️ Testing Tools

### Primary Tools
- **Chrome DevTools MCP**: Performance profiling, LCP/TTFB/CLS measurement
- **Supabase MCP**: Database queries, error logs, security advisors
- **Vercel MCP**: Deployment status, build logs, domain management
- **Context7 MCP**: Documentation lookup for debugging

### Performance Metrics
- **LCP (Largest Contentful Paint)**: Target < 1000ms
- **TTFB (Time to First Byte)**: Target < 300ms
- **CLS (Cumulative Layout Shift)**: Target < 0.1
- **FCP (First Contentful Paint)**: Target < 600ms

---

## 📋 Test Categories

### 1. Authentication & Access Control

#### Pages to Test
- `/login` - Login page
- `/signup` - Registration page
- `/forgot-password` - Password reset
- `/reset-password` - Password reset confirmation

#### Test Cases
- [ ] User can sign up with email
- [ ] User can log in with valid credentials
- [ ] User cannot log in with invalid credentials
- [ ] Password reset email is sent
- [ ] Password reset link works correctly
- [ ] Session persistence works
- [ ] Auto-redirect after login works
- [ ] Protected routes redirect to login when not authenticated

#### Performance Targets
- Login page load: < 500ms
- Login submission response: < 800ms
- Signup page load: < 500ms

---

### 2. Dashboard & Home

#### Pages to Test
- `/dashboard` - Main dashboard
- `/` - Home/root redirect

#### Test Cases
- [ ] Dashboard displays user-specific data
- [ ] All widgets load correctly (projects, tasks, capacity, analytics)
- [ ] Real-time data updates work
- [ ] Charts render correctly
- [ ] Quick actions work (create project, create task, log time)
- [ ] No loading state flickers
- [ ] Parallel API calls complete efficiently

#### Performance Targets
- Dashboard load: < 1000ms
- Widget data load: < 500ms each
- Chart rendering: < 200ms

---

### 3. Projects Management

#### Pages to Test
- `/projects` - Project listing
- `/projects/new` - Create new project
- `/projects/[id]` - Project detail view
- `/projects/[id]/edit` - Edit project

#### Test Cases
- [ ] Project list loads with all projects
- [ ] Filtering by status works
- [ ] Search functionality works
- [ ] Create new project form works
- [ ] All project fields save correctly
- [ ] Project assignment works
- [ ] Task creation within project works
- [ ] Project status updates work
- [ ] Project deletion works (with confirmation)
- [ ] Capacity allocation displays correctly
- [ ] Project timeline/Gantt chart renders

#### Performance Targets
- Project list load: < 800ms
- Project detail load: < 700ms
- Project creation: < 1000ms

---

### 4. Accounts Management

#### Pages to Test
- `/accounts` - Account listing
- `/accounts/new` - Create new account
- `/accounts/[id]` - Account detail view
- `/accounts/[id]/edit` - Edit account

#### Test Cases
- [ ] Account list loads correctly
- [ ] Account search works
- [ ] Create account form works
- [ ] All account fields save correctly
- [ ] Contact management works
- [ ] Project association works
- [ ] Account capacity trends display correctly
- [ ] Account status updates work
- [ ] Account deletion works (with confirmation)

#### Performance Targets
- Account list load: < 700ms
- Account detail load: < 600ms
- Capacity trends load: < 800ms

---

### 5. Workflow Builder & Execution

#### Pages to Test
- `/workflows` - Workflow templates listing
- `/workflows/builder` - Visual workflow builder
- `/workflows/[id]` - Workflow template detail
- `/workflows/instances/[id]` - Active workflow instance

#### Test Cases
- [ ] Template list loads correctly
- [ ] Workflow builder canvas loads
- [ ] Node drag-and-drop works
- [ ] Connection drawing works
- [ ] Node configuration saves
- [ ] Approval node setup works
- [ ] Conditional branching works
- [ ] Template save/publish works
- [ ] Workflow instance creation works
- [ ] Approval flow executes correctly
- [ ] Email notifications send
- [ ] Status transitions work
- [ ] Workflow history tracks correctly

#### Performance Targets
- Builder load: < 1200ms
- Canvas rendering: < 300ms
- Node operations: < 100ms
- Save operation: < 800ms

---

### 6. Capacity Planning & Analytics

#### Pages to Test
- `/capacity` - Capacity overview
- `/capacity/planning` - Capacity planning
- `/analytics` - Analytics dashboard

#### Test Cases
- [ ] Organization capacity chart loads
- [ ] User capacity trends display
- [ ] Historical data loads correctly
- [ ] Period switching works (daily/weekly/monthly/quarterly)
- [ ] Availability editing works
- [ ] Allocation calculations are accurate
- [ ] Utilization percentages are correct
- [ ] Analytics charts render correctly
- [ ] Export functionality works
- [ ] Data filters work

#### Performance Targets
- Capacity overview load: < 900ms
- Historical data load: < 800ms
- Chart rendering: < 300ms
- Analytics load: < 1000ms

---

### 7. Time Tracking

#### Pages to Test
- `/time` - Time entry listing
- `/time/new` - Create time entry
- `/time/[id]/edit` - Edit time entry

#### Test Cases
- [ ] Time entry list loads
- [ ] Clock widget works correctly
- [ ] Start/stop timer works
- [ ] Manual time entry works
- [ ] Project/task association works
- [ ] Time entry editing works
- [ ] Time entry deletion works
- [ ] Weekly total calculations are correct
- [ ] Time export works

#### Performance Targets
- Time entry list load: < 600ms
- Timer start/stop: < 200ms
- Entry save: < 500ms

---

### 8. Task Management

#### Pages to Test
- `/tasks` - Task listing
- `/tasks/new` - Create task
- `/tasks/[id]` - Task detail
- `/tasks/[id]/edit` - Edit task

#### Test Cases
- [ ] Task list loads with filters
- [ ] Task creation works
- [ ] Task assignment works
- [ ] Status updates work
- [ ] Due date management works
- [ ] Time estimation works
- [ ] Task dependencies work
- [ ] Comments/notes work
- [ ] File attachments work
- [ ] Task deletion works

#### Performance Targets
- Task list load: < 700ms
- Task detail load: < 500ms
- Task update: < 600ms

---

## 🧪 End-to-End Workflow Tests

### Test Workflow 1: Project Approval
1. Create project requiring approval
2. Submit for approval
3. Approver receives notification
4. Approver reviews and approves
5. Project status updates
6. Notifications sent correctly

### Test Workflow 2: Multi-Stage Approval
1. Create workflow template with 3 approval stages
2. Create project using template
3. Submit project
4. Stage 1 approver approves
5. Stage 2 approver approves
6. Stage 3 approver approves
7. Final status updates correctly

### Test Workflow 3: Conditional Branching
1. Create workflow with conditional logic
2. Create project with condition A
3. Verify correct path is taken
4. Create project with condition B
5. Verify alternate path is taken

---

## 🔍 Error Monitoring

### Supabase Error Checks
- [ ] Query all Supabase logs for errors
- [ ] Check auth service logs
- [ ] Check database logs
- [ ] Check storage logs
- [ ] Check realtime logs
- [ ] Run security advisors
- [ ] Run performance advisors

### Application Error Checks
- [ ] Browser console errors
- [ ] Network request failures
- [ ] React hydration errors
- [ ] API endpoint errors
- [ ] Form validation errors

---

## 👥 Test Account Setup

### User Roles to Create
1. **Admin User**
   - Email: admin.test@prism.test
   - Full permissions
   - Can create workflows, approve, manage users

2. **Manager User**
   - Email: manager.test@prism.test
   - Can create projects, approve workflows
   - Limited admin access

3. **Team Member User**
   - Email: member.test@prism.test
   - Can create tasks, log time
   - No approval permissions

4. **Client User**
   - Email: client.test@prism.test
   - Read-only access to assigned projects
   - Can comment and view progress

---

## 📊 Performance Testing Methodology

### Using Chrome DevTools MCP

1. **Start Performance Trace**
```typescript
performance_start_trace({
  reload: true,
  autoStop: true
})
```

2. **Analyze Results**
- Check LCP, TTFB, CLS metrics
- Review Core Web Vitals
- Analyze Performance Insights
- Identify bottlenecks

3. **Document Findings**
- Record all metrics
- Note any issues
- Track improvements

---

## 📝 Test Execution Workflow

### For Each Page/Feature:
1. ✅ Open page in Chrome DevTools
2. ✅ Start performance trace
3. ✅ Execute all test cases
4. ✅ Stop trace and analyze
5. ✅ Check for console errors
6. ✅ Check Supabase logs
7. ✅ Document results
8. ✅ Fix any issues found
9. ✅ Re-test until pass

---

## 📈 Success Criteria

### Performance
- ✅ All pages load under 1 second
- ✅ All API calls complete under 1 second
- ✅ No performance warnings
- ✅ All Core Web Vitals in green

### Functionality
- ✅ All buttons work
- ✅ All forms submit correctly
- ✅ All calculations are accurate
- ✅ All workflows execute correctly
- ✅ All notifications send

### Reliability
- ✅ Zero console errors
- ✅ Zero Supabase errors
- ✅ Zero Vercel errors
- ✅ Zero failed API calls
- ✅ Zero broken links

---

## 🔄 Continuous Testing

This testing strategy should be executed:
- After every major feature addition
- Before every deployment
- After performance optimizations
- After conversation compacts (refer to TESTING_PROGRESS.md)

---

## 📚 Reference Documentation

- Chrome DevTools Performance API: Use MCP tools
- Supabase Error Codes: Use MCP documentation search
- Next.js Performance: Use Context7 for latest docs
- React Performance: Use Context7 for optimization patterns

---

*This document is living and should be updated as new features are added or testing procedures evolve.*
