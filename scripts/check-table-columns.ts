import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oomnezdhkmsfjlihkmui.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vbW5lemRoa21zZmpsaWhrbXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg5Nzg3MiwiZXhwIjoyMDc1NDczODcyfQ.ihIlBMIbbVqfwaHE19po6i7j07PXpgpRIOPeTeJMCgQ'
);

async function checkTableColumns() {
  const tables = ['accounts', 'projects', 'tasks', 'user_profiles'];

  console.log('=== TABLE COLUMN CHECK ===\n');

  for (const table of tables) {
    console.log(`\n📋 TABLE: ${table}`);
    console.log('─'.repeat(60));

    // Query a single row to see what columns exist
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ ERROR:', error.message);
    } else if (data && data.length > 0) {
      console.log('✅ COLUMNS:', Object.keys(data[0]).join(', '));
    } else {
      console.log('⚠️  No data in table, fetching with select *');
      // Try with head to get structure
      const { error: headError } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (headError) {
        console.log('❌ ERROR:', headError.message);
      } else {
        console.log('⚠️  Empty table - need to infer from schema');
      }
    }
  }
}

checkTableColumns();
