#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Check User Status
 * Quick check of user authentication and role status
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('\n👤 User Status Check\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all users with roles
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select(`
      id,
      email,
      name,
      is_superadmin,
      created_at,
      user_roles!user_roles_user_id_fkey (
        id,
        role_id,
        roles!user_roles_role_id_fkey (
          id,
          name,
          is_system_role
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('⚠️  No users found in database');
    return;
  }

  console.log(`📊 Total Users: ${users.length}\n`);

  // Categorize users
  const superadmins = users.filter((u: any) => u.is_superadmin);
  const usersWithRoles = users.filter((u: any) =>
    !u.is_superadmin && u.user_roles && u.user_roles.length > 0
  );
  const usersWithoutRoles = users.filter((u: any) =>
    !u.is_superadmin && (!u.user_roles || u.user_roles.length === 0)
  );

  // Superadmins
  if (superadmins.length > 0) {
    console.log(`👑 Superadmins (${superadmins.length}):`);
    console.log('─'.repeat(60));
    superadmins.forEach((user: any) => {
      console.log(`  ${user.email}`);
      console.log(`    ID: ${user.id}`);
      console.log(`    Created: ${new Date(user.created_at).toLocaleString()}`);
    });
    console.log('');
  } else {
    console.warn('⚠️  No superadmins found!\n');
  }

  // Users with roles
  if (usersWithRoles.length > 0) {
    console.log(`✅ Users with Roles (${usersWithRoles.length}):`);
    console.log('─'.repeat(60));
    usersWithRoles.slice(0, 10).forEach((user: any) => {
      const roleNames = user.user_roles.map((ur: any) => ur.roles.name).join(', ');
      console.log(`  ${user.email}`);
      console.log(`    Roles: ${roleNames}`);
    });
    if (usersWithRoles.length > 10) {
      console.log(`  ... and ${usersWithRoles.length - 10} more users`);
    }
    console.log('');
  }

  // Users without roles (potential issue)
  if (usersWithoutRoles.length > 0) {
    console.warn(`⚠️  Users WITHOUT Roles (${usersWithoutRoles.length}):`);
    console.log('─'.repeat(60));
    usersWithoutRoles.slice(0, 10).forEach((user: any) => {
      console.warn(`  ${user.email}`);
      console.warn(`    ID: ${user.id}`);
      console.warn(`    Created: ${new Date(user.created_at).toLocaleString()}`);
      console.warn(`    ⚠️  This user cannot access any features!`);
    });
    if (usersWithoutRoles.length > 10) {
      console.warn(`  ... and ${usersWithoutRoles.length - 10} more users`);
    }
    console.log('');
  }

  // Role distribution
  console.log('📊 Role Distribution:');
  console.log('─'.repeat(60));

  const roleCount = new Map<string, number>();
  users.forEach((user: any) => {
    if (user.is_superadmin) {
      roleCount.set('Superadmin', (roleCount.get('Superadmin') || 0) + 1);
    } else if (user.user_roles && user.user_roles.length > 0) {
      user.user_roles.forEach((ur: any) => {
        const roleName = ur.roles.name;
        roleCount.set(roleName, (roleCount.get(roleName) || 0) + 1);
      });
    } else {
      roleCount.set('Unassigned', (roleCount.get('Unassigned') || 0) + 1);
    }
  });

  const sortedRoles = Array.from(roleCount.entries()).sort((a, b) => b[1] - a[1]);
  sortedRoles.forEach(([role, count]) => {
    console.log(`  ${role}: ${count} user${count !== 1 ? 's' : ''}`);
  });

  console.log('\n✅ Check complete!\n');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
