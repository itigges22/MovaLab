
import { createClientSupabase } from './supabase'
import { logger } from './debug-logger'

/**
 * Test database connection and check if superadmin role exists
 */
export async function testDatabaseConnection() {
  try {
    const supabase = createClientSupabase()
    if (!supabase) {
      throw new Error('Supabase not configured')
    }

    logger.info('Testing database connection', {})

    // Test 1: Check if we can connect to departments table
    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .limit(5)

    if (deptError) {
      logger.error('Department query error', {}, deptError as Error)
      return { success: false, error: `Department query failed: ${deptError.message}` }
    }

    logger.debug('Departments found', { data: deptData })

    // Test 2: Check if Superadmin department exists
    const { data: systemDept, error: systemDeptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('name', 'Superadmin')
      .maybeSingle() // Use maybeSingle() to allow 0 or 1 results

    if (systemDeptError) {
      logger.error('Superadmin department query error', {}, systemDeptError as Error)
      return { success: false, error: `Superadmin department query failed: ${systemDeptError.message}` }
    }

    logger.debug('Superadmin department', { data: systemDept })

    // Test 3: Check if Superadmin role exists
    const { data: superadminRole, error: roleError } = await supabase
      .from('roles')
      .select('id, name, department_id')
      .eq('name', 'Superadmin')
      .maybeSingle() // Use maybeSingle() to allow 0 or 1 results

    if (roleError) {
      logger.error('Superadmin role query error', {}, roleError as Error)
      return { success: false, error: `Superadmin role query failed: ${roleError.message}` }
    }

    logger.debug('Superadmin role', { data: superadminRole })

    // Test 4: Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      logger.error('User query error', {}, userError as Error)
      return { success: false, error: `User query failed: ${userError.message}` }
    }

    logger.debug('Current user', { userId: (user as any)?.id })

    return { 
      success: true, 
      data: {
        departments: deptData,
        systemDepartment: systemDept,
        superadminRole,
        user: (user as any)?.id
      }
    }

  } catch (error: unknown) {
    logger.error('Database test error', {}, error as Error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
