import { UserWithRoles, PermissionContext } from './rbac-types';
import { createClientSupabase } from './supabase';
import { logger, permissionCheck, databaseQuery, databaseError } from './debug-logger';

// Re-export for backwards compatibility
export type { PermissionContext };

// Define all system permissions (following hybrid approach: base + override + context)
export enum Permission {
  // ========================================
  // ROLE MANAGEMENT PERMISSIONS
  // ========================================
  CREATE_ROLE = 'create_role',
  EDIT_ROLE = 'edit_role',
  DELETE_ROLE = 'delete_role',
  VIEW_ROLES = 'view_roles',
  ASSIGN_USERS_TO_ROLES = 'assign_users_to_roles',
  REMOVE_USERS_FROM_ROLES = 'remove_users_from_roles',
  VIEW_ACCOUNTS_TAB = 'view_accounts_tab',
  ASSIGN_ACCOUNT_USERS = 'assign_account_users',
  REMOVE_ACCOUNT_USERS = 'remove_account_users',
  MANAGE_USERS = 'manage_users',
  
  // ========================================
  // DEPARTMENT PERMISSIONS
  // ========================================
  CREATE_DEPARTMENT = 'create_department',
  EDIT_DEPARTMENT = 'edit_department',
  DELETE_DEPARTMENT = 'delete_department',
  VIEW_DEPARTMENTS = 'view_departments',
  VIEW_ALL_DEPARTMENTS = 'view_all_departments', // Override permission
  
  // ========================================
  // ACCOUNT PERMISSIONS
  // ========================================
  CREATE_ACCOUNT = 'create_account',
  EDIT_ACCOUNT = 'edit_account',
  DELETE_ACCOUNT = 'delete_account',
  VIEW_ACCOUNTS = 'view_accounts',
  VIEW_ALL_ACCOUNTS = 'view_all_accounts', // Override permission
  
  // ========================================
  // PROJECT PERMISSIONS
  // ========================================
  CREATE_PROJECT = 'create_project',
  EDIT_PROJECT = 'edit_project',
  DELETE_PROJECT = 'delete_project',
  VIEW_PROJECTS = 'view_projects',
  VIEW_ALL_PROJECTS = 'view_all_projects', // Override permission
  EDIT_ALL_PROJECTS = 'edit_all_projects', // Override permission
  DELETE_ALL_PROJECTS = 'delete_all_projects', // Override permission
  ASSIGN_PROJECT_USERS = 'assign_project_users',
  REMOVE_PROJECT_USERS = 'remove_project_users',
  
  // ========================================
  // PROJECT UPDATES PERMISSIONS
  // ========================================
  VIEW_UPDATES = 'view_updates',
  CREATE_UPDATE = 'create_update',
  EDIT_UPDATE = 'edit_update',
  DELETE_UPDATE = 'delete_update',
  VIEW_ALL_PROJECT_UPDATES = 'view_all_project_updates', // Override permission - Can view ALL project updates
  VIEW_ASSIGNED_PROJECTS_UPDATES = 'view_assigned_projects_updates', // Only updates from assigned projects
  VIEW_DEPARTMENT_PROJECTS_UPDATES = 'view_department_projects_updates', // Only updates from department projects
  VIEW_ACCOUNT_PROJECTS_UPDATES = 'view_account_projects_updates', // Only updates from account projects
  
  // ========================================
  // PROJECT ISSUES PERMISSIONS
  // ========================================
  VIEW_ISSUES = 'view_issues',
  CREATE_ISSUE = 'create_issue',
  EDIT_ISSUE = 'edit_issue',
  DELETE_ISSUE = 'delete_issue',
  
  // ========================================
  // TASK PERMISSIONS (DEPRECATED - Now inherited from project access)
  // Tasks are managed within project pages. If user has project access, they can manage tasks.
  // These are kept for backwards compatibility but are no longer used.
  // ========================================

  // ========================================
  // TABLE VIEW PERMISSIONS (for project table view in accounts)
  // ========================================
  VIEW_TABLE = 'view_table',
  EDIT_TABLE = 'edit_table', // Allows deleting projects, assigning users, etc. in table view
  
  // ========================================
  // NEWSLETTER PERMISSIONS
  // ========================================
  VIEW_NEWSLETTERS = 'view_newsletters',
  CREATE_NEWSLETTER = 'create_newsletter',
  EDIT_NEWSLETTER = 'edit_newsletter',
  DELETE_NEWSLETTER = 'delete_newsletter',
  
  // ========================================
  // ANALYTICS PERMISSIONS
  // ========================================
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_DEPARTMENT_ANALYTICS = 'view_department_analytics',
  VIEW_ALL_ANALYTICS = 'view_all_analytics', // Override permission
  
  // ========================================
  // PROFILE PERMISSIONS
  // ========================================
  VIEW_OWN_PROFILE = 'view_own_profile',
  EDIT_OWN_PROFILE = 'edit_own_profile',
  
  // ========================================
  // CAPACITY & TIME TRACKING PERMISSIONS
  // ========================================
  EDIT_OWN_AVAILABILITY = 'edit_own_availability', // Set personal weekly availability
  VIEW_OWN_CAPACITY = 'view_own_capacity', // View personal capacity metrics
  VIEW_TEAM_CAPACITY = 'view_team_capacity', // View team/department capacity
  VIEW_ALL_CAPACITY = 'view_all_capacity', // View org-wide capacity (override)
  LOG_TIME = 'log_time', // Log time entries on tasks
  LOG_TIME_ALL_PROJECT_TASKS = 'log_time_all_project_tasks', // Log time to any task in assigned projects
  EDIT_OWN_TIME_ENTRIES = 'edit_own_time_entries', // Edit/delete own time entries
  VIEW_TEAM_TIME_ENTRIES = 'view_team_time_entries', // View team time entries
  EDIT_TEAM_TIME_ENTRIES = 'edit_team_time_entries', // Edit/delete team time entries
  ALLOCATE_TASK_WEEKS = 'allocate_task_weeks', // Allocate tasks to specific weeks
  VIEW_CAPACITY_ANALYTICS = 'view_capacity_analytics', // View capacity analytics dashboard

  // ========================================
  // WORKFLOW MANAGEMENT PERMISSIONS
  // ========================================
  MANAGE_WORKFLOWS = 'manage_workflows', // Create/edit workflow templates
  VIEW_WORKFLOWS = 'view_workflows', // See workflow templates and instances
  EXECUTE_WORKFLOWS = 'execute_workflows', // Hand off work in workflows
  SKIP_WORKFLOW_NODES = 'skip_workflow_nodes', // Hand off out-of-order (innovation tracking)

  // ========================================
  // FORM MANAGEMENT PERMISSIONS
  // ========================================
  MANAGE_FORMS = 'manage_forms', // Create/edit form templates
  VIEW_FORMS = 'view_forms', // See form templates and responses
  SUBMIT_FORMS = 'submit_forms', // Fill out forms during workflow handoffs

  // ========================================
  // CLIENT PORTAL PERMISSIONS
  // ========================================
  CLIENT_VIEW_PROJECTS = 'client_view_projects', // Client: view their account's projects
  CLIENT_APPROVE_PROJECTS = 'client_approve_projects', // Client: approve/reject at workflow nodes
  CLIENT_PROVIDE_FEEDBACK = 'client_provide_feedback', // Client: submit feedback
  VIEW_CLIENT_FEEDBACK = 'view_client_feedback', // Admin/AM: see client feedback (private)
  SEND_CLIENT_INVITES = 'send_client_invites', // Account managers: invite clients
}

// Human-readable permission definitions
export const PermissionDefinitions: Record<Permission, { name: string; description: string; category: string; isOverride?: boolean }> = {
  // ========================================
  // ROLE MANAGEMENT PERMISSIONS
  // ========================================
  [Permission.CREATE_ROLE]: {
    name: 'Create Roles',
    description: 'Create new roles in the system',
    category: 'Roles'
  },
  [Permission.EDIT_ROLE]: {
    name: 'Edit Roles',
    description: 'Modify existing role settings and permissions',
    category: 'Roles'
  },
  [Permission.DELETE_ROLE]: {
    name: 'Delete Roles',
    description: 'Remove roles from the system',
    category: 'Roles'
  },
  [Permission.VIEW_ROLES]: {
    name: 'View Roles',
    description: 'View roles and their configurations',
    category: 'Roles'
  },
  [Permission.ASSIGN_USERS_TO_ROLES]: {
    name: 'Assign Users to Roles',
    description: 'Assign users to specific roles and approve pending user registrations',
    category: 'Roles'
  },
  [Permission.REMOVE_USERS_FROM_ROLES]: {
    name: 'Remove Users from Roles',
    description: 'Remove users from their assigned roles',
    category: 'Roles'
  },
  [Permission.VIEW_ACCOUNTS_TAB]: {
    name: 'View Accounts Tab',
    description: 'View the Accounts tab in Role Management page',
    category: 'Roles'
  },
  [Permission.ASSIGN_ACCOUNT_USERS]: {
    name: 'Assign Users to Accounts',
    description: 'Add users to accounts from the Accounts tab in Role Management',
    category: 'Roles'
  },
  [Permission.REMOVE_ACCOUNT_USERS]: {
    name: 'Remove Users from Accounts',
    description: 'Remove users from accounts from the Accounts tab in Role Management',
    category: 'Roles'
  },
  [Permission.MANAGE_USERS]: {
    name: 'Manage Users',
    description: 'Full user management capabilities - view, edit, and delete users',
    category: 'Roles'
  },
  
  // ========================================
  // DEPARTMENT PERMISSIONS
  // ========================================
  [Permission.CREATE_DEPARTMENT]: {
    name: 'Create Departments',
    description: 'Create new departments',
    category: 'Departments'
  },
  [Permission.EDIT_DEPARTMENT]: {
    name: 'Edit Departments',
    description: 'Modify department settings and configurations',
    category: 'Departments'
  },
  [Permission.DELETE_DEPARTMENT]: {
    name: 'Delete Departments',
    description: 'Remove departments',
    category: 'Departments'
  },
  [Permission.VIEW_DEPARTMENTS]: {
    name: 'View Departments',
    description: 'View departments user belongs to',
    category: 'Departments'
  },
  [Permission.VIEW_ALL_DEPARTMENTS]: {
    name: 'View All Departments',
    description: 'View all departments across the organization (override)',
    category: 'Departments',
    isOverride: true
  },
  
  // ========================================
  // ACCOUNT PERMISSIONS
  // ========================================
  [Permission.CREATE_ACCOUNT]: {
    name: 'Create Accounts',
    description: 'Create new client accounts',
    category: 'Accounts'
  },
  [Permission.EDIT_ACCOUNT]: {
    name: 'Edit Accounts',
    description: 'Modify account information',
    category: 'Accounts'
  },
  [Permission.DELETE_ACCOUNT]: {
    name: 'Delete Accounts',
    description: 'Remove client accounts',
    category: 'Accounts'
  },
  [Permission.VIEW_ACCOUNTS]: {
    name: 'View Accounts',
    description: 'View accounts user has access to',
    category: 'Accounts'
  },
  [Permission.VIEW_ALL_ACCOUNTS]: {
    name: 'View All Accounts',
    description: 'View all accounts across the organization (override)',
    category: 'Accounts',
    isOverride: true
  },
  
  // ========================================
  // PROJECT PERMISSIONS
  // ========================================
  [Permission.CREATE_PROJECT]: {
    name: 'Create Projects',
    description: 'Create new projects in assigned accounts',
    category: 'Projects'
  },
  [Permission.EDIT_PROJECT]: {
    name: 'Edit Projects',
    description: 'Edit projects user is assigned to',
    category: 'Projects'
  },
  [Permission.DELETE_PROJECT]: {
    name: 'Delete Projects',
    description: 'Delete projects user has access to',
    category: 'Projects'
  },
  [Permission.VIEW_PROJECTS]: {
    name: 'View Projects',
    description: 'View projects user is assigned to',
    category: 'Projects'
  },
  [Permission.VIEW_ALL_PROJECTS]: {
    name: 'View All Projects',
    description: 'View all projects outside of assigned ones (override)',
    category: 'Projects',
    isOverride: true
  },
  [Permission.EDIT_ALL_PROJECTS]: {
    name: 'Edit All Projects',
    description: 'Edit any project regardless of assignment (override)',
    category: 'Projects',
    isOverride: true
  },
  [Permission.DELETE_ALL_PROJECTS]: {
    name: 'Delete All Projects',
    description: 'Delete any project regardless of assignment (override)',
    category: 'Projects',
    isOverride: true
  },
  [Permission.ASSIGN_PROJECT_USERS]: {
    name: 'Assign Users to Projects',
    description: 'Assign team members to projects',
    category: 'Projects'
  },
  [Permission.REMOVE_PROJECT_USERS]: {
    name: 'Remove Users from Projects',
    description: 'Remove team members from projects',
    category: 'Projects'
  },
  
  // ========================================
  // PROJECT UPDATES PERMISSIONS
  // ========================================
  [Permission.VIEW_UPDATES]: {
    name: 'View Project Updates',
    description: 'View project updates in project pages',
    category: 'Updates'
  },
  [Permission.CREATE_UPDATE]: {
    name: 'Create Project Updates',
    description: 'Post project status updates',
    category: 'Updates'
  },
  [Permission.EDIT_UPDATE]: {
    name: 'Edit Project Updates',
    description: 'Modify project status updates',
    category: 'Updates'
  },
  [Permission.DELETE_UPDATE]: {
    name: 'Delete Project Updates',
    description: 'Remove project status updates',
    category: 'Updates'
  },
  [Permission.VIEW_ALL_PROJECT_UPDATES]: {
    name: 'View All Project Updates',
    description: 'Can view ALL project updates on the welcome page',
    category: 'Updates',
    isOverride: true
  },
  [Permission.VIEW_ASSIGNED_PROJECTS_UPDATES]: {
    name: 'View Assigned Projects Updates',
    description: 'Allows users to only view project updates on the welcome page that pertain to projects they are working on',
    category: 'Updates'
  },
  [Permission.VIEW_DEPARTMENT_PROJECTS_UPDATES]: {
    name: 'View Department Projects Updates',
    description: 'Allows users to only view all project updates that pertain to their entire department',
    category: 'Updates'
  },
  [Permission.VIEW_ACCOUNT_PROJECTS_UPDATES]: {
    name: 'View Account Projects Updates',
    description: 'Allows users to only view all project updates that pertain to their account they are assigned on',
    category: 'Updates'
  },
  
  // ========================================
  // PROJECT ISSUES PERMISSIONS
  // ========================================
  [Permission.VIEW_ISSUES]: {
    name: 'View Project Issues',
    description: 'View project issues and blockers',
    category: 'Issues'
  },
  [Permission.CREATE_ISSUE]: {
    name: 'Create Project Issues',
    description: 'Report new project issues',
    category: 'Issues'
  },
  [Permission.EDIT_ISSUE]: {
    name: 'Edit Project Issues',
    description: 'Modify existing project issues',
    category: 'Issues'
  },
  [Permission.DELETE_ISSUE]: {
    name: 'Delete Project Issues',
    description: 'Remove project issues',
    category: 'Issues'
  },
  
  // ========================================
  // TABLE VIEW PERMISSIONS (for project table view in accounts)
  // ========================================
  [Permission.VIEW_TABLE]: {
    name: 'View Table',
    description: 'View project table view in accounts',
    category: 'Table View'
  },
  [Permission.EDIT_TABLE]: {
    name: 'Edit Table',
    description: 'Delete projects, assign users, and modify projects within table view',
    category: 'Table View'
  },
  
  // ========================================
  // NEWSLETTER PERMISSIONS
  // ========================================
  [Permission.VIEW_NEWSLETTERS]: {
    name: 'View Newsletters',
    description: 'View company newsletters on welcome page',
    category: 'Newsletters'
  },
  [Permission.CREATE_NEWSLETTER]: {
    name: 'Create Newsletters',
    description: 'Create new newsletters',
    category: 'Newsletters'
  },
  [Permission.EDIT_NEWSLETTER]: {
    name: 'Edit Newsletters',
    description: 'Modify existing newsletters',
    category: 'Newsletters'
  },
  [Permission.DELETE_NEWSLETTER]: {
    name: 'Delete Newsletters',
    description: 'Remove newsletters',
    category: 'Newsletters'
  },
  
  // ========================================
  // ANALYTICS PERMISSIONS
  // ========================================
  [Permission.VIEW_ANALYTICS]: {
    name: 'View Analytics',
    description: 'View basic analytics for assigned projects',
    category: 'Analytics'
  },
  [Permission.VIEW_DEPARTMENT_ANALYTICS]: {
    name: 'View Department Analytics',
    description: 'View department-wide analytics',
    category: 'Analytics'
  },
  [Permission.VIEW_ALL_ANALYTICS]: {
    name: 'View All Analytics',
    description: 'View organization-wide analytics (override)',
    category: 'Analytics',
    isOverride: true
  },
  
  // ========================================
  // PROFILE PERMISSIONS
  // ========================================
  [Permission.VIEW_OWN_PROFILE]: {
    name: 'View Own Profile',
    description: 'View own user profile',
    category: 'Profile'
  },
  [Permission.EDIT_OWN_PROFILE]: {
    name: 'Edit Own Profile',
    description: 'Edit own user profile',
    category: 'Profile'
  },
  
  // ========================================
  // CAPACITY & TIME TRACKING PERMISSIONS
  // ========================================
  [Permission.EDIT_OWN_AVAILABILITY]: {
    name: 'Edit Own Availability',
    description: 'Set and manage personal weekly work availability',
    category: 'Capacity'
  },
  [Permission.VIEW_OWN_CAPACITY]: {
    name: 'View Own Capacity',
    description: 'View personal capacity metrics and utilization',
    category: 'Capacity'
  },
  [Permission.VIEW_TEAM_CAPACITY]: {
    name: 'View Team Capacity',
    description: 'View capacity metrics for team/department members',
    category: 'Capacity'
  },
  [Permission.VIEW_ALL_CAPACITY]: {
    name: 'View All Capacity',
    description: 'View organization-wide capacity metrics (override)',
    category: 'Capacity',
    isOverride: true
  },
  [Permission.LOG_TIME]: {
    name: 'Log Time',
    description: 'Log time entries on assigned tasks',
    category: 'Time Tracking'
  },
  [Permission.LOG_TIME_ALL_PROJECT_TASKS]: {
    name: 'Log Time to All Project Tasks',
    description: 'Log time to any task in assigned projects, not just personally assigned tasks',
    category: 'Time Tracking'
  },
  [Permission.EDIT_OWN_TIME_ENTRIES]: {
    name: 'Edit Own Time Entries',
    description: 'Edit and delete own time entries',
    category: 'Time Tracking'
  },
  [Permission.VIEW_TEAM_TIME_ENTRIES]: {
    name: 'View Team Time Entries',
    description: 'View time entries logged by team members',
    category: 'Time Tracking'
  },
  [Permission.EDIT_TEAM_TIME_ENTRIES]: {
    name: 'Edit Team Time Entries',
    description: 'Edit and delete time entries logged by team members',
    category: 'Time Tracking'
  },
  [Permission.ALLOCATE_TASK_WEEKS]: {
    name: 'Allocate Task Weeks',
    description: 'Allocate tasks to specific weeks for capacity planning',
    category: 'Capacity'
  },
  [Permission.VIEW_CAPACITY_ANALYTICS]: {
    name: 'View Capacity Analytics',
    description: 'Access capacity analytics dashboard and reports',
    category: 'Capacity'
  },

  // ========================================
  // WORKFLOW MANAGEMENT PERMISSIONS
  // ========================================
  [Permission.MANAGE_WORKFLOWS]: {
    name: 'Manage Workflows',
    description: 'Create, edit, and delete workflow templates',
    category: 'Workflows'
  },
  [Permission.VIEW_WORKFLOWS]: {
    name: 'View Workflows',
    description: 'View workflow templates and active workflow instances',
    category: 'Workflows'
  },
  [Permission.EXECUTE_WORKFLOWS]: {
    name: 'Execute Workflows',
    description: 'Hand off work to next nodes in workflows',
    category: 'Workflows'
  },
  [Permission.SKIP_WORKFLOW_NODES]: {
    name: 'Skip Workflow Nodes',
    description: 'Hand off work out-of-order for innovation tracking',
    category: 'Workflows'
  },

  // ========================================
  // FORM MANAGEMENT PERMISSIONS
  // ========================================
  [Permission.MANAGE_FORMS]: {
    name: 'Manage Forms',
    description: 'Create, edit, and delete dynamic form templates',
    category: 'Forms'
  },
  [Permission.VIEW_FORMS]: {
    name: 'View Forms',
    description: 'View form templates and submitted form responses',
    category: 'Forms'
  },
  [Permission.SUBMIT_FORMS]: {
    name: 'Submit Forms',
    description: 'Fill out and submit forms during workflow handoffs',
    category: 'Forms'
  },

  // ========================================
  // CLIENT PORTAL PERMISSIONS
  // ========================================
  [Permission.CLIENT_VIEW_PROJECTS]: {
    name: 'Client: View Projects',
    description: 'View projects for client\'s account (client-only permission)',
    category: 'Client Portal'
  },
  [Permission.CLIENT_APPROVE_PROJECTS]: {
    name: 'Client: Approve Projects',
    description: 'Approve or reject projects at workflow approval nodes (client-only permission)',
    category: 'Client Portal'
  },
  [Permission.CLIENT_PROVIDE_FEEDBACK]: {
    name: 'Client: Provide Feedback',
    description: 'Submit satisfaction scores and feedback on projects (client-only permission)',
    category: 'Client Portal'
  },
  [Permission.VIEW_CLIENT_FEEDBACK]: {
    name: 'View Client Feedback',
    description: 'View client satisfaction scores and feedback (admin/account manager only)',
    category: 'Client Portal'
  },
  [Permission.SEND_CLIENT_INVITES]: {
    name: 'Send Client Invitations',
    description: 'Invite clients to access their account portal',
    category: 'Client Portal'
  },
};

// Permission categories for UI grouping
// NOTE: Tasks, Kanban, and Gantt categories removed - these permissions are now inherited from project access
export const PermissionCategories = {
  Roles: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Roles'),
  Departments: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Departments'),
  Accounts: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Accounts'),
  Projects: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Projects'),
  Updates: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Updates'),
  Issues: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Issues'),
  'Table View': Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Table View'),
  Newsletters: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Newsletters'),
  Analytics: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Analytics'),
  Profile: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Profile'),
  Capacity: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Capacity'),
  'Time Tracking': Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Time Tracking'),
  Workflows: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Workflows'),
  Forms: Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Forms'),
  'Client Portal': Object.values(Permission).filter(p => PermissionDefinitions[p]?.category === 'Client Portal'),
};

// Get override permissions
export const OverridePermissions = Object.values(Permission).filter(
  p => PermissionDefinitions[p]?.isOverride === true
);

// Context for permission checks (enhanced for hybrid approach)
/**
 * Check if a user has a specific permission
 * @param userProfile - User profile with roles
 * @param permission - Permission to check
 * @param context - Optional context (department, account, etc.)
 * @returns True if user has the permission
 */
export async function checkPermission(
  userProfile: UserWithRoles | null,
  permission: Permission,
  context?: PermissionContext
): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    // Null checks
    if (!userProfile) {
      logger.debug('No user profile provided', { action: 'checkPermission', permission });
      return false;
    }

    if (!userProfile.user_roles || !Array.isArray(userProfile.user_roles)) {
      logger.debug('No user roles found', { action: 'checkPermission', permission, userId: userProfile.id });
      return false;
    }

    // Superadmin always has all permissions
    if (isSuperadmin(userProfile)) {
      permissionCheck(permission, userProfile.id, true, { action: 'checkPermission', reason: 'superadmin' });
      return true;
    }

    // Get all user's roles and their permissions
    const userRoles = userProfile.user_roles;
    const roleIds = userRoles.map(ur => ur?.role_id).filter(Boolean);

    if (roleIds.length === 0) {
      logger.debug('No valid role IDs found', { action: 'checkPermission', permission, userId: userProfile.id });
      return false;
    }

    // Fetch permissions for all user's roles
    const supabase = createClientSupabase();
    if (!supabase) {
      logger.error('Supabase client not available', { action: 'checkPermission', permission, userId: userProfile.id });
      return false;
    }

    databaseQuery('SELECT', 'roles', { action: 'checkPermission', permission, userId: userProfile.id });

    const { data: roles, error } = await supabase
      .from('roles')
      .select('id, permissions')
      .in('id', roleIds);

    if (error) {
      databaseError('SELECT', 'roles', error, { action: 'checkPermission', permission, userId: userProfile.id });
      logger.error('Error fetching role permissions', { action: 'checkPermission', permission, userId: userProfile.id }, error);
      return false;
    }

    if (!roles || roles.length === 0) {
      logger.debug('No roles found for user', { action: 'checkPermission', permission, userId: userProfile.id });
      return false;
    }

    // Check if any role has the required permission
    for (const role of roles) {
      if (!role || !role.permissions) continue;

      const permissions = role.permissions as Record<string, boolean> || {};
      if (permissions[permission]) {
        // Check context-specific permissions if needed
        if (context?.departmentId) {
          // For department-specific permissions, check if user has role in that department
          const userRole = userRoles.find((ur: { role_id: string; roles?: { departments?: { id: string } | null } | null }) => ur?.role_id === role.id);
          if (userRole?.roles?.departments?.id === context.departmentId) {
            const duration = Date.now() - startTime;
            permissionCheck(permission, userProfile.id, true, { 
              action: 'checkPermission', 
              roleId: role.id,
              departmentId: context.departmentId,
              duration
            });
            return true;
          }
        } else {
          const duration = Date.now() - startTime;
          permissionCheck(permission, userProfile.id, true, { 
            action: 'checkPermission', 
            roleId: role.id,
            duration
          });
          return true;
        }
      }
    }

    const duration = Date.now() - startTime;
    permissionCheck(permission, userProfile.id, false, { 
      action: 'checkPermission', 
      duration,
      context: context?.departmentId ? { departmentId: context.departmentId } : undefined
    });

    return false;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Exception in checkPermission', { 
      action: 'checkPermission', 
      permission,
      userId: userProfile?.id,
      duration
    }, error as Error);
    return false;
  }
}

/**
 * Get all permissions for a user (union of all role permissions)
 * @param userProfile - User profile with roles
 * @returns Array of permissions the user has
 */
export async function getUserPermissions(userProfile: UserWithRoles | null): Promise<Permission[]> {
  if (!userProfile?.user_roles) return [];

  // Superadmin has all permissions
  if (isSuperadmin(userProfile)) return Object.values(Permission);

  const userRoles = userProfile.user_roles;
  const roleIds = userRoles.map(ur => ur.role_id);

  const supabase = createClientSupabase();
  if (!supabase) return [];

  const { data: roles, error } = await supabase
    .from('roles')
    .select('id, permissions')
    .in('id', roleIds);

  if (error || !roles) return [];

  const userPermissions = new Set<Permission>();

  for (const role of roles) {
    const permissions = role.permissions as Record<string, boolean> || {};
    for (const [permission, hasPermission] of Object.entries(permissions)) {
      if (hasPermission && Object.values(Permission).includes(permission as Permission)) {
        userPermissions.add(permission as Permission);
      }
    }
  }

  return Array.from(userPermissions);
}

/**
 * Get permissions for a specific role
 * @param roleId - Role ID
 * @returns Array of permissions for the role
 */
export async function getRolePermissions(roleId: string): Promise<Permission[]> {
  const supabase = createClientSupabase();
  if (!supabase) return [];

  const { data: role, error } = await supabase
    .from('roles')
    .select('permissions')
    .eq('id', roleId)
    .single();

  if (error || !role) return [];

  const permissions = role.permissions as Record<string, boolean> || {};
  return Object.entries(permissions)
    .filter(([_, hasPermission]) => hasPermission)
    .map(([permission, _]) => permission as Permission)
    .filter(permission => Object.values(Permission).includes(permission));
}

/**
 * Update permissions for a role
 * @param roleId - Role ID
 * @param permissions - Object mapping permissions to boolean values
 * @returns Success status
 */
export async function updateRolePermissions(
  roleId: string,
  permissions: Record<Permission, boolean>
): Promise<boolean> {
  const supabase = createClientSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from('roles')
    .update({ permissions })
    .eq('id', roleId);

  return !error;
}

/**
 * Check if user is superadmin (helper function)
 * Uses is_superadmin flag on user profile, NOT hardcoded role names
 * @param userProfile - User profile with roles
 * @returns True if user is superadmin
 */
function isSuperadmin(userProfile: UserWithRoles | null): boolean {
  if (!userProfile) return false;

  // Primary check: use the is_superadmin flag on user profile
  if (userProfile.is_superadmin) return true;

  // Fallback: check if user has a system role with superadmin-level permissions
  // This uses is_system_role flag, not hardcoded role names
  if (userProfile.user_roles) {
    return userProfile.user_roles.some(ur =>
      ur.roles.is_system_role &&
      ur.roles.name?.toLowerCase() === 'superadmin'
    );
  }

  return false;
}

/**
 * Get permission definitions grouped by category
 * @returns Object with category names as keys and permission arrays as values
 */
export function getPermissionsByCategory(): Record<string, Permission[]> {
  return PermissionCategories;
}

/**
 * Get all available permissions
 * @returns Array of all permissions
 */
export function getAllPermissions(): Permission[] {
  return Object.values(Permission);
}
