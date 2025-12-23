#!/usr/bin/env tsx
/**
 * Create Seed Users in Supabase Auth
 *
 * This script creates 8 test users in the local Supabase auth.users table.
 * It must be run AFTER `supabase db reset` to populate the database with
 * test users that match the user_profiles in seed.sql.
 *
 * All test users have the password: Test1234!
 *
 * Usage:
 *   1. Start local Supabase: npm run docker:start
 *   2. Reset database: npm run docker:reset
 *   3. Create users: npx tsx scripts/create-seed-users.ts
 *
 * Or use the combined command:
 *   npm run docker:seed
 */

import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration
const SUPABASE_URL = 'http://localhost:54321';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Test users matching the UUIDs in seed.sql
const TEST_USERS = [
  {
    id: '11111111-1111-1111-1111-000000000001',
    email: 'superadmin@test.local',
    name: 'Super Admin',
    password: 'Test1234!',
  },
  {
    id: '11111111-1111-1111-1111-000000000002',
    email: 'exec@test.local',
    name: 'Alex Executive',
    password: 'Test1234!',
  },
  {
    id: '11111111-1111-1111-1111-000000000003',
    email: 'manager@test.local',
    name: 'Jordan Manager',
    password: 'Test1234!',
  },
  {
    id: '11111111-1111-1111-1111-000000000004',
    email: 'pm@test.local',
    name: 'Taylor PM',
    password: 'Test1234!',
  },
  {
    id: '11111111-1111-1111-1111-000000000005',
    email: 'designer@test.local',
    name: 'Morgan Designer',
    password: 'Test1234!',
  },
  {
    id: '11111111-1111-1111-1111-000000000006',
    email: 'dev@test.local',
    name: 'Casey Developer',
    password: 'Test1234!',
  },
  {
    id: '11111111-1111-1111-1111-000000000007',
    email: 'contributor@test.local',
    name: 'Riley Contributor',
    password: 'Test1234!',
  },
  {
    id: '11111111-1111-1111-1111-000000000008',
    email: 'client@test.local',
    name: 'Client User',
    password: 'Test1234!',
  },
];

async function createSeedUsers() {
  console.log('🔐 Creating seed users in local Supabase Auth...\n');

  // Create Supabase admin client with service role key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Test connection
  console.log('🔍 Testing connection to local Supabase...');
  const { error: testError } = await supabase.from('user_profiles').select('count').limit(1);

  if (testError) {
    console.error('❌ Failed to connect to Supabase:', testError.message);
    console.error('\n💡 Make sure local Supabase is running:');
    console.error('   npm run docker:start\n');
    process.exit(1);
  }

  console.log('✅ Connected to local Supabase\n');

  let successCount = 0;
  let errorCount = 0;

  // Create each test user
  for (const user of TEST_USERS) {
    console.log(`📝 Creating user: ${user.email} (${user.name})...`);

    const { data, error } = await supabase.auth.admin.createUser({
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: user.name,
      },
    });

    if (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      errorCount++;
    } else {
      console.log(`   ✅ Created: ${data.user?.id}`);
      successCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Successfully created: ${successCount} users`);

  if (errorCount > 0) {
    console.log(`❌ Failed to create: ${errorCount} users`);
  }

  console.log('='.repeat(60));
  console.log('\n📋 Test User Credentials:');
  console.log('   Password for all users: Test1234!\n');
  console.log('   Users:');
  TEST_USERS.forEach((user) => {
    console.log(`   - ${user.email.padEnd(30)} (${user.name})`);
  });

  console.log('\n🚀 Next steps:');
  console.log('   1. Start the app: npm run dev');
  console.log('   2. Open: http://localhost:3000');
  console.log('   3. Login with any test user');
  console.log('   4. Access Supabase Studio: npm run docker:studio\n');

  // Verify user_profiles were auto-created by trigger
  console.log('🔍 Verifying user_profiles were auto-created...');
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, email, name')
    .order('email');

  if (profileError) {
    console.error('⚠️  Could not verify user_profiles:', profileError.message);
  } else if (profiles && profiles.length === TEST_USERS.length) {
    console.log(`✅ All ${profiles.length} user_profiles created successfully by trigger\n`);
  } else {
    console.warn(`⚠️  Expected ${TEST_USERS.length} profiles, found ${profiles?.length || 0}`);
    console.warn('   The handle_new_user() trigger may not be working correctly\n');
  }
}

// Run the script
createSeedUsers().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
