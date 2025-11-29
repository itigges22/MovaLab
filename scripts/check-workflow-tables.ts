#!/usr/bin/env tsx
/**
 * Check workflow table schemas
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkSchemas() {
  const tables = [
    'workflow_templates',
    'workflow_nodes',
    'workflow_connections',
    'workflow_instances',
    'workflow_history',
    'form_templates',
    'form_responses'
  ];

  for (const tableName of tables) {
    console.log(`\n📋 Table: ${tableName}`);
    console.log('─'.repeat(60));

    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: tableName
    });

    if (error) {
      // Fallback: try to select from the table to see what columns exist
      const { data: sample, error: selectError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (selectError) {
        console.log(`❌ Error: ${selectError.message}`);
      } else if (sample && sample.length > 0) {
        console.log('Columns detected from sample row:');
        Object.keys(sample[0]).forEach(col => {
          console.log(`  - ${col}`);
        });
      } else {
        console.log('Table exists but is empty');
        // Try another approach: describe via information_schema
        const { data: schemaData, error: schemaError } = await supabase
          .from('information_schema.columns' as any)
          .select('column_name, data_type, is_nullable')
          .eq('table_schema', 'public')
          .eq('table_name', tableName);

        if (!schemaError && schemaData) {
          console.log('Columns from information_schema:');
          schemaData.forEach((col: any) => {
            console.log(`  - ${col.column_name} (${col.data_type})${col.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}`);
          });
        }
      }
    } else {
      console.log('Columns:');
      data?.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    }
  }
}

checkSchemas().catch(console.error);
