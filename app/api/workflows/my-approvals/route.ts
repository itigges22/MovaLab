import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { getUserPendingApprovals } from '@/lib/workflow-execution-service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is superadmin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('is_superadmin')
      .eq('id', user.id)
      .single();

    const isSuperadmin = userProfile?.is_superadmin === true;

    let approvals: any[] = [];

    if (isSuperadmin) {
      // Superadmins see ALL pending approvals across all users
      // Query workflow_active_steps to support parallel workflows
      // Use explicit foreign key hints for PostgREST
      const { data: activeSteps, error } = await supabase
        .from('workflow_active_steps')
        .select(`
          id,
          workflow_instance_id,
          node_id,
          status,
          activated_at,
          workflow_nodes:workflow_active_steps_node_id_fkey!inner(
            id,
            label,
            node_type,
            entity_id
          ),
          workflow_instances:workflow_active_steps_workflow_instance_id_fkey!inner(
            id,
            status,
            project_id,
            workflow_template_id,
            current_node_id,
            projects:workflow_instances_project_id_fkey!inner(
              id,
              name,
              description,
              status,
              priority,
              account_id,
              accounts(id, name)
            )
          )
        `)
        .eq('status', 'active');

      if (!error && activeSteps) {
        // Filter to only approval/form nodes in active workflow instances
        const filteredSteps = activeSteps.filter((step: any) => {
          const node = step.workflow_nodes;
          const instance = step.workflow_instances;
          if (!node || !instance) return false;
          if (instance.status !== 'active') return false;
          return ['approval', 'form'].includes(node.node_type);
        });

        // Transform to match expected format
        approvals = filteredSteps.map((step: any) => ({
          ...step.workflow_instances,
          workflow_nodes: step.workflow_nodes,
          projects: step.workflow_instances.projects,
          active_step_id: step.id,
          current_node_id: step.node_id
        }));
      }
    } else {
      // Regular users see only their pending approvals based on role
      approvals = await getUserPendingApprovals(supabase, user.id);
    }

    return NextResponse.json({
      success: true,
      approvals,
    });
  } catch (error) {
    console.error('Error in GET /api/workflows/my-approvals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
