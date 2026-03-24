import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/debug-logger';
import { roleManagementService } from '@/lib/role-management-service';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { Permission } from '@/lib/permissions';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { checkDemoModeForDestructiveAction } from '@/lib/api-demo-guard';
import { isValidUUID } from '@/lib/validation-helpers';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const startTime = Date.now();
  const { roleId } = await params;

  if (!isValidUUID(roleId)) {
    return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
  }

  try {
    // Block in demo mode
    const blocked = checkDemoModeForDestructiveAction('delete_role');
    if (blocked) return blocked;

    // Check authentication and permission
    await requireAuthAndPermission(Permission.MANAGE_USER_ROLES, {}, request);
    logger.info('API DELETE /api/roles/[roleId]', { 
      action: 'api_call',
      roleId 
    });

    if (!roleId) {
      return NextResponse.json(
        { message: 'Role ID is required' },
        { status: 400 }
      );
    }

    // Use authenticated client that respects RLS
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Check if role exists and get details
    const { data: existingRole, error: roleError } = await supabase
      .from('roles')
      .select('id, name, is_system_role')
      .eq('id', roleId)
      .single();

    if (roleError || !existingRole) {
      logger.error('Role not found', { 
        action: 'deleteRole',
        roleId,
        error: roleError?.message 
      });
      return NextResponse.json(
        { message: 'Role not found' },
        { status: 404 }
      );
    }

    // Check if role is system role (cannot be deleted)
    if (existingRole.is_system_role) {
      logger.warn('Attempted to delete system role', { 
        action: 'deleteRole',
        roleId,
        roleName: existingRole.name 
      });
      return NextResponse.json(
        { message: 'Cannot delete system roles' },
        { status: 400 }
      );
    }

    // Check if role has users assigned and get fallback role
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('id, user_id')
      .eq('role_id', roleId);

    if (userRolesError) {
      logger.error('Error checking user roles', { 
        action: 'deleteRole',
        roleId,
        error: userRolesError.message 
      });
      return NextResponse.json(
        { message: 'Error checking role assignments' },
        { status: 500 }
      );
    }

    // Check for workflow nodes that reference this role
    const { data: workflowNodes, error: workflowNodesError } = await supabase
      .from('workflow_nodes')
      .select('id, label, workflow_template_id')
      .eq('entity_id', roleId);

    if (workflowNodesError) {
      logger.error('Error checking workflow nodes', {
        action: 'deleteRole',
        roleId,
        error: workflowNodesError.message
      });
      // Continue anyway - don't block deletion
    }

    // Clear entity_id on workflow nodes that reference this role
    if (workflowNodes && workflowNodes.length > 0) {
      logger.info('Clearing entity_id on workflow nodes that reference this role', {
        action: 'deleteRole',
        roleId,
        roleName: existingRole.name,
        affectedNodes: workflowNodes.length,
        nodeLabels: workflowNodes.map((n: any) => n.label)
      });

      const { error: clearEntityError } = await supabase
        .from('workflow_nodes')
        .update({ entity_id: null })
        .eq('entity_id', roleId);

      if (clearEntityError) {
        logger.error('Error clearing entity_id on workflow nodes', {
          action: 'deleteRole',
          roleId,
          error: clearEntityError.message
        });
        // Continue anyway - the nodes will have orphaned references but won't break
      } else {
        logger.info('Successfully cleared entity_id on workflow nodes', {
          action: 'deleteRole',
          roleId,
          clearedCount: workflowNodes.length
        });
      }
    }

    // If role has users, reassign them to fallback role
    if (userRoles && userRoles.length > 0) {
      logger.info('Role has assigned users, reassigning to fallback role', { 
        action: 'deleteRole',
        roleId,
        roleName: existingRole.name,
        userCount: userRoles.length 
      });

      // Get the fallback role (should always exist)
      const { data: fallbackRole, error: fallbackError } = await supabase
        .from('roles')
        .select('id, name')
        .eq('name', 'No Assigned Role')
        .single();

      if (fallbackError || !fallbackRole) {
        logger.error('Fallback role not found', { 
          action: 'deleteRole',
          error: fallbackError?.message 
        });
        return NextResponse.json(
          { message: 'Fallback role not found. Please contact administrator.' },
          { status: 500 }
        );
      }

      // For each user, check if they have other roles before reassigning to fallback
      for (const userRole of userRoles) {
        const { data: otherRoles, error: otherRolesError } = await supabase
          .from('user_roles')
          .select('role_id, roles!user_roles_role_id_fkey(name)')
          .eq('user_id', userRole.user_id)
          .neq('role_id', roleId); // Exclude the role being deleted

        if (otherRolesError) {
          logger.error('Error checking other roles for user', { 
            action: 'deleteRole',
            userId: userRole.user_id,
            error: otherRolesError.message 
          });
          continue;
        }

        // Only reassign to fallback if user has no other roles
        if (!otherRoles || otherRoles.length === 0) {
          const { error: reassignError } = await supabase
            .from('user_roles')
            .update({ role_id: fallbackRole.id })
            .eq('user_id', userRole.user_id)
            .eq('role_id', roleId);

          if (reassignError) {
            logger.error('Error reassigning user to fallback role', { 
              action: 'deleteRole',
              userId: userRole.user_id,
              error: reassignError.message 
            });
          } else {
            logger.info('User reassigned to fallback role (no other roles)', { 
              action: 'deleteRole',
              userId: userRole.user_id,
              fallbackRoleId: fallbackRole.id
            });
          }
        } else {
          // Just remove from the deleted role, keep other roles
          const { error: deleteError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userRole.user_id)
            .eq('role_id', roleId);

          if (deleteError) {
            logger.error('Error removing user from deleted role', { 
              action: 'deleteRole',
              userId: userRole.user_id,
              error: deleteError.message 
            });
          } else {
            logger.info('User removed from deleted role, keeping other roles', {
              action: 'deleteRole',
              userId: userRole.user_id,
              otherRoles: otherRoles.map((or: any) => {
                const roles = or.roles as Record<string, unknown>;
                return roles.name as string;
              })
            });
          }
        }
      }

      logger.info('User reassignment completed', { 
        action: 'deleteRole',
        roleId,
        userCount: userRoles.length 
      });
    }

    // Delete the role
    logger.info('Attempting to delete role from database', { 
      action: 'deleteRole',
      roleId,
      roleName: existingRole.name 
    });
    
    const { data: deletedData, error: deleteError } = await supabase
      .from('roles')
      .delete()
      .eq('id', roleId)
      .select();

    if (deleteError) {
      logger.error('Error deleting role', { 
        action: 'deleteRole',
        roleId,
        error: deleteError.message,
        errorDetails: deleteError 
      });
      return NextResponse.json(
        { error: 'Failed to delete role' },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    logger.info('Role deleted successfully', { 
      action: 'deleteRole',
      roleId,
      roleName: existingRole.name,
      deletedData,
      deletedCount: deletedData?.length || 0,
      duration 
    });

    return NextResponse.json(
      {
        message: 'Role deleted successfully',
        deletedRole: existingRole.name,
        deletedCount: deletedData?.length || 0,
        workflowNodesCleared: workflowNodes?.length || 0,
        affectedWorkflowNodes: workflowNodes?.map((n: any) => n.label) || []
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    return handleGuardError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roleId: string }> }
) {
  const startTime = Date.now();
  const { roleId } = await params;

  if (!isValidUUID(roleId)) {
    return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
  }

  try {
    // Check authentication and permission
    await requireAuthAndPermission(Permission.MANAGE_USER_ROLES, {}, request);
    logger.info('API PATCH /api/roles/[roleId]', { 
      action: 'api_call',
      roleId 
    });

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role ID is required' },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Validate role name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return NextResponse.json({ error: 'Role name is required and cannot be empty' }, { status: 400 });
      }
      if (body.name.trim().length > 100) {
        return NextResponse.json({ error: 'Role name must be 100 characters or less' }, { status: 400 });
      }
    }

    // Validate description if provided
    if (body.description !== undefined && body.description !== null) {
      if (typeof body.description !== 'string') {
        return NextResponse.json({ error: 'Description must be a string' }, { status: 400 });
      }
      if (body.description.length > 500) {
        return NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 });
      }
    }

    logger.info('Role update request body', { action: 'updateRole', roleId, body });

    // Use roleManagementService to update the role
    const updatedRole = await roleManagementService.updateRole(roleId, body);

    if (!updatedRole) {
      logger.error('Failed to update role', { action: 'updateRole', roleId });
      return NextResponse.json(
        { error: 'Failed to update role' },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;
    logger.info('Role updated successfully', { 
      action: 'updateRole',
      roleId,
      roleName: updatedRole.name,
      duration 
    });

    return NextResponse.json({ success: true, role: updatedRole });

  } catch (error: unknown) {
    return handleGuardError(error);
  }
}
