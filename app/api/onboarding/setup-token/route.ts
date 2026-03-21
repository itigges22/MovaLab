import { NextRequest, NextResponse } from 'next/server';
import { isFirstRun, createSetupToken, validateSetupToken } from '@/lib/onboarding/setup-token';

// GET - Check if first run + generate token
export async function GET() {
  const firstRun = await isFirstRun();
  if (!firstRun) {
    return NextResponse.json({ firstRun: false, message: 'Platform already has users.' });
  }

  const token = await createSetupToken();
  if (!token) {
    return NextResponse.json({
      error: 'Failed to generate setup token. Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local',
      hint: 'Check that your .env.local file has the SUPABASE_SERVICE_ROLE_KEY from your Supabase config.'
    }, { status: 500 });
  }

  // Log token to server console (uses console.warn so it survives production mode)
  console.warn('\n========================================');
  console.warn('SUPERADMIN SETUP TOKEN');
  console.warn(`   Token: ${token}`);
  console.warn('   Expires in 15 minutes');
  console.warn('   Enter this token at the setup screen');
  console.warn('========================================\n');

  return NextResponse.json({ firstRun: true, tokenGenerated: true });
}

// POST - Validate a token
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const valid = await validateSetupToken(body.token);
  return NextResponse.json({ valid });
}
