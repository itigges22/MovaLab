#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Get Workflow Table Schemas
 *
 * Retrieves the actual column structure of workflow tables
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function getTableSchema(tableName: string): Promise<void> {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = '${tableName}'
      ORDER BY ordinal_position;
    `
  });

  if (error) {
    // Try alternative method - just get one row
    const { data: sampleData, error: sampleError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log(`\n${tableName}: ERROR - ${sampleError.message}`);
    } else {
      console.log(`\n${tableName}:`);
      if (sampleData && sampleData.length > 0) {
        const columns = Object.keys(sampleData[0]);
        console.log(`  Columns (${columns.length}):`);
        columns.forEach(col => {
          const value = sampleData[0][col];
          const type = typeof value;
          console.log(`    - ${col} (inferred: ${type})`);
        });
      } else {
        console.log('  No data to infer schema');
      }
    }
  } else {
    console.log(`\n${tableName}:`);
    if (data && data.length > 0) {
      data.forEach((col: any) => {
        console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
        if (col.column_default) {
          console.log(`    Default: ${col.column_default}`);
        }
      });
    }
  }
}

async function main() {
  console.log('=== WORKFLOW TABLE SCHEMAS ===\n');

  const tables = [
    'workflow_templates',
    'workflow_nodes',
    'workflow_connections',
    'workflow_instances',
    'workflow_history',
    'workflow_approvals',
    'form_templates',
    'form_responses'
  ];

  for (const table of tables) {
    await getTableSchema(table);
  }

  console.log('\n\n=== ASSIGNMENT TABLE SCHEMAS ===\n');

  const assignmentTables = [
    'project_assignments',
    'account_members',
    'account_managers'
  ];

  for (const table of assignmentTables) {
    await getTableSchema(table);
  }
}

main().catch(console.error);
