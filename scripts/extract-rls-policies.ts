#!/usr/bin/env tsx
/**
 * Extract RLS Policies, Functions, and Views from Cloud Supabase
 *
 * This script connects to your cloud Supabase database and extracts:
 * - Table schemas (CREATE TABLE statements)
 * - Database functions (user_has_permission, user_is_superadmin, etc.)
 * - Database views (weekly_capacity_summary)
 * - RLS policies for all tables
 *
 * Usage:
 *   1. Ensure .env.local is configured with cloud Supabase credentials
 *   2. Run: npx tsx scripts/extract-rls-policies.ts
 *   3. Output files will be created in supabase/migrations/
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

// Create migrations directory if it doesn't exist
try {
  mkdirSync(MIGRATIONS_DIR, { recursive: true });
} catch (error) {
  // Directory already exists, that's fine
}

async function extractSchema() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    console.error('   Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY are set');
    process.exit(1);
  }

  console.log('🔍 Connecting to cloud Supabase...\n');
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Test connection
  const { error: testError } = await supabase.from('user_profiles').select('count').limit(1);
  if (testError) {
    console.error('❌ Failed to connect to Supabase:', testError.message);
    process.exit(1);
  }

  console.log('✅ Connected to cloud Supabase\n');

  // Extract RLS policies
  console.log('📋 Extracting RLS policies...');
  const { data: policies, error: policiesError } = await supabase.rpc('run_sql', {
    query: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles::text,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `
  }) as any;

  if (policiesError) {
    console.error('⚠️  Could not extract RLS policies via RPC');
    console.error('   You may need to extract policies manually from Supabase Dashboard');
    console.error('   Error:', policiesError.message);
  } else if (policies) {
    console.log(`✅ Found ${policies.length} RLS policies\n`);

    // Generate RLS policies SQL
    let rlsSQL = `-- Extracted RLS Policies from Cloud Supabase
-- Date: ${new Date().toISOString()}
-- Total policies: ${policies.length}

BEGIN;

`;

    const policiesByTable: Record<string, any[]> = {};
    for (const policy of policies) {
      if (!policiesByTable[policy.tablename]) {
        policiesByTable[policy.tablename] = [];
      }
      policiesByTable[policy.tablename].push(policy);
    }

    for (const [table, tablePolicies] of Object.entries(policiesByTable)) {
      rlsSQL += `-- ${table} table policies\n`;
      rlsSQL += `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;\n\n`;

      for (const policy of tablePolicies) {
        const cmd = policy.cmd;
        const policyName = policy.policyname;
        const using = policy.qual || 'true';
        const withCheck = policy.with_check;

        rlsSQL += `DROP POLICY IF EXISTS "${policyName}" ON ${table};\n`;
        rlsSQL += `CREATE POLICY "${policyName}" ON ${table}\n`;
        rlsSQL += `FOR ${cmd} `;

        if (policy.roles && policy.roles !== '{public}') {
          rlsSQL += `TO ${policy.roles.replace(/{|}/g, '')} `;
        }

        rlsSQL += `USING (${using})`;

        if (withCheck && withCheck !== using) {
          rlsSQL += `\nWITH CHECK (${withCheck})`;
        }

        rlsSQL += `;\n\n`;
      }
      rlsSQL += '\n';
    }

    rlsSQL += 'COMMIT;\n';

    const rlsFilePath = join(MIGRATIONS_DIR, 'EXTRACTED_rls_policies.sql');
    writeFileSync(rlsFilePath, rlsSQL, 'utf-8');
    console.log(`📝 Wrote RLS policies to: ${rlsFilePath}\n`);
  }

  // Extract functions
  console.log('🔧 Extracting database functions...');
  const { data: functions, error: functionsError } = await supabase.rpc('run_sql', {
    query: `
      SELECT
        n.nspname as schema_name,
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      ORDER BY p.proname;
    `
  }) as any;

  if (functionsError) {
    console.error('⚠️  Could not extract functions via RPC');
    console.error('   Error:', functionsError.message);
  } else if (functions) {
    console.log(`✅ Found ${functions.length} functions\n`);

    let functionsSQL = `-- Extracted Database Functions from Cloud Supabase
-- Date: ${new Date().toISOString()}
-- Total functions: ${functions.length}

BEGIN;

`;

    for (const func of functions) {
      functionsSQL += `-- Function: ${func.function_name}\n`;
      functionsSQL += `${func.definition};\n\n`;
    }

    functionsSQL += 'COMMIT;\n';

    const functionsFilePath = join(MIGRATIONS_DIR, 'EXTRACTED_functions.sql');
    writeFileSync(functionsFilePath, functionsSQL, 'utf-8');
    console.log(`📝 Wrote functions to: ${functionsFilePath}\n`);
  }

  // Extract views
  console.log('👁️  Extracting database views...');
  const { data: views, error: viewsError } = await supabase.rpc('run_sql', {
    query: `
      SELECT
        schemaname,
        viewname,
        definition
      FROM pg_views
      WHERE schemaname = 'public'
      ORDER BY viewname;
    `
  }) as any;

  if (viewsError) {
    console.error('⚠️  Could not extract views via RPC');
    console.error('   Error:', viewsError.message);
  } else if (views) {
    console.log(`✅ Found ${views.length} views\n`);

    let viewsSQL = `-- Extracted Database Views from Cloud Supabase
-- Date: ${new Date().toISOString()}
-- Total views: ${views.length}

BEGIN;

`;

    for (const view of views) {
      viewsSQL += `-- View: ${view.viewname}\n`;
      viewsSQL += `CREATE OR REPLACE VIEW ${view.viewname} AS\n`;
      viewsSQL += `${view.definition};\n\n`;
    }

    viewsSQL += 'COMMIT;\n';

    const viewsFilePath = join(MIGRATIONS_DIR, 'EXTRACTED_views.sql');
    writeFileSync(viewsFilePath, viewsSQL, 'utf-8');
    console.log(`📝 Wrote views to: ${viewsFilePath}\n`);
  }

  // Get table list
  console.log('📊 Extracting table list...');
  const { data: tables, error: tablesError } = await supabase.rpc('run_sql', {
    query: `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `
  }) as any;

  if (!tablesError && tables) {
    console.log(`✅ Found ${tables.length} tables\n`);
    console.log('Tables:');
    for (const table of tables) {
      console.log(`  - ${table.tablename}`);
    }
  }

  console.log('\n✅ Extraction complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Review the EXTRACTED_*.sql files in supabase/migrations/');
  console.log('   2. Use these as reference to create the fixed migration files');
  console.log('   3. Apply RLS security fixes (SECURITY DEFINER, remove duplicates, etc.)');
}

extractSchema().catch((error) => {
  console.error('❌ Extraction failed:', error);
  process.exit(1);
});
