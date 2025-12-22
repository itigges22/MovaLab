#!/usr/bin/env tsx
 

/**
 * Fix Common Permission Problems
 * Auto-fixes common permission configuration issues
 */
import { createClient } from '@supabase/supabase-js';
import { Permission } from '../lib/permissions';
async function main() {
  console.log('\n🔧 Permission Auto-Fix Tool\n');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  let fixCount = 0;
  // Fix 1: Remove deprecated permissions from all roles
  console.log('🔧 Fix 1: Removing deprecated permissions...\n');
  const deprecatedPermissions = [
    'CREATE_PROJECT',
    'EDIT_PROJECT',
    'DELETE_PROJECT',
    'EDIT_ALL_PROJECTS',
    'DELETE_ALL_PROJECTS',
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
    'VIEW_ACCOUNT_PROJECTS_UPDATES',
    'VIEW_OWN_CAPACITY',
    'VIEW_CAPACITY_DASHBOARD',
    'VIEW_TABLE',
    'EDIT_TABLE'
  ];
  const { data: roles } = await supabase
    .from('roles')
    .select('*');
  if (roles) {
    for (const role of roles) {
      const permissions = role.permissions || {};
      let hasDeprecated = false;
      const updatedPermissions = { ...permissions };
      deprecatedPermissions.forEach((deprecated) => {
        if (updatedPermissions[deprecated]) {
          delete updatedPermissions[deprecated];
          hasDeprecated = true;
        }
      });
      if (hasDeprecated) {
        const { error } = await supabase
          .from('roles')
          .update({ permissions: updatedPermissions })
          .eq('id', role.id);
        if (!error) {
          console.log(`✅ Removed deprecated permissions from role: ${role.name}`);
          fixCount++;
        } else {
          console.error(`❌ Failed to update role ${role.name}:`, error.message);
        }
      }
    }
  }
  // Fix 2: Add consolidated permissions to roles that had old permissions
  console.log('\n🔧 Fix 2: Adding consolidated permissions...\n');
  const permissionMigrations = [
    {
      old: ['CREATE_PROJECT', 'EDIT_PROJECT', 'DELETE_PROJECT', 'EDIT_ALL_PROJECTS', 'DELETE_ALL_PROJECTS'],
      new: Permission.MANAGE_ALL_PROJECTS
    },
    {
      old: ['CREATE_ACCOUNT', 'EDIT_ACCOUNT', 'DELETE_ACCOUNT'],
      new: Permission.MANAGE_ACCOUNTS
    },
    {
      old: ['CREATE_DEPARTMENT', 'EDIT_DEPARTMENT', 'DELETE_DEPARTMENT'],
      new: Permission.MANAGE_DEPARTMENTS
    },
    {
      old: ['LOG_TIME', 'EDIT_OWN_TIME_ENTRIES', 'EDIT_TEAM_TIME_ENTRIES'],
      new: Permission.MANAGE_TIME
    },
    {
      old: ['VIEW_TEAM_TIME_ENTRIES'],
      new: Permission.VIEW_ALL_TIME_ENTRIES
    },
    {
      old: ['VIEW_ALL_PROJECT_UPDATES'],
      new: Permission.VIEW_ALL_UPDATES
    }
  ];
  if (roles) {
    for (const role of roles) {
      const permissions = role.permissions || {};
      let needsUpdate = false;
      const updatedPermissions = { ...permissions };
      permissionMigrations.forEach((migration) => {
        const hadOldPermission = migration.old.some((old) => permissions[old]);
        if (hadOldPermission && !updatedPermissions[migration.new]) {
          updatedPermissions[migration.new] = true;
          needsUpdate = true;
        }
      });
      if (needsUpdate) {
        const { error } = await supabase
          .from('roles')
          .update({ permissions: updatedPermissions })
          .eq('id', role.id);
        if (!error) {
          console.log(`✅ Added consolidated permissions to role: ${role.name}`);
          fixCount++;
        }
      }
    }
  }
  // Fix 3: Ensure system roles exist
  console.log('\n🔧 Fix 3: Ensuring system roles exist...\n');
  const { data: superadmin } = await supabase
    .from('roles')
    .select('*')
    .eq('name', 'Superadmin')
    .eq('is_system_role', true)
    .single();
  if (!superadmin) {
    // Create Superadmin role with all permissions
    const allPermissions = Object.values(Permission).reduce((acc, perm) => {
      acc[perm] = true;
      return acc;
    }, {} as Record<string, boolean>);
    const { error } = await supabase
      .from('roles')
      .insert({
        name: 'Superadmin',
        description: 'System administrator with all permissions',
        permissions: allPermissions,
        is_system_role: true,
        hierarchy_level: 0
      });
    if (!error) {
      console.log('✅ Created Superadmin system role');
      fixCount++;
    } else {
      console.error('❌ Failed to create Superadmin role:', error.message);
    }
  } else {
    console.log('✅ Superadmin role exists');
  }
  const { data: unassigned } = await supabase
    .from('roles')
    .select('*')
    .eq('name', 'Unassigned')
    .eq('is_system_role', true)
    .single();
  if (!unassigned) {
    const { error } = await supabase
      .from('roles')
      .insert({
        name: 'Unassigned',
        description: 'Default role for users without assigned roles',
        permissions: {},
        is_system_role: true,
        hierarchy_level: 999
      });
    if (!error) {
      console.log('✅ Created Unassigned system role');
      fixCount++;
    } else {
      console.error('❌ Failed to create Unassigned role:', error.message);
    }
  } else {
    console.log('✅ Unassigned role exists');
  }
  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Auto-Fix Complete!\n');
  console.log(`Fixed ${fixCount} issue${fixCount !== 1 ? 's' : ''}`);
  console.log('═'.repeat(60) + '\n');
}
main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
