#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Validate Permission System Integrity
 * Checks for permission system issues and inconsistencies
 */

import { createClient } from '@supabase/supabase-js';
import { Permission, PermissionDefinitions } from '../lib/permissions';

async function main() {
  console.log('\n🔍 Permission System Validation\n');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  let issues = 0;
  let warnings = 0;

  console.log('📊 Checking Permission Definitions...\n');

  // Get all permissions from enum
  const allPermissions = Object.values(Permission);
  console.log(`✅ Found ${allPermissions.length} permissions in Permission enum`);

  // Check all permissions have definitions
  allPermissions.forEach((perm) => {
    if (!PermissionDefinitions[perm]) {
      console.error(`❌ Missing definition for permission: ${perm}`);
      issues++;
    }
  });

  if (issues === 0) {
    console.log(`✅ All ${allPermissions.length} permissions have definitions`);
  }

  // Fetch all roles from database
  console.log('\n📊 Checking Database Roles...\n');

  const { data: roles, error } = await supabase
    .from('roles')
    .select('*')
    .order('name');

  if (error) {
    console.error('❌ Error fetching roles:', error.message);
    process.exit(1);
  }

  if (!roles || roles.length === 0) {
    console.warn('⚠️  Warning: No roles found in database');
    warnings++;
  } else {
    console.log(`✅ Found ${roles.length} roles in database`);
  }

  // Check for deprecated permissions in roles
  console.log('\n📊 Checking for Deprecated Permissions...\n');

  const deprecatedPermissions = [
    'CREATE_PROJECT',
    'EDIT_PROJECT',
    'DELETE_PROJECT',
    'CREATE_ACCOUNT',
    'EDIT_ACCOUNT',
    'DELETE_ACCOUNT',
    'CREATE_DEPARTMENT',
    'EDIT_DEPARTMENT',
    'DELETE_DEPARTMENT',
    'LOG_TIME',
    'EDIT_OWN_TIME_ENTRIES',
    'EDIT_TEAM_TIME_ENTRIES',
    'VIEW_TEAM_TIME_ENTRIES',
    'VIEW_WORKFLOWS',
    'VIEW_FORMS',
    'VIEW_CLIENT_FEEDBACK',
    'VIEW_ALL_PROJECT_UPDATES',
    'VIEW_ASSIGNED_PROJECTS_UPDATES',
    'VIEW_DEPARTMENT_PROJECTS_UPDATES',
    'VIEW_ACCOUNT_PROJECTS_UPDATES'
  ];

  roles?.forEach((role) => {
    const permissions = role.permissions || {};
    const deprecatedInRole: string[] = [];

    deprecatedPermissions.forEach((deprecated) => {
      if (permissions[deprecated] === true) {
        deprecatedInRole.push(deprecated);
      }
    });

    if (deprecatedInRole.length > 0) {
      console.error(`❌ Role "${role.name}" has deprecated permissions:`);
      deprecatedInRole.forEach((p) => console.error(`   - ${p}`));
      issues++;
    }
  });

  if (issues === 0) {
    console.log('✅ No deprecated permissions found');
  }

  // Check for unknown permissions (not in enum)
  console.log('\n📊 Checking for Unknown Permissions...\n');

  roles?.forEach((role) => {
    const permissions = role.permissions || {};
    const unknownPermissions: string[] = [];

    Object.keys(permissions).forEach((permKey) => {
      if (permissions[permKey] === true && !allPermissions.includes(permKey as Permission)) {
        unknownPermissions.push(permKey);
      }
    });

    if (unknownPermissions.length > 0) {
      console.warn(`⚠️  Role "${role.name}" has unknown permissions:`);
      unknownPermissions.forEach((p) => console.warn(`   - ${p}`));
      warnings++;
    }
  });

  if (warnings === 0) {
    console.log('✅ No unknown permissions found');
  }

  // Check system roles
  console.log('\n📊 Checking System Roles...\n');

  const systemRoles = roles?.filter((r) => r.is_system_role);

  if (!systemRoles || systemRoles.length === 0) {
    console.error('❌ No system roles found');
    issues++;
  } else {
    console.log(`✅ Found ${systemRoles.length} system roles:`);
    systemRoles.forEach((role) => {
      console.log(`   - ${role.name}`);
    });
  }

  // Check for Superadmin and Unassigned roles
  const hasSuperadmin = systemRoles?.some((r) => r.name === 'Superadmin');
  const hasUnassigned = systemRoles?.some((r) => r.name === 'Unassigned');

  if (!hasSuperadmin) {
    console.error('❌ Missing Superadmin system role');
    issues++;
  } else {
    console.log('✅ Superadmin role exists');
  }

  if (!hasUnassigned) {
    console.error('❌ Missing Unassigned system role');
    issues++;
  } else {
    console.log('✅ Unassigned role exists');
  }

  // Check user assignments
  console.log('\n📊 Checking User Assignments...\n');

  const { data: users } = await supabase
    .from('user_profiles')
    .select(`
      id,
      email,
      name,
      is_superadmin,
      user_roles!user_roles_user_id_fkey (
        id,
        role_id
      )
    `);

  if (!users || users.length === 0) {
    console.warn('⚠️  Warning: No users found');
    warnings++;
  } else {
    const usersWithoutRoles = users.filter(
      (u: any) => !u.is_superadmin && (!u.user_roles || u.user_roles.length === 0)
    );

    if (usersWithoutRoles.length > 0) {
      console.warn(`⚠️  ${usersWithoutRoles.length} users without roles:`);
      usersWithoutRoles.slice(0, 5).forEach((u: any) => {
        console.warn(`   - ${u.email}`);
      });
      if (usersWithoutRoles.length > 5) {
        console.warn(`   ... and ${usersWithoutRoles.length - 5} more`);
      }
      warnings++;
    } else {
      console.log('✅ All users have roles assigned');
    }
  }

  // Check permission coverage
  console.log('\n📊 Checking Permission Coverage...\n');

  const allUsedPermissions = new Set<string>();
  roles?.forEach((role) => {
    const permissions = role.permissions || {};
    Object.keys(permissions).forEach((key) => {
      if (permissions[key] === true) {
        allUsedPermissions.add(key);
      }
    });
  });

  const unusedPermissions = allPermissions.filter(
    (p) => !allUsedPermissions.has(p)
  );

  if (unusedPermissions.length > 0) {
    console.warn(`⚠️  ${unusedPermissions.length} permissions not used in any role:`);
    unusedPermissions.slice(0, 10).forEach((p) => {
      console.warn(`   - ${p}`);
    });
    if (unusedPermissions.length > 10) {
      console.warn(`   ... and ${unusedPermissions.length - 10} more`);
    }
    warnings++;
  } else {
    console.log('✅ All permissions are used in at least one role');
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Validation Summary\n');

  if (issues === 0 && warnings === 0) {
    console.log('✅ Permission system is healthy!');
    console.log('   No issues or warnings found.');
  } else {
    if (issues > 0) {
      console.error(`❌ Found ${issues} critical issue${issues > 1 ? 's' : ''}`);
    }
    if (warnings > 0) {
      console.warn(`⚠️  Found ${warnings} warning${warnings > 1 ? 's' : ''}`);
    }
  }

  console.log('═'.repeat(60) + '\n');

  process.exit(issues > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
