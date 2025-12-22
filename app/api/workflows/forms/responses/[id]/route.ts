import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getFormResponseById } from '@/lib/form-service';
import { verifyFormResponseAccess } from '@/lib/access-control-server';

// GET /api/workflows/forms/responses/[id] - Get form response by ID
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
      .eq('id', (user as any).id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Phase 9: Forms are inline-only in workflows, check workflow permissions instead
    const canViewWorkflow = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, supabase) ||
                            await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, supabase);
    if (!canViewWorkflow) {
      return NextResponse.json({ error: 'Insufficient permissions to view workflow forms' }, { status: 403 });
    }

    // Verify user has access to the form response (and its workflow if linked)
    const accessCheck = await verifyFormResponseAccess(supabase, (user as any).id, id);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({
        error: accessCheck.error || 'You do not have access to this form response'
      }, { status: 403 });
    }

    // Get form response
    const response = await getFormResponseById(id);

    if (!response) {
      return NextResponse.json({ error: 'Form response not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, response }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error in GET /api/workflows/forms/responses/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
