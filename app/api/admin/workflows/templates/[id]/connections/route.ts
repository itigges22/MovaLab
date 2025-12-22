import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { createWorkflowConnection } from '@/lib/workflow-service';
import { validateRequestBody, createWorkflowConnectionSchema } from '@/lib/validation-schemas';

// POST /api/admin/workflows/templates/[id]/connections - Create workflow connection
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
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Check MANAGE_WORKFLOWS permission
    const canManage = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(createWorkflowConnectionSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Create connection
    const connection = await createWorkflowConnection(
      id,
      validation.data.from_node_id,
      validation.data.to_node_id,
      validation.data.condition
    );

    return NextResponse.json({ success: true, connection }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error in POST /api/admin/workflows/templates/[id]/connections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
