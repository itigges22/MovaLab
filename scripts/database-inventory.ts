import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oomnezdhkmsfjlihkmui.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbW5lemRoa21zZmpsaWhrbXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5Nzg3MiwiZXhwIjoyMDc1NDczODcyfQ.ihIlBMIbbVqfwaHE19po6i7j07PXpgpRIOPeTeJMCgQ'
);

const coreTables = [
  'accounts', 'projects', 'tasks', 'user_profiles', 'roles',
  'user_roles', 'permissions', 'role_permissions', 'time_entries',
  'project_assignments', 'workflow_instances', 'workflow_templates',
  'client_invites', 'client_feedback', 'form_templates', 'form_responses'
];

async function testTableAccess() {
  console.log('=== CORE TABLES EXISTENCE CHECK ===\n');

  for (const table of coreTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ERROR - ${error.message}`);
      } else {
        console.log(`✅ ${table}: EXISTS (${count ?? 0} rows)`);
      }
    } catch (e: any) {
      console.log(`❌ ${table}: EXCEPTION - ${e.message}`);
    }
  }
}

testTableAccess();
