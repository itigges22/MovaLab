import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthentication, handleGuardError } from '@/lib/server-guards';
import { logger } from '@/lib/debug-logger';

/**
 * GET /api/profile
 * Get current user's profile
 * All authenticated users can view their own profile, regardless of role
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication only - all users should be able to view their own profile
    const userProfile = await requireAuthentication(request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'getProfile' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Fetch user profile (include client-specific fields)
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, name, email, bio, skills, image, is_client, client_account_id, client_contact_name, client_company_position, created_at, updated_at')
      .eq('id', userProfile.id)
      .single();

    if (error) {
      logger.error('Error fetching profile', { action: 'getProfile', userId: userProfile.id }, error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error: unknown) {
    return handleGuardError(error);
  }
}

/**
 * PATCH /api/profile
 * Update current user's profile
 * All authenticated users can edit their own profile, regardless of role
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication only - all users should be able to edit their own profile
    const userProfile = await requireAuthentication(request);

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'updateProfile' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { name, bio, skills, client_company_position } = body;

    // Validate that user can only update their own profile
    if (body.id && body.id !== userProfile.id) {
      logger.warn('User attempted to update another user\'s profile', {
        action: 'updateProfile',
        userId: userProfile.id,
        attemptedId: body.id
      });
      return NextResponse.json(
        { error: 'You can only update your own profile' },
        { status: 403 }
      );
    }

    // Input validation
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
      }
      if (name.length > 200) {
        return NextResponse.json({ error: 'Name must be 200 characters or less' }, { status: 400 });
      }
    }
    if (bio !== undefined && bio !== null) {
      if (typeof bio !== 'string') {
        return NextResponse.json({ error: 'Bio must be a string' }, { status: 400 });
      }
      if (bio.length > 2000) {
        return NextResponse.json({ error: 'Bio must be 2000 characters or less' }, { status: 400 });
      }
    }
    if (skills !== undefined && skills !== null) {
      if (!Array.isArray(skills) || !skills.every((s: unknown) => typeof s === 'string')) {
        return NextResponse.json({ error: 'Skills must be an array of strings' }, { status: 400 });
      }
      if (skills.length > 50) {
        return NextResponse.json({ error: 'Maximum 50 skills allowed' }, { status: 400 });
      }
    }
    if (client_company_position !== undefined && client_company_position !== null) {
      if (typeof client_company_position !== 'string') {
        return NextResponse.json({ error: 'Company position must be a string' }, { status: 400 });
      }
      if (client_company_position.length > 200) {
        return NextResponse.json({ error: 'Company position must be 200 characters or less' }, { status: 400 });
      }
    }

    // Prepare update data (only whitelisted fields)
    const updateData: {
      name?: string;
      bio?: string;
      skills?: string[];
      client_company_position?: string | null;
      updated_at: string;
    } = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = skills;
    if (client_company_position !== undefined) updateData.client_company_position = client_company_position;

    logger.info('Updating user profile', {
      action: 'updateProfile',
      userId: userProfile.id,
      fields: Object.keys(updateData)
    });

    // Update the profile
    const { data: updatedProfile, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userProfile.id)
      .select('id, name, email, bio, skills, image, is_client, client_account_id, client_contact_name, client_company_position, created_at, updated_at')
      .single();

    if (error) {
      logger.error('Error updating profile', { action: 'updateProfile', userId: userProfile.id }, error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    logger.info('Profile updated successfully', {
      action: 'updateProfile',
      userId: userProfile.id
    });

    return NextResponse.json({ profile: updatedProfile });
  } catch (error: unknown) {
    return handleGuardError(error);
  }
}

