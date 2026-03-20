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
    return NextResponse.json({ error: 'Failed to generate setup token' }, { status: 500 });
  }

  // Log token to server console (admin sees this in VPS terminal)
  console.log('\n========================================');
  console.log('SUPERADMIN SETUP TOKEN');
  console.log(`   Token: ${token}`);
  console.log('   Expires in 15 minutes');
  console.log('   Enter this token at the setup screen');
  console.log('========================================\n');

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
