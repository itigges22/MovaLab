import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oomnezdhkmsfjlihkmui.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbW5lemRoa21zZmpsaWhrbXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5Nzg3MiwiZXhwIjoyMDc1NDczODcyfQ.ihIlBMIbbVqfwaHE19po6i7j07PXpgpRIOPeTeJMCgQ'
);

const criticalTables = ['projects', 'accounts', 'tasks', 'user_profiles', 'time_entries'];

async function checkRLSPolicies() {
  console.log('=== RLS POLICY CHECK ===\n');

  for (const table of criticalTables) {
    console.log(`\n📋 TABLE: ${table}`);
    console.log('─'.repeat(60));

    // Query pg_policies for this table
    const { data, error } = await supabase.rpc('query_policies', {
      table_name: table
    });

    if (error) {
      // Fallback: Try to query with raw SQL if RPC doesn't exist
      console.log('⚠️  Cannot query policies directly (no RPC function)');
      console.log('   Manual check required via Supabase SQL Editor:');
      console.log(`   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = '${table}';`);
    } else {
      console.log('✅ Policies found:', data);
    }
  }

  // Try alternative approach: check if tables have RLS enabled
  console.log('\n\n=== RLS ENABLED STATUS ===\n');
  for (const table of criticalTables) {
    // We can infer RLS is enabled if we get permission errors when querying as anon
    const anonSupabase = createClient(
      'https://oomnezdhkmsfjlihkmui.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbW5lemRoa21zZmpsaWhrbXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4OTc4NzIsImV4cCI6MjA3NTQ3Mzg3Mn0.EmSUB_enfy8limVc1wDSHdlEcrk9wI-ZiEFIScAUii4'
    );

    const { data, error } = await anonSupabase.from(table).select('id').limit(1);

    if (error && error.message.includes('permission denied')) {
      console.log(`✅ ${table}: RLS ENABLED (anonymous access blocked)`);
    } else if (error) {
      console.log(`⚠️  ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`⚠️  ${table}: RLS MAY BE DISABLED OR PERMISSIVE (anonymous can read)`);
    }
  }
}

checkRLSPolicies();
