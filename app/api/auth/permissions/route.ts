import { NextResponse } from 'next/server';
import { Permission } from '@/lib/permissions';
import { checkPermissionHybrid, isSuperadmin } from '@/lib/permission-checker';
import { getAuthenticatedUser } from '@/lib/server-guards';
import { logger } from '@/lib/debug-logger';

export async function GET() {
  try {
    // Get authenticated user (doesn't throw if not authenticated)
    const userProfile = await getAuthenticatedUser();
    
    if (!userProfile) {
      return NextResponse.json({ 
        can_manage_roles: false,
        can_view_roles: false,
        is_admin: false
      });
    }

    // Check actual permissions using permission checker (Phase 9: consolidated to MANAGE_USER_ROLES)
    const canManageRoles = await checkPermissionHybrid(userProfile, Permission.MANAGE_USER_ROLES);
    const canViewRoles = canManageRoles; // Viewing is implied by MANAGE permission

    const roleNames = userProfile.user_roles?.map((ur: any) => {
      const roles = ur.roles as Record<string, unknown> | undefined;
      return roles?.name;
    }).filter(Boolean) || [];
    const isAdmin = isSuperadmin(userProfile);

    return NextResponse.json({
      can_manage_roles: canManageRoles,
      can_view_roles: canViewRoles,
      is_admin: isAdmin,
      roles: roleNames
    });
  } catch (error: unknown) {
    logger.error('Error checking permissions', { action: 'getPermissions' }, error as Error);
    return NextResponse.json({ 
      can_manage_roles: false,
      can_view_roles: false,
      is_admin: false,
      error: 'Failed to check permissions'
    }, { status: 500 });
  }
}

