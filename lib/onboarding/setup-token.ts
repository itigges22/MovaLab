import { createAdminSupabaseClient } from '@/lib/supabase-server';
import crypto from 'crypto';

// Generate a cryptographically secure setup token
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Check if this is a first run (no user_profiles exist)
export async function isFirstRun(): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;
  const { count } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
  return (count ?? 0) === 0;
}

// Create a new setup token (15 minute expiry)
export async function createSetupToken(): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase.from('setup_tokens').insert({
    token,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('Failed to create setup token:', error);
    return null;
  }

  return token;
}

// Validate a token (exists, not expired, not used)
export async function validateSetupToken(token: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from('setup_tokens')
    .select('id, expires_at, used_at')
    .eq('token', token)
    .single();

  if (!data) return false;
  if (data.used_at) return false;
  if (new Date(data.expires_at) < new Date()) return false;

  return true;
}

// Consume a token (mark as used)
export async function consumeSetupToken(token: string, userId: string): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from('setup_tokens')
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq('token', token)
    .is('used_at', null);

  return !error;
}
