import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { getClientProjectById } from '@/lib/client-portal-service';
import { logger } from '@/lib/debug-logger';

// GET /api/client/portal/projects/[id] - Get project details with workflow status, team, updates
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with roles
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey (
          roles (
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Phase 9: Client permissions are hardcoded - verify user is a client with account access
    if (!userProfile.is_client || !userProfile.client_account_id) {
      return NextResponse.json({ error: 'Client access required' }, { status: 403 });
    }

    // Get project details
    const project = await getClientProjectById(user.id, id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Fetch additional data in parallel using the authenticated client's supabase
    // (NOT createServerSupabase which may lack the client user's RLS context)
    const db = supabase;

    const [teamResult, updatesResult, workflowNodesResult, workflowHistoryResult] = await Promise.all([
      // Team members: project assignments with user profile info
      db
        .from('project_assignments')
        .select('id, role_in_project, user_profiles!project_assignments_user_id_fkey(id, name, email, image)')
        .eq('project_id', id)
        .is('removed_at', null),

      // Project updates (read-only timeline)
      db
        .from('project_updates')
        .select('id, content, created_at, user_profiles!project_updates_created_by_fkey(id, name)')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(50),

      // All workflow nodes for the template (for the step visualization)
      project.workflow_instance?.workflow_templates?.id
        ? db
            .from('workflow_nodes')
            .select('id, node_type, label, position_x, position_y')
            .eq('workflow_template_id', project.workflow_instance.workflow_templates.id)
            .order('position_x', { ascending: true })
        : Promise.resolve({ data: null, error: null }),

      // Workflow history (to determine completed node IDs)
      project.workflow_instance?.id
        ? db
            .from('workflow_history')
            .select('id, from_node_id, to_node_id, created_at, transition_type')
            .eq('workflow_instance_id', project.workflow_instance.id)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Compute completed node IDs from workflow history
    const completedNodeIds: string[] = [];
    if (workflowHistoryResult.data && workflowHistoryResult.data.length > 0) {
      const seen = new Set<string>();
      for (const h of workflowHistoryResult.data) {
        if (h.from_node_id) seen.add(h.from_node_id);
      }
      completedNodeIds.push(...Array.from(seen));
    }

    // Normalize team data (Supabase may return user_profiles as array or object)
    const team = (teamResult.data || []).map((a: Record<string, unknown>) => {
      const profile = Array.isArray(a.user_profiles) ? a.user_profiles[0] : a.user_profiles;
      return {
        id: a.id,
        role_in_project: a.role_in_project,
        user: profile || null,
      };
    });

    // Normalize updates data
    const updates = (updatesResult.data || []).map((u: Record<string, unknown>) => {
      const author = Array.isArray(u.user_profiles) ? u.user_profiles[0] : u.user_profiles;
      return {
        id: u.id,
        content: u.content,
        created_at: u.created_at,
        author: author || null,
      };
    });

    return NextResponse.json({
      success: true,
      project,
      team,
      updates,
      workflow_nodes: workflowNodesResult.data || [],
      completed_node_ids: completedNodeIds,
    }, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error in GET /api/client/portal/projects/[id]', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
