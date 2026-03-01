import { NextRequest, NextResponse } from 'next/server';
import { Permission } from '@/lib/permissions';
import { validateRole } from '@/lib/validation';
import { logger, apiCall, apiResponse, databaseQuery, databaseError } from '@/lib/debug-logger';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';
import { createApiSupabaseClient } from '@/lib/supabase-server';

// Type definitions
// Type definitions for roles API
interface RoleData {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  hierarchy_level: number;
  display_order: number;
  reporting_role_id: string | null;
  is_system_role: boolean;
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
  department: { id: string; name: string } | null;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface UserRoleData {
  user_id: string;
  user_profiles: UserProfile | null;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication and permission - use standard guard pattern
    // Must pass request to parse cookies manually (cookies() doesn't work in Route Handlers)
    await requireAuthAndPermission(Permission.MANAGE_USER_ROLES, {}, request);
    
    // Use authenticated client that respects RLS
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      logger.error('Failed to create Supabase client', { action: 'getRoles' });
      return NextResponse.json({ error: 'Failed to create database connection' }, { status: 500 });
    }

    // Fetch all roles with related data using explicit foreign key constraints
    // Start with simpler query to debug - add reporting_role after confirming base query works
    const { data: roles, error } = await supabase
      .from('roles')
      .select(`
        id,
        name,
        description,
        department_id,
        hierarchy_level,
        display_order,
        reporting_role_id,
        is_system_role,
        permissions,
        created_at,
        updated_at,
        department:departments!roles_department_id_fkey (
          id,
          name
        )
      `)
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('Error fetching roles', {
        action: 'getRoles',
        code: error.code,
      }, error as unknown as Error);

      return NextResponse.json({
        error: 'Failed to fetch roles'
      }, { status: 500 });
    }

    // Process and return roles data
    return await processRolesData(supabase, roles as unknown as RoleData[] || []);
  } catch (error: unknown) {
return handleGuardError(error);
  }
}

// Helper function to process roles data (shared between main query and fallback)
async function processRolesData(supabase: any, roles: RoleData[]) {
  // If no roles returned, could be RLS blocking or empty database
  if (!roles || roles.length === 0) {
    logger.warn('No roles found - may be RLS policy blocking access or empty database', { action: 'getRoles' });
    return NextResponse.json({
      roles: [],
      containers: [],
      totalRoles: 0,
      totalLevels: 0
    });
  }

  // Create a map of role IDs to roles for quick lookup of reporting roles
  const rolesMap = new Map(roles.map((r: RoleData) => [r.id, r]));

  // Get user counts for each role and enrich with reporting_role data
  const rolesWithData = await Promise.all(
    roles.map(async (role: RoleData) => {
      const { data: userRoles, error: userError } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          user_profiles!user_roles_user_id_fkey (
            id,
            name,
            email,
            image
          )
        `)
        .eq('role_id', role.id);

      const users = userError ? [] : (userRoles as unknown as UserRoleData[] | null)?.map((ur:any) => ur.user_profiles).filter(Boolean) || [];

      // Fetch reporting_role separately if reporting_role_id exists
      let reporting_role = null;
      if (role.reporting_role_id) {
        // Try to get from the roles we already fetched first
        const reportingRoleFromMap = rolesMap.get(role.reporting_role_id);
        if (reportingRoleFromMap) {
          reporting_role = {
            id: reportingRoleFromMap.id,
            name: reportingRoleFromMap.name
          };
        } else {
          // If not in map, fetch it separately
          const { data: reportingRoleData } = await supabase
            .from('roles')
            .select('id, name')
            .eq('id', role.reporting_role_id)
            .single();
          if (reportingRoleData) {
            reporting_role = {
              id: reportingRoleData.id,
              name: reportingRoleData.name
            };
          }
        }
      }

      return {
        ...role,
        department_name: role.department?.name || null,
        department: role.department ? { id: role.department.id, name: role.department.name } : { id: '', name: 'No Department' },
        reporting_role,
        user_count: users.length,
        users: users,
        display_order: role.display_order || 0,
      };
    })
  );

  // Group roles by hierarchy level for container approach
  const levelGroups = new Map<number, typeof rolesWithData>();
  rolesWithData.forEach((role: any) => {
    const level = role.hierarchy_level || 0;
    if (!levelGroups.has(level)) {
      levelGroups.set(level, []);
    }
    levelGroups.get(level)?.push(role);
  });

  // Create container metadata for each hierarchy level
  const containers = Array.from(levelGroups.entries()).map(([level, roles]) => ({
    level,
    roles,
    roleCount: roles.length,
    totalUsers: roles.reduce((sum, role) => sum + (role.user_count || 0), 0),
    departments: [...new Set(roles.map((role: any) => role.department_name).filter(Boolean))]
  }));

  // Sort containers by hierarchy level (highest to lowest)
  containers.sort((a, b) => b.level - a.level);

  return NextResponse.json({
    roles: rolesWithData,
    containers,
    totalRoles: rolesWithData.length,
    totalLevels: containers.length
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Require MANAGE_USER_ROLES permission
    await requireAuthAndPermission(Permission.MANAGE_USER_ROLES, {}, request);
    
    // Use authenticated user's Supabase client - RLS policies will control access
    // Users with CREATE_ROLE permission should be able to create roles based on RLS policies
    const supabase = createApiSupabaseClient(request);
    
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'createRole' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { name, description, department_id, permissions, reporting_role_id } = body;

    apiCall('POST', '/api/roles', { action: 'createRole', name, department_id });

    // Validate input data
    const validation = validateRole({
      name,
      description,
      department_id,
      permissions,
      reporting_role_id
    });

    if (!validation.isValid) {
      logger.error('Role validation failed', { 
        action: 'createRole',
        errors: validation.errors,
        warnings: validation.warnings
      });
      return NextResponse.json({ 
        error: 'Validation failed',
        details: validation.errors 
      }, { status: 400 });
    }

    logger.info('Creating role', { 
      action: 'createRole',
      name,
      department_id,
      hasReportingRole: !!reporting_role_id
    });

    databaseQuery('INSERT', 'roles', { action: 'createRole', name });

    // Check if this is a system role
    const isSystemRole = name === 'No Assigned Role' || name === 'Superadmin';
    
    // Get current maximum hierarchy level to ensure Superadmin stays at top
    const { data: maxLevelData, error: _maxLevelError } = await supabase
      .from('roles')
      .select('hierarchy_level')
      .order('hierarchy_level', { ascending: false })
      .limit(1);
    
    const currentMaxLevel = maxLevelData && maxLevelData.length > 0 ? maxLevelData[0].hierarchy_level : 10;
    
    // Calculate hierarchy level based on reporting role
    let hierarchy_level = 1; // Default for top-level roles
    let display_order = 1; // Default display order
    let finalDepartmentId = department_id; // Default to provided department
    
    if (isSystemRole) {
      // System roles don't belong to any department
      finalDepartmentId = null;
      
      if (name === 'No Assigned Role') {
        hierarchy_level = 0; // Special case for fallback role
      } else if (name === 'Superadmin') {
        // Superadmin is always at the highest level + 1 to ensure it stays on top
        hierarchy_level = currentMaxLevel + 1;
      }
    } else if (reporting_role_id) {
      // Get the reporting role's hierarchy level
      const { data: reportingRole, error: reportingError } = await supabase
        .from('roles')
        .select('hierarchy_level')
        .eq('id', reporting_role_id)
        .single();
      
      if (reportingError) {
        logger.error('Error fetching reporting role', { 
          action: 'createRole',
          reporting_role_id,
          error: reportingError.message 
        });
        return NextResponse.json({ 
          error: 'Invalid reporting role' 
        }, { status: 400 });
      }
      
      // Child role should be one level below parent (lower number = deeper in hierarchy)
      hierarchy_level = (reportingRole.hierarchy_level || 1) - 1;
      
      // Get the next display order for this hierarchy level
      const { data: sameLevelRoles, error: orderError } = await supabase
        .from('roles')
        .select('display_order')
        .eq('hierarchy_level', hierarchy_level)
        .order('display_order', { ascending: false })
        .limit(1);
      
      if (!orderError && sameLevelRoles && sameLevelRoles.length > 0) {
        display_order = (sameLevelRoles[0].display_order || 0) + 1;
      }
    } else {
      // Top-level role - set to Level 1
      hierarchy_level = 1;
    }
    
    logger.info('Calculated hierarchy level', { 
      action: 'createRole',
      name,
      hierarchy_level,
      display_order,
      reporting_role_id
    });

    const { data: role, error } = await supabase
      .from('roles')
      .insert({
        name,
        description: description || null,
        department_id: finalDepartmentId,
        permissions: permissions || {},
        reporting_role_id: reporting_role_id || null,
        hierarchy_level,
        display_order,
        is_system_role: isSystemRole,
      })
      .select()
      .single();

    if (error) {
      databaseError('INSERT', 'roles', error, { action: 'createRole', name });
      logger.error('Error creating role', { 
        action: 'createRole',
        name,
        error: error.message,
        code: error.code
      }, error);
      return NextResponse.json({ 
        error: 'Failed to create role',
        details: error.message 
      }, { status: 400 });
    }

    // Check if database trigger overrode our hierarchy level
    if (role.hierarchy_level !== hierarchy_level) {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('DATABASE TRIGGER OVERRIDE: Expected level mismatch', { data: { expected: hierarchy_level, got: role.hierarchy_level } });
      }
      
      // Calculate the correct level based on reporting relationship
      let correctLevel = hierarchy_level;
      if (reporting_role_id) {
        const { data: parentRole } = await supabase
          .from('roles')
          .select('hierarchy_level')
          .eq('id', reporting_role_id)
          .single();
        
        if (parentRole) {
          correctLevel = parentRole.hierarchy_level - 1;
        }
      } else {
        // For top-level roles, determine correct level based on name
        if (name === 'Superadmin') {
          correctLevel = 12;
        } else if (name === 'No Assigned Role') {
          correctLevel = 0;
        } else {
          correctLevel = 1;
        }
      }
      
      if (correctLevel !== role.hierarchy_level) {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Correcting created role hierarchy level', { data: { from: role.hierarchy_level, to: correctLevel } });
        }
        
        // Update with the correct level
        const { error: correctionError } = await supabase
          .from('roles')
          .update({ 
            hierarchy_level: correctLevel,
            updated_at: new Date().toISOString()
          })
          .eq('id', role.id);
        
        if (correctionError) {
          logger.error('Error correcting created role hierarchy level', {}, correctionError as unknown as Error);
        } else {
          logger.debug('Created role hierarchy level corrected successfully');
          // Update the role object
          role.hierarchy_level = correctLevel;
        }
      }
    }

    const duration = Date.now() - startTime;
    apiResponse('POST', '/api/roles', 200, { 
      action: 'createRole',
      duration,
      roleId: role.id
    });

    logger.info('Role created successfully', { 
      action: 'createRole',
      roleId: role.id,
      name: role.name,
      duration
    });

    return NextResponse.json({ role });
  } catch (error: unknown) {
return handleGuardError(error);
  }
}
