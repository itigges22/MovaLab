import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { acceptClientInvitation } from '@/lib/client-portal-service';
import { validateRequestBody, acceptClientInvitationSchema } from '@/lib/validation-schemas';

// POST /api/client/accept-invite/[token] - Accept client invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  
  try {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const validation = validateRequestBody(acceptClientInvitationSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Accept invitation
    await acceptClientInvitation({
      token: token,
      userId: user.id,
      name: validation.data.name,
      companyPosition: validation.data.company_position
    });

    return NextResponse.json({
      success: true,
      message: 'Client invitation accepted successfully. You now have access to the client portal.'
    }, { status: 200 });
  } catch (error) {
    console.error('Error in POST /api/client/accept-invite/[token]:', error);

    // Check if error is due to invalid/expired token
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        error: 'Invalid or expired invitation token'
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
