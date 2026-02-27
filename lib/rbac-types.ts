/**
 * Shared RBAC Types
 *
 * This file contains shared types used across the RBAC system
 * to avoid circular dependencies between rbac.ts and permissions.ts.
 *
 * Types are re-exported from supabase.ts which has the real Database schema.
 */

import type {
  UserProfile,
  Role,
  UserRole,
  Department,
} from './supabase';

// Re-export database types so consumers don't need to change imports
export type { UserProfile, Role, UserRole, Department };

// Extended user profile with roles (the shape returned by Supabase joins)
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

