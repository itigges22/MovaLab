#!/usr/bin/env tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Comprehensive Permission Test Setup
 * Creates test roles and scenarios for permission testing
 */

import { createClient } from '@supabase/supabase-js';
import { Permission } from '../lib/permissions';

async function main() {
  console.log('\n🧪 Setting up Comprehensive Permission Tests\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test role definitions
  const testRoles = [
    {
      name: 'Test - Executive',
      description: 'Test role with all override permissions',
      permissions: {
        [Permission.VIEW_ALL_PROJECTS]: true,
        [Permission.MANAGE_ALL_PROJECTS]: true,
        [Permission.VIEW_ALL_ACCOUNTS]: true,
        [Permission.VIEW_ALL_DEPARTMENTS]: true,
        [Permission.VIEW_ALL_UPDATES]: true,
        [Permission.VIEW_ALL_TIME_ENTRIES]: true,
        [Permission.VIEW_ALL_ANALYTICS]: true,
        [Permission.VIEW_ALL_CAPACITY]: true,
        [Permission.MANAGE_ALL_WORKFLOWS]: true
      }
    },
    {
      name: 'Test - Project Manager',
      description: 'Test role with project management permissions',
      permissions: {
        [Permission.VIEW_PROJECTS]: true,
        [Permission.MANAGE_PROJECTS]: true,
        [Permission.VIEW_UPDATES]: true,
        [Permission.MANAGE_UPDATES]: true,
        [Permission.VIEW_ISSUES]: true,
        [Permission.MANAGE_ISSUES]: true,
        [Permission.MANAGE_WORKFLOWS]: true,
        [Permission.VIEW_TIME_ENTRIES]: true
      }
    },
    {
      name: 'Test - Team Lead',
      description: 'Test role with team-level permissions',
      permissions: {
        [Permission.VIEW_PROJECTS]: true,
        [Permission.VIEW_UPDATES]: true,
        [Permission.VIEW_ISSUES]: true,
        [Permission.MANAGE_TIME]: true,
        [Permission.VIEW_TIME_ENTRIES]: true,
        [Permission.VIEW_TEAM_CAPACITY]: true
      }
    },
    {
      name: 'Test - Contributor',
      description: 'Test role with basic permissions',
      permissions: {
        [Permission.VIEW_PROJECTS]: true,
        [Permission.VIEW_UPDATES]: true,
        [Permission.MANAGE_TIME]: true
      }
    },
    // Client access role removed - client access is now hardcoded for client role (Phase 9)
    {
      name: 'Test - Read Only',
      description: 'Test role with view-only permissions',
      permissions: {
        [Permission.VIEW_PROJECTS]: true,
        [Permission.VIEW_ACCOUNTS]: true,
        [Permission.VIEW_DEPARTMENTS]: true,
        [Permission.VIEW_UPDATES]: true,
        [Permission.VIEW_ISSUES]: true,
        [Permission.VIEW_NEWSLETTERS]: true
      }
    }
  ];

  console.log(`📝 Creating ${testRoles.length} test roles...\n`);

  for (const roleData of testRoles) {
    // Check if role already exists
    const { data: existing } = await supabase
      .from('roles')
      .select('id')
      .eq('name', roleData.name)
      .single();

    if (existing) {
      console.log(`⏭️  Skipping ${roleData.name} (already exists)`);
      continue;
    }

    // Create role
    const { data: _role, error } = await supabase
      .from('roles')
      .insert({
        name: roleData.name,
        description: roleData.description,
        permissions: roleData.permissions,
        is_system_role: false
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ Failed to create ${roleData.name}:`, error.message);
    } else {
      const permCount = Object.keys(roleData.permissions).length;
      console.log(`✅ Created ${roleData.name} (${permCount} permissions)`);
    }
  }

  console.log('\n📊 Test Role Summary:\n');
  console.log('─'.repeat(60));

  const { data: createdRoles } = await supabase
    .from('roles')
    .select('*')
    .ilike('name', 'Test -%')
    .order('name');

  if (createdRoles && createdRoles.length > 0) {
    createdRoles.forEach((role: any) => {
      const permCount = Object.keys(role.permissions || {}).length;
      console.log(`${role.name}: ${permCount} permissions`);
    });
  } else {
    console.log('No test roles found');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Test Setup Complete!\n');
  console.log('Test roles are ready for permission testing.');
  console.log('You can now assign these roles to test users.\n');
  console.log('To cleanup, run:');
  console.log('  DELETE FROM roles WHERE name LIKE \'Test -%\';\n');
  console.log('═'.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
