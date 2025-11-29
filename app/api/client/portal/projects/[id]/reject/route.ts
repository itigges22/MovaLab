import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { clientRejectProject } from '@/lib/client-portal-service';
import { z } from 'zod';
import { validateRequestBody } from '@/lib/validation-schemas';

const rejectProjectSchema = z.object({
  workflow_instance_id: z.string().uuid('Invalid workflow instance ID'),
  notes: z.string().max(2000, 'Notes too long'),
  issues: z.array(z.string()).optional()
});

// POST /api/client/portal/projects/[id]/reject - Reject project at workflow approval node
export async function POST(
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

    // Check CLIENT_APPROVE_PROJECTS permission
    const canApprove = await hasPermission(userProfile, Permission.CLIENT_APPROVE_PROJECTS, undefined, supabase);
    if (!canApprove) {
      return NextResponse.json({ error: 'Insufficient permissions to approve/reject projects' }, { status: 403 });
    }

    // Verify user is a client
    if (!userProfile.is_client) {
      return NextResponse.json({ error: 'Access denied. This endpoint is for client users only.' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(rejectProjectSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Reject project
    const result = await clientRejectProject({
      projectId: id,
      workflowInstanceId: validation.data.workflow_instance_id,
      clientUserId: user.id,
      notes: validation.data.notes,
      issues: validation.data.issues || []
    });

    return NextResponse.json({
      ...result,
      message: 'Project rejected. Issues have been logged.'
    }, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/client/portal/projects/[id]/reject:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
