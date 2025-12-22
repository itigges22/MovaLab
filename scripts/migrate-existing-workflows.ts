 

/**
 * Migration Script: Create Active Steps for Existing Workflows
 *
 * This script migrates existing in-progress workflow instances to use the new
 * workflow_active_steps table for parallel workflow support.
 *
 * Run with: npx tsx scripts/migrate-existing-workflows.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function migrateExistingWorkflows() {
  console.log('Starting workflow migration...\n');

  // Step 1: Find all active workflow instances that don't have any active_steps
  const { data: activeInstances, error: instancesError } = await supabase
    .from('workflow_instances')
    .select(`
      id,
      workflow_template_id,
      current_node_id,
      project_id,
      status,
      has_parallel_paths
    `)
    .eq('status', 'active')
    .not('current_node_id', 'is', null);

  if (instancesError) {
    console.error('Error fetching workflow instances:', instancesError);
    process.exit(1);
  }

  console.log(`Found ${activeInstances?.length || 0} active workflow instances\n`);

  if (!activeInstances || activeInstances.length === 0) {
    console.log('No active workflows to migrate.');
    return;
  }

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const instance of activeInstances) {
    console.log(`Processing workflow instance: ${instance.id}`);

    // Check if this instance already has active steps
    const { data: existingSteps, error: stepsError } = await supabase
      .from('workflow_active_steps')
      .select('id')
      .eq('workflow_instance_id', instance.id)
      .in('status', ['active', 'waiting']);

    if (stepsError) {
      console.error(`  Error checking existing steps: ${stepsError.message}`);
      errorCount++;
      continue;
    }

    if (existingSteps && existingSteps.length > 0) {
      console.log(`  Skipping - already has ${existingSteps.length} active/waiting step(s)`);
      skippedCount++;
      continue;
    }

    // Get the current node to find assigned user from history
    const { data: latestHistory, error: _historyError } = await supabase
      .from('workflow_history')
      .select('assigned_user_id, acted_by_user_id')
      .eq('workflow_instance_id', instance.id)
      .eq('to_node_id', instance.current_node_id)
      .order('handed_off_at', { ascending: false })
      .limit(1);

    let assignedUserId = null;
    if (latestHistory && latestHistory.length > 0) {
      assignedUserId = latestHistory[0].assigned_user_id;
    }

    // Create an active step for this workflow
    const newActiveStep = {
      id: uuidv4(),
      workflow_instance_id: instance.id,
      node_id: instance.current_node_id,
      branch_id: 'main', // Default branch for existing workflows
      status: 'active',
      assigned_user_id: assignedUserId,
      activated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('workflow_active_steps')
      .insert(newActiveStep);

    if (insertError) {
      console.error(`  Error creating active step: ${insertError.message}`);
      errorCount++;
      continue;
    }

    console.log(`  Created active step at node: ${instance.current_node_id}`);
    migratedCount++;
  }

  console.log('\n--- Migration Summary ---');
  console.log(`Total instances processed: ${activeInstances.length}`);
  console.log(`Successfully migrated: ${migratedCount}`);
  console.log(`Skipped (already migrated): ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('\nMigration complete!');
}

// Run the migration
migrateExistingWorkflows().catch(console.error);
