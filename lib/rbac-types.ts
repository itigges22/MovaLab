/**
 * Shared RBAC Types
 * 
 * This file contains shared types used across the RBAC system
 * to avoid circular dependencies between rbac.ts and permissions.ts
 */


// Database types
export type UserProfile = any;
export type Role = any;
export type UserRole = any;
export type Department = any;

// Extended user profile with roles
export interface UserWithRoles extends UserProfile {
  user_roles: Array<
    UserRole & {
      roles: Role & {
        departments: Department | null;
      };
    }
  >;
}

// Permission context for context-aware checks
export interface PermissionContext {
  userId?: string;
  departmentId?: string;
  accountId?: string;
  projectId?: string;
  taskId?: string;
  deliverableId?: string;
  workflowInstanceId?: string; // For workflow node assignment checks
}

