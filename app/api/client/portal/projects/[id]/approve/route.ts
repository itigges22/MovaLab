import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { clientApproveProject } from '@/lib/client-portal-service';
import { z } from 'zod';
import { validateRequestBody } from '@/lib/validation-schemas';

const approveProjectSchema = z.object({
  workflow_instance_id: z.string().uuid('Invalid workflow instance ID'),
  notes: z.string().max(2000, 'Notes too long').optional()
});

// POST /api/client/portal/projects/[id]/approve - Approve project at workflow approval node
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

    // Get user profile
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user is a client (hardcoded check - client approval permissions are implicit)
    if (!userProfile.is_client) {
      return NextResponse.json({ error: 'Access denied. This endpoint is for client users only.' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(approveProjectSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Approve project
    const result = await clientApproveProject({
      projectId: id,
      workflowInstanceId: validation.data.workflow_instance_id,
      clientUserId: (user as any).id,
      notes: validation.data.notes || null
    });

    return NextResponse.json({
      ...result,
      message: 'Project approved successfully'
    }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in POST /api/client/portal/projects/[id]/approve:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
