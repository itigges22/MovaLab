
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
  MANAGE_USER_ROLES = 'manage_user_roles', // Consolidated: create/edit/delete roles, assign/remove users, approve registrations
  MANAGE_USERS = 'manage_users', // Full user management capabilities - view, edit, and delete users

  // ========================================
  // DEPARTMENT PERMISSIONS
  // ========================================
  MANAGE_DEPARTMENTS = 'manage_departments', // Create, edit, and delete departments
  MANAGE_USERS_IN_DEPARTMENTS = 'manage_users_in_departments', // Assign and remove users from departments
  VIEW_DEPARTMENTS = 'view_departments', // View departments user belongs to
  VIEW_ALL_DEPARTMENTS = 'view_all_departments', // Override: View all departments organization-wide

  // ========================================
  // ACCOUNT PERMISSIONS
  // ========================================
  MANAGE_ACCOUNTS = 'manage_accounts', // Create, edit, and delete client accounts
  MANAGE_USERS_IN_ACCOUNTS = 'manage_users_in_accounts', // Assign and remove users from accounts
  VIEW_ACCOUNTS = 'view_accounts', // View accounts user has access to
  VIEW_ALL_ACCOUNTS = 'view_all_accounts', // Override: View all accounts organization-wide

  // ========================================
  // PROJECT PERMISSIONS
  // ========================================
  MANAGE_PROJECTS = 'manage_projects', // Create, edit, and delete projects in assigned accounts
  VIEW_PROJECTS = 'view_projects', // View projects user is assigned to
  VIEW_ALL_PROJECTS = 'view_all_projects', // Override: View all projects organization-wide
  MANAGE_ALL_PROJECTS = 'manage_all_projects', // Override: Manage any project regardless of assignment

  // ========================================
  // PROJECT UPDATES PERMISSIONS
  // ========================================
  MANAGE_UPDATES = 'manage_updates', // Create, edit, and delete project status updates
  VIEW_UPDATES = 'view_updates', // Context-aware: View updates for assigned projects/accounts/departments
  VIEW_ALL_UPDATES = 'view_all_updates', // Override: View all updates organization-wide

  // ========================================
  // PROJECT ISSUES PERMISSIONS
  // ========================================
  MANAGE_ISSUES = 'manage_issues', // Create, edit, and delete project issues
  VIEW_ISSUES = 'view_issues', // View project issues and blockers

  // ========================================
  // NEWSLETTER PERMISSIONS
  // ========================================
  MANAGE_NEWSLETTERS = 'manage_newsletters', // Create, edit, and delete company newsletters
  VIEW_NEWSLETTERS = 'view_newsletters', // View company newsletters on welcome page

  // ========================================
  // ANALYTICS PERMISSIONS
  // ========================================
  VIEW_ALL_DEPARTMENT_ANALYTICS = 'view_all_department_analytics', // Override: View analytics for entire department
  VIEW_ALL_ACCOUNT_ANALYTICS = 'view_all_account_analytics', // Override: View analytics for entire account
  VIEW_ALL_ANALYTICS = 'view_all_analytics', // Override: View organization-wide analytics

  // ========================================
  // CAPACITY & TIME TRACKING PERMISSIONS
  // ========================================
  EDIT_OWN_AVAILABILITY = 'edit_own_availability', // Set and manage personal weekly work availability
  VIEW_TEAM_CAPACITY = 'view_team_capacity', // View capacity metrics for team/department members
  VIEW_ALL_CAPACITY = 'view_all_capacity', // Override: View organization-wide capacity metrics

  // Time Tracking
  MANAGE_TIME = 'manage_time', // Log and edit own time entries
  VIEW_TIME_ENTRIES = 'view_time_entries', // View time entries (context-aware: own or team)
  EDIT_TIME_ENTRIES = 'edit_time_entries', // Edit time entries (context-aware: own or team)
  VIEW_ALL_TIME_ENTRIES = 'view_all_time_entries', // Override: View all time entries organization-wide

  // ========================================
  // WORKFLOW MANAGEMENT PERMISSIONS
  // ========================================
  MANAGE_WORKFLOWS = 'manage_workflows', // Create, edit, and delete workflow templates
  EXECUTE_WORKFLOWS = 'execute_workflows', // Hand off work in workflows (context-aware: checks node assignment)
  EXECUTE_ANY_WORKFLOW = 'execute_any_workflow', // Override: Execute any workflow without node assignment check
  SKIP_WORKFLOW_NODES = 'skip_workflow_nodes', // Hand off work out-of-order (admin-only for innovation tracking)
  MANAGE_ALL_WORKFLOWS = 'manage_all_workflows', // Override: Manage any workflow organization-wide

  // ========================================
  // CLIENT PORTAL PERMISSIONS
  // ========================================
  MANAGE_CLIENT_INVITES = 'manage_client_invites', // Manage client invitations (admin/account manager permission)
  // Note: Client access and approval permissions are now hardcoded based on is_client flag
}

// Human-readable permission definitions
export const PermissionDefinitions: Record<Permission, { name: string; description: string; category: string; isOverride?: boolean }> = {
  // ========================================
  // ROLE MANAGEMENT PERMISSIONS
  // ========================================
  [Permission.MANAGE_USER_ROLES]: {
    name: 'Manage User Roles',
    description: 'Full role and user-role assignment management (create/edit/delete roles, assign/remove users, approve registrations)',
    category: 'Role Management'
  },
  [Permission.MANAGE_USERS]: {
    name: 'Manage Users',
    description: 'Full user management capabilities - view, edit, and delete users',
    category: 'Role Management'
  },

  // ========================================
  // DEPARTMENT PERMISSIONS
  // ========================================
  [Permission.MANAGE_DEPARTMENTS]: {
    name: 'Manage Departments',
    description: 'Create, edit, and delete departments (consolidated permission)',
    category: 'Department Management'
  },
  [Permission.MANAGE_USERS_IN_DEPARTMENTS]: {
    name: 'Manage Department Users',
    description: 'Assign and remove users from departments (department membership management)',
    category: 'Department Management'
  },
  [Permission.VIEW_DEPARTMENTS]: {
    name: 'View Departments',
    description: 'View departments user belongs to',
    category: 'Department Management'
  },
  [Permission.VIEW_ALL_DEPARTMENTS]: {
    name: 'View All Departments',
    description: 'View all departments across the organization (override)',
    category: 'Department Management',
    isOverride: true
  },

  // ========================================
  // ACCOUNT PERMISSIONS
  // ========================================
  [Permission.MANAGE_ACCOUNTS]: {
    name: 'Manage Accounts',
    description: 'Create, edit, and delete client accounts (consolidated permission)',
    category: 'Account Management'
  },
  [Permission.MANAGE_USERS_IN_ACCOUNTS]: {
    name: 'Manage Account Users',
    description: 'Assign and remove users from accounts (account membership management)',
    category: 'Account Management'
  },
  [Permission.VIEW_ACCOUNTS]: {
    name: 'View Accounts',
    description: 'View accounts user has access to',
    category: 'Account Management'
  },
  [Permission.VIEW_ALL_ACCOUNTS]: {
    name: 'View All Accounts',
    description: 'View all accounts across the organization (override)',
    category: 'Account Management',
    isOverride: true
  },

  // ========================================
  // PROJECT PERMISSIONS
  // ========================================
  [Permission.MANAGE_PROJECTS]: {
    name: 'Manage Projects',
    description: 'Create, edit, and delete projects in assigned accounts (consolidated permission)',
    category: 'Project Management'
  },
  [Permission.VIEW_PROJECTS]: {
    name: 'View Projects',
    description: 'View projects user is assigned to',
    category: 'Project Management'
  },
  [Permission.VIEW_ALL_PROJECTS]: {
    name: 'View All Projects',
    description: 'View all projects outside of assigned ones (override)',
    category: 'Project Management',
    isOverride: true
  },
  [Permission.MANAGE_ALL_PROJECTS]: {
    name: 'Manage All Projects',
    description: 'Create, edit, and delete any project regardless of assignment (override)',
    category: 'Project Management',
    isOverride: true
  },

  // ========================================
  // PROJECT UPDATES PERMISSIONS
  // ========================================
  [Permission.MANAGE_UPDATES]: {
    name: 'Manage Project Updates',
    description: 'Create, edit, and delete project status updates (consolidated permission)',
    category: 'Project Updates'
  },
  [Permission.VIEW_UPDATES]: {
    name: 'View Project Updates',
    description: 'View project updates (context-aware: checks project/account/department assignments)',
    category: 'Project Updates'
  },
  [Permission.VIEW_ALL_UPDATES]: {
    name: 'View All Updates',
    description: 'View all project updates organization-wide (override)',
    category: 'Project Updates',
    isOverride: true
  },

  // ========================================
  // PROJECT ISSUES PERMISSIONS
  // ========================================
  [Permission.MANAGE_ISSUES]: {
    name: 'Manage Project Issues',
    description: 'Create, edit, and delete project issues and blockers (consolidated permission)',
    category: 'Project Issues'
  },
  [Permission.VIEW_ISSUES]: {
    name: 'View Project Issues',
    description: 'View project issues and blockers',
    category: 'Project Issues'
  },

  // ========================================
  // NEWSLETTER PERMISSIONS
  // ========================================
  [Permission.MANAGE_NEWSLETTERS]: {
    name: 'Manage Newsletters',
    description: 'Create, edit, and delete company newsletters (consolidated permission)',
    category: 'Newsletters'
  },
  [Permission.VIEW_NEWSLETTERS]: {
    name: 'View Newsletters',
    description: 'View company newsletters on welcome page',
    category: 'Newsletters'
  },

  // ========================================
  // ANALYTICS PERMISSIONS
  // ========================================
  [Permission.VIEW_ALL_DEPARTMENT_ANALYTICS]: {
    name: 'View All Department Analytics',
    description: 'View analytics for entire department (all projects and users in department)',
    category: 'Analytics',
    isOverride: true
  },
  [Permission.VIEW_ALL_ACCOUNT_ANALYTICS]: {
    name: 'View All Account Analytics',
    description: 'View analytics for entire account (all projects in account)',
    category: 'Analytics',
    isOverride: true
  },
  [Permission.VIEW_ALL_ANALYTICS]: {
    name: 'View All Analytics',
    description: 'View organization-wide analytics (override)',
    category: 'Analytics',
    isOverride: true
  },

  // ========================================
  // CAPACITY & TIME TRACKING PERMISSIONS
  // ========================================
  [Permission.EDIT_OWN_AVAILABILITY]: {
    name: 'Edit Own Availability',
    description: 'Set and manage personal weekly work availability',
    category: 'Capacity & Time'
  },
  [Permission.VIEW_TEAM_CAPACITY]: {
    name: 'View Team Capacity',
    description: 'View capacity metrics for team/department members',
    category: 'Capacity & Time'
  },
  [Permission.VIEW_ALL_CAPACITY]: {
    name: 'View All Capacity',
    description: 'View organization-wide capacity metrics (override)',
    category: 'Capacity & Time',
    isOverride: true
  },

  // Time Tracking - NEW consolidated permissions
  [Permission.MANAGE_TIME]: {
    name: 'Manage Time',
    description: 'Log and edit own time entries (consolidated permission)',
    category: 'Capacity & Time'
  },
  [Permission.VIEW_TIME_ENTRIES]: {
    name: 'View Time Entries',
    description: 'View time entries (context-aware: own or team based on assignment)',
    category: 'Capacity & Time'
  },
  [Permission.EDIT_TIME_ENTRIES]: {
    name: 'Edit Time Entries',
    description: 'Edit time entries (context-aware: own or team based on permissions)',
    category: 'Capacity & Time'
  },
  [Permission.VIEW_ALL_TIME_ENTRIES]: {
    name: 'View All Time Entries',
    description: 'View all time entries organization-wide (override)',
    category: 'Capacity & Time',
    isOverride: true
  },

  // ========================================
  // WORKFLOW MANAGEMENT PERMISSIONS
  // ========================================
  [Permission.MANAGE_WORKFLOWS]: {
    name: 'Manage Workflows',
    description: 'Create, edit, and delete workflow templates',
    category: 'Workflows'
  },
  [Permission.EXECUTE_WORKFLOWS]: {
    name: 'Execute Workflows',
    description: 'Hand off work to next nodes in workflows (context-aware: checks node assignment)',
    category: 'Workflows'
  },
  [Permission.EXECUTE_ANY_WORKFLOW]: {
    name: 'Execute Any Workflow',
    description: 'Handoff workflows without node assignment (admin override to unblock stuck workflows)',
    category: 'Workflows',
    isOverride: true
  },
  [Permission.SKIP_WORKFLOW_NODES]: {
    name: 'Skip Workflow Nodes',
    description: 'Hand off work out-of-order for innovation tracking (admin-only)',
    category: 'Workflows'
  },
  [Permission.MANAGE_ALL_WORKFLOWS]: {
    name: 'Manage All Workflows',
    description: 'Create, edit, and delete any workflow organization-wide (override)',
    category: 'Workflows',
    isOverride: true
  },

  // ========================================
  // CLIENT PORTAL PERMISSIONS
  // ========================================
  [Permission.MANAGE_CLIENT_INVITES]: {
    name: 'Manage Client Invitations',
    description: 'Send client invitations and view client feedback (admin/account manager permission)',
    category: 'Client Portal'
  },
};

// Permission categories for UI grouping
export const PermissionCategories = {
  'Role Management': Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Role Management'),
  'Department Management': Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Department Management'),
  'Account Management': Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Account Management'),
  'Project Management': Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Project Management'),
  'Project Updates': Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Project Updates'),
  'Project Issues': Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Project Issues'),
  Newsletters: Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Newsletters'),
  Analytics: Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Analytics'),
  'Capacity & Time': Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Capacity & Time'),
  Workflows: Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Workflows'),
  'Client Portal': Object.values(Permission).filter((p: Permission) => (PermissionDefinitions as any)[p as string]?.category === 'Client Portal'),
};

// Get override permissions
export const OverridePermissions = Object.values(Permission).filter(
  (p: Permission) => (PermissionDefinitions as any)[p as string]?.isOverride === true
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
      logger.debug('No user roles found', { action: 'checkPermission', permission, userId: (userProfile as any).id });
      return false;
    }

    // Superadmin always has all permissions
    if (isSuperadmin(userProfile)) {
      permissionCheck(permission, (userProfile as any).id, true, { action: 'checkPermission', reason: 'superadmin' });
      return true;
    }

    // Get all user's roles and their permissions
    const userRoles = userProfile.user_roles;
    const roleIds = userRoles.map((ur: any) => ur?.role_id).filter(Boolean);

    if (roleIds.length === 0) {
      logger.debug('No valid role IDs found', { action: 'checkPermission', permission, userId: (userProfile as any).id });
      return false;
    }

    // Fetch permissions for all user's roles
    const supabase = createClientSupabase() as any;
    if (!supabase) {
      logger.error('Supabase client not available', { action: 'checkPermission', permission, userId: (userProfile as any).id });
      return false;
    }

    databaseQuery('SELECT', 'roles', { action: 'checkPermission', permission, userId: (userProfile as any).id });

    const { data: roles, error } = await supabase
      .from('roles')
      .select('id, permissions')
      .in('id', roleIds);

    if (error) {
      databaseError('SELECT', 'roles', error, { action: 'checkPermission', permission, userId: (userProfile as any).id });
      logger.error('Error fetching role permissions', { action: 'checkPermission', permission, userId: (userProfile as any).id }, error);
      return false;
    }

    if (!roles || roles.length === 0) {
      logger.debug('No roles found for user', { action: 'checkPermission', permission, userId: (userProfile as any).id });
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
            permissionCheck(permission, (userProfile as any).id, true, {
              action: 'checkPermission',
              roleId: role.id,
              departmentId: context.departmentId,
              duration
            });
            return true;
          }
        } else {
          const duration = Date.now() - startTime;
          permissionCheck(permission, (userProfile as any).id, true, {
            action: 'checkPermission',
            roleId: role.id,
            duration
          });
          return true;
        }
      }
    }

    const duration = Date.now() - startTime;
    permissionCheck(permission, (userProfile as any).id, false, {
      action: 'checkPermission',
      duration,
      context: context?.departmentId ? { departmentId: context.departmentId } : undefined
    });

    return false;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    logger.error('Exception in checkPermission', {
      action: 'checkPermission',
      permission,
      userId: (userProfile as any)?.id,
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
  const roleIds = userRoles.map((ur: any) => ur.role_id);

  const supabase = createClientSupabase() as any;
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
  const supabase = createClientSupabase() as any;
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
    .filter((permission: any) => Object.values(Permission).includes(permission));
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
  const supabase = createClientSupabase() as any;
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
  if ((userProfile as any).is_superadmin) return true;

  // Fallback: check if user has a system role with superadmin-level permissions
  // This uses is_system_role flag, not hardcoded role names
  if (userProfile.user_roles) {
    return userProfile.user_roles.some((ur: any) =>
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
