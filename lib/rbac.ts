/**
 * RBAC (Role-Based Access Control) Module - REFACTORED
 * 
 * This module provides helper functions for checking user permissions and roles.
 * All permission checks now use the hybrid permission checker instead of hardcoded roles.
 * 
 * Key Changes (2025-11-03):
 * - Removed hardcoded ROLE_HIERARCHY
 * - Removed hardcoded role name checks (Executive, Director, etc.)
 * - All permission checks now use dynamic permission-based system
 * - Superadmin detection uses is_system_role flag
 * - Supports dynamic role creation through admin dashboard
 * 
 * @see lib/permission-checker.ts for the core permission logic
 * @see lib/permissions.ts for the permission definitions
 */

import { UserProfile, Role, Department } from './supabase';
import { Permission } from './permissions';
import { UserWithRoles, PermissionContext } from './rbac-types';
import {
  checkPermissionHybrid,
  isSuperadmin as checkIsSuperadmin,
  getUserPermissions,
  checkAnyPermission,
  checkAllPermissions
} from './permission-checker';
import { logger } from './debug-logger';


// Re-export UserWithRoles for backwards compatibility
export type { UserWithRoles };

// ================================================================================
// SUPERADMIN & UNASSIGNED CHECKS
// ================================================================================

/**
 * Check if user has superadmin role
 * Delegates to permission-checker for consistent implementation
 * @param userProfile - User profile with roles
 * @returns True if user has superadmin role
 */
export function isSuperadmin(userProfile: UserWithRoles | null): boolean {
  return checkIsSuperadmin(userProfile);
}

/**
 * Check if user is unassigned (has only the Unassigned system role)
 * @param userProfile - User profile with roles
 * @returns True if user has only unassigned role
 */
export function isUnassigned(userProfile: UserWithRoles | null): boolean {
  if (!userProfile?.user_roles || userProfile.user_roles.length === 0) {
    return true; // No roles = unassigned
  }

  // Check if user has ONLY the "No Assigned Role" system role
  if (userProfile.user_roles.length === 1) {
    const role = userProfile.user_roles[0].roles;
    if (!role) return true;
    const roleNameLower = role.name?.toLowerCase() || '';
    // Check for both "unassigned" and "no assigned role" variants
    // Handle case where is_system_role might be undefined (for backwards compatibility)
    const isSystemRole = role.is_system_role === true;
    return isSystemRole && (
      roleNameLower === 'unassigned' || 
      roleNameLower === 'no assigned role' ||
      roleNameLower.includes('unassigned')
    );
  }

  return false;
}

// ================================================================================
// ROLE INFORMATION HELPERS
// ================================================================================

/**
 * Get user's role names
 * @param userProfile - User profile with roles
 * @returns Array of role names
 */
export function getUserRoles(userProfile: UserWithRoles | null): string[] {
  if (!userProfile?.user_roles) return [];
  return userProfile.user_roles.map(userRole => userRole.roles.name);
}

/**
 * Get user's departments
 * @param userProfile - User profile with roles
 * @returns Array of department names
 */
export function getUserDepartments(userProfile: UserWithRoles | null): string[] {
  if (!userProfile?.user_roles) return [];
  return userProfile.user_roles
    .map(userRole => userRole.roles?.departments?.name)
    .filter((name): name is string => name !== undefined && name !== null);
}

/**
 * Get user's department IDs
 * @param userProfile - User profile with roles
 * @returns Array of department IDs
 */
export function getUserDepartmentIds(userProfile: UserWithRoles | null): string[] {
  if (!userProfile?.user_roles) return [];
  return [...new Set(userProfile.user_roles.map(userRole => userRole.roles.department_id))];
}

/**
 * Get all permissions for a user
 * @param userProfile - User profile with roles
 * @param supabaseClient - Optional authenticated Supabase client
 * @returns Promise<Array of permissions>
 */
export async function getAllUserPermissions(userProfile: UserWithRoles | null, supabaseClient?: any): Promise<Permission[]> {
  return getUserPermissions(userProfile, supabaseClient);
}

// ================================================================================
// GENERIC PERMISSION CHECKS
// ================================================================================

/**
 * Check if user has a specific permission
 * @param userProfile - User profile with roles
 * @param permission - Permission to check
 * @param context - Optional context (projectId, accountId, departmentId)
 * @param supabaseClient - Optional authenticated Supabase client (REQUIRED for server-side, optional for client-side)
 * @returns Promise<boolean>
 */
export async function hasPermission(
  userProfile: UserWithRoles | null,
  permission: Permission,
  context?: PermissionContext,
  supabaseClient?: any
): Promise<boolean> {
  return checkPermissionHybrid(userProfile, permission, context, supabaseClient);
}

/**
 * Check if user has Record<string, unknown> of the specified permissions
 * @param userProfile - User profile with roles
 * @param permissions - Array of permissions to check
 * @param context - Optional context
 * @param supabaseClient - Optional authenticated Supabase client
 * @returns Promise<boolean>
 */
export async function hasAnyPermission(
  userProfile: UserWithRoles | null,
  permissions: Permission[],
  context?: PermissionContext,
  supabaseClient?: any
): Promise<boolean> {
  return checkAnyPermission(userProfile, permissions, context, supabaseClient);
}

/**
 * Check if user has all of the specified permissions
 * @param userProfile - User profile with roles
 * @param permissions - Array of permissions to check
 * @param context - Optional context
 * @param supabaseClient - Optional authenticated Supabase client
 * @returns Promise<boolean>
 */
export async function hasAllPermissions(
  userProfile: UserWithRoles | null,
  permissions: Permission[],
  context?: PermissionContext,
  supabaseClient?: any
): Promise<boolean> {
  return checkAllPermissions(userProfile, permissions, context, supabaseClient);
}

// ================================================================================
// LEGACY COMPATIBILITY HELPERS (for gradual migration)
// ================================================================================

/**
 * @deprecated Use hasPermission with Permission.MANAGE_USER_ROLES instead
 */
export async function canManageRoles(userProfile: UserWithRoles | null, supabaseClient?: any): Promise<boolean> {
  return hasPermission(userProfile, Permission.MANAGE_USER_ROLES, undefined, supabaseClient);
}

/**
 * @deprecated Use hasPermission with Permission.MANAGE_DEPARTMENTS + context
 */
export async function canManageDepartment(userProfile: UserWithRoles | null, departmentId: string, supabaseClient?: any): Promise<boolean> {
  return hasPermission(userProfile, Permission.MANAGE_DEPARTMENTS, { departmentId }, supabaseClient);
}

/**
 * @deprecated Use hasPermission with Permission.VIEW_DEPARTMENTS + context
 */
export async function canViewDepartment(userProfile: UserWithRoles | null, departmentId: string, supabaseClient?: any): Promise<boolean> {
  return hasPermission(userProfile, Permission.VIEW_DEPARTMENTS, { departmentId }, supabaseClient);
}

/**
 * @deprecated Use hasPermission with Permission.MANAGE_ACCOUNTS instead
 */
export async function hasAccountManagementPrivileges(userProfile: UserWithRoles | null, supabaseClient?: any): Promise<boolean> {
  return hasPermission(userProfile, Permission.MANAGE_ACCOUNTS, undefined, supabaseClient);
}

/**
 * Check if user can manage accounts
 * @deprecated Use hasPermission with Permission.MANAGE_ACCOUNTS
 */
export async function canManageAccounts(userProfile: UserWithRoles | null, supabaseClient?: any): Promise<boolean> {
  return hasAccountManagementPrivileges(userProfile, supabaseClient);
}

/**
 * @deprecated Use hasPermission with Permission.MANAGE_PROJECTS + context
 */
export async function canEditProject(userProfile: UserWithRoles | null, projectId: string, supabaseClient?: any): Promise<boolean> {
  return hasPermission(userProfile, Permission.MANAGE_PROJECTS, { projectId }, supabaseClient);
}

/**
 * @deprecated Use hasPermission with Permission.VIEW_PROJECTS + context
 */
export async function canViewProject(userProfile: UserWithRoles | null, projectId: string, supabaseClient?: any): Promise<boolean> {
  return hasPermission(userProfile, Permission.VIEW_PROJECTS, { projectId }, supabaseClient);
}

/**
 * @deprecated Check specific role name is an anti-pattern. Use permissions instead.
 * If you MUST check a role name, use getUserRoles() and check the array.
 */
export function hasRole(userProfile: UserWithRoles | null, roleName: string): boolean {
  logger.warn('hasRole() is deprecated. Use permission-based checks instead', { roleName });
  const userRoles = getUserRoles(userProfile);
  return userRoles.includes(roleName);
}

/**
 * @deprecated Check specific role names is an anti-pattern. Use permissions instead.
 */
export function hasAnyRole(userProfile: UserWithRoles | null, roleNames: string[]): boolean {
  logger.warn('hasAnyRole() is deprecated. Use permission-based checks instead', { roleNames });
  const userRoles = getUserRoles(userProfile);
  return roleNames.some(roleName => userRoles.includes(roleName));
}

/**
 * @deprecated Check specific role names is an anti-pattern. Use permissions instead.
 */
export function hasAllRoles(userProfile: UserWithRoles | null, roleNames: string[]): boolean {
  logger.warn('hasAllRoles() is deprecated. Use permission-based checks instead', { roleNames });
  const userRoles = getUserRoles(userProfile);
  return roleNames.every(roleName => userRoles.includes(roleName));
}

/**
 * @deprecated Check specific role in department is an anti-pattern. Use permissions instead.
 */
export function hasRoleInDepartment(
  userProfile: UserWithRoles | null, 
  roleName: string, 
  departmentName: string
): boolean {
  logger.warn('hasRoleInDepartment() is deprecated. Use permission-based checks instead', { 
    roleName, 
    departmentName 
  });
  
  if (!userProfile?.user_roles) return false;
  
  return userProfile.user_roles.some(
    userRole => 
      userRole.roles?.name === roleName && 
      userRole.roles?.departments?.name === departmentName
  );
}

// ================================================================================
// ADMIN LEVEL CHECKS (simplified)
// ================================================================================

/**
 * Check if user has admin-level access (can access admin dashboard)
 * @param userProfile - User profile with roles
 * @param supabaseClient - Optional authenticated Supabase client
 * @returns Promise<boolean>
 */
export async function isAdminLevel(userProfile: UserWithRoles | null, supabaseClient?: any): Promise<boolean> {
  if (isSuperadmin(userProfile)) return true;

  // Admin level = can manage users, roles, departments, or accounts
  return hasAnyPermission(userProfile, [
    Permission.MANAGE_USERS,
    Permission.MANAGE_USER_ROLES,
    Permission.MANAGE_DEPARTMENTS,
    Permission.MANAGE_ACCOUNTS,
  ], undefined, supabaseClient);
}

/**
 * Check if user can access admin dashboard
 * @param userProfile - User profile with roles
 * @param supabaseClient - Optional authenticated Supabase client
 * @returns Promise<boolean>
 */
export async function canAccessAdminDashboard(userProfile: UserWithRoles | null, supabaseClient?: any): Promise<boolean> {
  return isAdminLevel(userProfile, supabaseClient);
}

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

/**
 * Check if user has Record<string, unknown> role at all (not unassigned)
 * @param userProfile - User profile with roles
 * @returns boolean
 */
export function hasAnyRoleAssigned(userProfile: UserWithRoles | null): boolean {
  return !isUnassigned(userProfile);
}

/**
 * Get user's primary role (first non-system role, or first role if all are system)
 * @param userProfile - User profile with roles
 * @returns Role name or null
 */
export function getPrimaryRole(userProfile: UserWithRoles | null): string | null {
  if (!userProfile?.user_roles || userProfile.user_roles.length === 0) return null;
  
  // Try to find first non-system role
  const nonSystemRole = userProfile.user_roles.find((ur: any) => !ur.roles.is_system_role);
  if (nonSystemRole) return nonSystemRole.roles.name;
  
  // Fall back to first role
  return userProfile.user_roles[0].roles.name;
}

/**
 * Get user's primary department
 * @param userProfile - User profile with roles
 * @returns Department name or null
 */
export function getPrimaryDepartment(userProfile: UserWithRoles | null): string | null {
  if (!userProfile?.user_roles || userProfile.user_roles.length === 0) return null;
  
  // Try to find first non-system role's department
  const nonSystemRole = userProfile.user_roles.find((ur: any) => !ur.roles?.is_system_role);
  if (nonSystemRole?.roles?.departments?.name) {
    return nonSystemRole.roles.departments.name;
  }
  
  // Fall back to first role's department
  const firstRole = userProfile.user_roles[0];
  return firstRole?.roles?.departments?.name || null;
}

// ================================================================================
// EXPORTS
// ================================================================================

// Re-export commonly used types
export type { UserProfile, Role, Department };
export { Permission } from './permissions';
export type { PermissionContext } from './permissions';
