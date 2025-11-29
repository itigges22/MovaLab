import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oomnezdhkmsfjlihkmui.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbW5lemRoa21zZmpsaWhrbXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTc4NzIsImV4cCI6MjA3NTQ3Mzg3Mn0.EmSUB_enfy8limVc1wDSHdlEcrk9wI-ZiEFIScAUii4'
);

async function testFounderAccess() {
  console.log('=== FOUNDER ACCESS TEST ===\n');

  // Login as Founder
  console.log('🔐 Logging in as Founder...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'itigges22@gmail.com',
    password: 'Iman@2012!'
  });

  if (authError) {
    console.log('❌ LOGIN FAILED:', authError.message);
    return;
  }

  console.log('✅ LOGIN SUCCESS');
  console.log('   User ID:', authData.user.id);
  console.log('   Email:', authData.user.email);

  // Get user profile and roles
  console.log('\n📋 Fetching user profile and roles...');
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select(`
      *,
      user_roles!user_roles_user_id_fkey(
        roles(*)
      )
    `)
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.log('❌ PROFILE ERROR:', profileError.message);
  } else {
    console.log('✅ PROFILE LOADED');
    console.log('   Name:', profile.name);
    console.log('   Is Superadmin:', profile.is_superadmin);
    console.log('   Roles:', profile.user_roles?.map((ur: any) => ur.roles?.name).join(', '));
  }

  // Test projects access
  console.log('\n📊 Testing PROJECTS access...');
  const { data: projects, error: projectsError, count: projectsCount } = await supabase
    .from('projects')
    .select('id, name, status', { count: 'exact' });

  if (projectsError) {
    console.log('❌ PROJECTS ERROR:', projectsError.message);
  } else {
    console.log(`✅ PROJECTS ACCESS: ${projectsCount} visible`);
    projects?.forEach(p => console.log(`   - ${p.name} (${p.status})`));
  }

  // Test accounts access
  console.log('\n🏢 Testing ACCOUNTS access...');
  const { data: accounts, error: accountsError, count: accountsCount } = await supabase
    .from('accounts')
    .select('id, name, status', { count: 'exact' });

  if (accountsError) {
    console.log('❌ ACCOUNTS ERROR:', accountsError.message);
  } else {
    console.log(`✅ ACCOUNTS ACCESS: ${accountsCount} visible`);
    accounts?.forEach(a => console.log(`   - ${a.name} (${a.status})`));
  }

  // Test tasks access
  console.log('\n✓ Testing TASKS access...');
  const { data: tasks, error: tasksError, count: tasksCount } = await supabase
    .from('tasks')
    .select('id, name, status', { count: 'exact' });

  if (tasksError) {
    console.log('❌ TASKS ERROR:', tasksError.message);
  } else {
    console.log(`✅ TASKS ACCESS: ${tasksCount} visible`);
    if (tasksCount && tasksCount > 0) {
      tasks?.forEach(t => console.log(`   - ${t.name} (${t.status})`));
    } else {
      console.log('   (no tasks in database)');
    }
  }

  // Test user_profiles access (should see all users as Founder)
  console.log('\n👥 Testing USER_PROFILES access...');
  const { data: users, error: usersError, count: usersCount } = await supabase
    .from('user_profiles')
    .select('id, name, email, is_superadmin', { count: 'exact' });

  if (usersError) {
    console.log('❌ USERS ERROR:', usersError.message);
  } else {
    console.log(`✅ USERS ACCESS: ${usersCount} visible`);
    users?.forEach(u => console.log(`   - ${u.name} (${u.email}) [Superadmin: ${u.is_superadmin}]`));
  }

  // Logout
  await supabase.auth.signOut();
  console.log('\n🔓 Logged out');
}

testFounderAccess();
