#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Debug Permission Issues
 * Interactive script to debug user permission problems
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import { Permission } from '../lib/permissions';
import { hasPermission } from '../lib/permission-checker';
import { UserWithRoles } from '../lib/rbac';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🔍 Permission Debug Tool\n');
  console.log('This tool helps debug permission issues for users.\n');

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    console.error('Please ensure .env.local contains:');
    console.error('  - NEXT_PUBLIC_SUPABASE_URL');
    console.error('  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get user email or ID
  const userInput = await question('Enter user email or ID: ');

  if (!userInput.trim()) {
    console.error('❌ Error: User email or ID is required');
    rl.close();
    return;
  }

  // Fetch user
  let query = supabase
    .from('user_profiles')
    .select(`
      *,
      user_roles!user_roles_user_id_fkey (
        id,
        role_id,
        assigned_at,
        roles!user_roles_role_id_fkey (
          id,
          name,
          permissions,
          is_system_role,
          department_id,
          departments!roles_department_id_fkey (
            id,
            name
          )
        )
      )
    `);

  // Check if input is UUID or email
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userInput);

  if (isUuid) {
    query = query.eq('id', userInput);
  } else {
    query = query.eq('email', userInput);
  }

  const { data: userProfile, error } = await query.single();

  if (error || !userProfile) {
    console.error('❌ Error: User not found');
    console.error(error?.message || 'No user matches the provided email/ID');
    rl.close();
    return;
  }

  // Display user info
  console.log('\n👤 User Information:');
  console.log('─'.repeat(60));
  console.log(`ID: ${userProfile.id}`);
  console.log(`Email: ${userProfile.email}`);
  console.log(`Name: ${userProfile.name}`);
  console.log(`Superadmin: ${userProfile.is_superadmin ? '✅ YES' : '❌ No'}`);

  // Display roles
  console.log('\n🎭 Roles:');
  console.log('─'.repeat(60));

  if (!userProfile.user_roles || userProfile.user_roles.length === 0) {
    console.log('⚠️  No roles assigned (Unassigned user)');
  } else {
    userProfile.user_roles.forEach((ur: any) => {
      const role = ur.roles;
      console.log(`\nRole: ${role.name}`);
      console.log(`  ID: ${role.id}`);
      console.log(`  System Role: ${role.is_system_role ? 'Yes' : 'No'}`);
      if (role.departments) {
        console.log(`  Department: ${role.departments.name}`);
      }
      console.log(`  Assigned: ${new Date(ur.assigned_at).toLocaleString()}`);
    });
  }

  // Display all permissions
  console.log('\n🔐 Permissions:');
  console.log('─'.repeat(60));

  const allPermissions = new Set<string>();
  userProfile.user_roles?.forEach((ur: any) => {
    const permissions = ur.roles?.permissions || {};
    Object.entries(permissions).forEach(([key, value]) => {
      if (value === true) {
        allPermissions.add(key);
      }
    });
  });

  if (allPermissions.size === 0 && !userProfile.is_superadmin) {
    console.log('⚠️  No permissions (user cannot access any features)');
  } else if (userProfile.is_superadmin) {
    console.log('✅ ALL PERMISSIONS (Superadmin)');
  } else {
    const permissionsArray = Array.from(allPermissions).sort();
    permissionsArray.forEach((perm, index) => {
      console.log(`${index + 1}. ${perm}`);
    });
    console.log(`\nTotal: ${permissionsArray.length} permissions`);
  }

  // Test specific permission
  console.log('\n🧪 Test Specific Permission:');
  console.log('─'.repeat(60));

  const permissionToTest = await question('Enter permission to test (or press Enter to skip): ');

  if (permissionToTest.trim()) {
    // Check if permission exists
    if (!Object.values(Permission).includes(permissionToTest as Permission)) {
      console.log(`⚠️  Warning: '${permissionToTest}' is not a valid permission`);
    }

    const hasAccessResult = await hasPermission(
      userProfile as UserWithRoles,
      permissionToTest as Permission,
      undefined,
      supabase
    );

    console.log(`\nResult: ${hasAccessResult ? '✅ GRANTED' : '❌ DENIED'}`);

    if (hasAccessResult) {
      console.log('✅ User has this permission');
    } else {
      console.log('❌ User does NOT have this permission');
      console.log('\n💡 Possible reasons:');
      console.log('  1. Permission not assigned to any of user\'s roles');
      console.log('  2. User has no roles (Unassigned)');
      console.log('  3. Context required (e.g., project assignment)');
    }
  }

  // Check project assignments
  console.log('\n📋 Project Assignments:');
  console.log('─'.repeat(60));

  const { data: assignments } = await supabase
    .from('project_assignments')
    .select(`
      id,
      project_id,
      assigned_at,
      removed_at,
      projects (
        id,
        name,
        status
      )
    `)
    .eq('user_id', userProfile.id)
    .is('removed_at', null);

  if (!assignments || assignments.length === 0) {
    console.log('⚠️  No active project assignments');
  } else {
    assignments.forEach((assignment: any, index: number) => {
      console.log(`\n${index + 1}. ${assignment.projects?.name || 'Unknown'}`);
      console.log(`   ID: ${assignment.project_id}`);
      console.log(`   Status: ${assignment.projects?.status || 'Unknown'}`);
      console.log(`   Assigned: ${new Date(assignment.assigned_at as string).toLocaleString()}`);
    });
    console.log(`\nTotal: ${assignments.length} active assignments`);
  }

  // Check account memberships
  console.log('\n🏢 Account Memberships:');
  console.log('─'.repeat(60));

  const { data: accountMembers } = await supabase
    .from('account_members')
    .select(`
      id,
      account_id,
      created_at,
      accounts (
        id,
        name,
        status
      )
    `)
    .eq('user_id', userProfile.id);

  if (!accountMembers || accountMembers.length === 0) {
    console.log('⚠️  No account memberships');
  } else {
    accountMembers.forEach((member: any, index: number) => {
      console.log(`\n${index + 1}. ${member.accounts?.name || 'Unknown'}`);
      console.log(`   ID: ${member.account_id}`);
      console.log(`   Status: ${member.accounts?.status || 'Unknown'}`);
      console.log(`   Member since: ${new Date(member.created_at as string).toLocaleString()}`);
    });
    console.log(`\nTotal: ${accountMembers.length} account memberships`);
  }

  console.log('\n✅ Debug complete!\n');
  rl.close();
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  rl.close();
  process.exit(1);
});
