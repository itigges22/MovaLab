import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Permission } from '@/lib/permissions';
import { validateRole } from '@/lib/validation';
import { logger, apiCall, apiResponse, databaseQuery, databaseError } from '@/lib/debug-logger';
import { requireAuthAndPermission, handleGuardError } from '@/lib/server-guards';

export async function GET(request: NextRequest) {
  try {
    // Check authentication and permission - use standard guard pattern
    // Must pass request to parse cookies manually (cookies() doesn't work in Route Handlers)
    await requireAuthAndPermission(Permission.VIEW_ROLES, {}, request);
    
    // Use service role to bypass RLS for fetching all roles
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseKey = serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase not configured', { 
        action: 'getRoles',
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Warn if service role key is not being used (will be subject to RLS)
    if (!serviceRoleKey) {
      logger.warn('Using ANON key instead of SERVICE_ROLE_KEY - may be subject to RLS policies', { 
        action: 'getRoles'
      });
    }

    const serviceSupabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all roles with related data using explicit foreign key constraints
    const { data: roles, error } = await serviceSupabase
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
        departments!roles_department_id_fkey (
          id,
          name
        ),
        reporting_role:roles!roles_reporting_role_id_fkey (
          id,
          name
        )
      `)
      .order('display_order', { ascending: true });

    if (error) {
      logger.error('Error fetching roles', { 
        action: 'getRoles',
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      }, error);
      return NextResponse.json({ 
        error: 'Failed to fetch roles',
        details: error.message,
        code: error.code
      }, { status: 500 });
    }

    // Log the query results for debugging
    logger.info('Roles query result', {
      action: 'getRoles',
      rolesCount: roles?.length || 0,
      usingServiceKey: !!serviceRoleKey
    });

    // If no roles returned and not using service key, try a simple query to check if RLS is blocking
    if ((!roles || roles.length === 0) && !serviceRoleKey) {
      logger.warn('No roles returned - checking if RLS is blocking queries', { action: 'getRoles' });
      const { data: simpleRoles, error: simpleError } = await serviceSupabase
        .from('roles')
        .select('id, name')
        .limit(1);
      
      if (simpleError) {
        logger.error('Simple roles query also failed', { 
          action: 'getRoles',
          error: simpleError.message,
          code: simpleError.code
        });
      } else {
        logger.warn('Simple query returned roles but full query did not - likely RLS or query syntax issue', {
          action: 'getRoles',
          simpleQueryCount: simpleRoles?.length || 0
        });
      }
    }

    // If still no roles, return early with a helpful error
    if (!roles || roles.length === 0) {
      logger.warn('No roles found in database', { action: 'getRoles' });
      return NextResponse.json({
        roles: [],
        containers: [],
        totalRoles: 0,
        totalLevels: 0,
        warning: !serviceRoleKey ? 'Using ANON key - ensure SUPABASE_SERVICE_ROLE_KEY is set in production' : undefined
      });
    }

    // Get user counts for each role
    const rolesWithData = await Promise.all(
      (roles || []).map(async (role: any) => {
        const { data: userRoles, error: userError } = await serviceSupabase
          .from('user_roles')
          .select(`
            user_id,
            user_profiles:user_id (
              id,
              name,
              email,
              image
            )
          `)
          .eq('role_id', role.id);

        const users = userError ? [] : userRoles?.map((ur: any) => ur.user_profiles).filter(Boolean) || [];

        return {
          ...role,
          department_name: role.departments?.name || null,
          department: role.departments ? { id: role.departments.id, name: role.departments.name } : { id: '', name: 'No Department' },
          user_count: users.length,
          users: users,
          display_order: role.display_order || 0,
        };
      })
    );

    // Group roles by hierarchy level for container approach
    const levelGroups = new Map<number, typeof rolesWithData>();
    rolesWithData.forEach(role => {
      const level = role.hierarchy_level || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(role);
    });

    // Create container metadata for each hierarchy level
    const containers = Array.from(levelGroups.entries()).map(([level, roles]) => ({
      level,
      roles,
      roleCount: roles.length,
      totalUsers: roles.reduce((sum, role) => sum + (role.user_count || 0), 0),
      departments: [...new Set(roles.map(role => role.department_name).filter(Boolean))]
    }));

    // Sort containers by hierarchy level (highest to lowest)
    containers.sort((a, b) => b.level - a.level);

    return NextResponse.json({
      roles: rolesWithData,
      containers,
      totalRoles: rolesWithData.length,
      totalLevels: containers.length
    });
  } catch (error) {
    return handleGuardError(error);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Require CREATE_ROLE permission
    await requireAuthAndPermission(Permission.CREATE_ROLE, {}, request);
    
    // Use service role key for direct database access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      logger.error('Supabase not configured', { action: 'createRole' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { data: maxLevelData, error: maxLevelError } = await supabase
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
      console.log(`⚠️  DATABASE TRIGGER OVERRIDE: Expected Level ${hierarchy_level}, got Level ${role.hierarchy_level}`);
      
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
        console.log(`🔧 Correcting created role hierarchy level: ${role.hierarchy_level} → ${correctLevel}`);
        
        // Update with the correct level
        const { error: correctionError } = await supabase
          .from('roles')
          .update({ 
            hierarchy_level: correctLevel,
            updated_at: new Date().toISOString()
          })
          .eq('id', role.id);
        
        if (correctionError) {
          console.error('❌ Error correcting created role hierarchy level:', correctionError);
        } else {
          console.log('✅ Created role hierarchy level corrected successfully!');
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
  } catch (error) {
    return handleGuardError(error);
  }
}
