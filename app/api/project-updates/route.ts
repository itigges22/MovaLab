import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase-server';
import { requireAuthentication, handleGuardError } from '@/lib/server-guards';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { logger } from '@/lib/debug-logger';

export async function GET(request: NextRequest) {
  try {
    // Check authentication - return empty array if not authenticated instead of throwing
    let userProfile;
    try {
      userProfile = await requireAuthentication(request);
    } catch (_error: unknown) {
      logger.debug('User not authenticated, returning empty project updates', { action: 'getProjectUpdates' });
      return NextResponse.json([]);
    }

    if (!userProfile) {
      logger.debug('User profile is null, returning empty project updates', { action: 'getProjectUpdates' });
      return NextResponse.json([]);
    }

    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
      logger.error('Supabase not configured', { action: 'getProjectUpdates' });
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const userId = userProfile.id;

    // Phase 10: Use project access pattern instead of deprecated VIEW_UPDATES/VIEW_ALL_UPDATES
    // Superadmins and users with VIEW_ALL_PROJECTS see all updates; others see updates for accessible projects
    const isSuperadmin = userProfile.is_superadmin;
    const hasViewAll = !isSuperadmin && await hasPermission(userProfile, Permission.VIEW_ALL_PROJECTS, undefined, supabase);

    // Build query
    let query = supabase
      .from('project_updates')
      .select(`
        id,
        project_id,
        content,
        created_by,
        workflow_history_id,
        created_at,
        updated_at,
        user_profiles:created_by(id, name, email, image),
        projects:project_id(
          id,
          name,
          status,
          priority,
          accounts:account_id(id, name)
        )
      `);

    // Superadmins and VIEW_ALL_PROJECTS users see all updates
    if (isSuperadmin || hasViewAll) {
      logger.debug('User has global project access, returning all updates', { userId });
    } else {
      // Filter to projects user has access to (same logic as userHasProjectAccess)
      logger.debug('Filtering project updates to accessible projects', { userId });

      const [
        { data: assignedProjects },
        { data: directProjects },
        { data: accountProjects }
      ] = await Promise.all([
        supabase
          .from('project_assignments')
          .select('project_id')
          .eq('user_id', userId)
          .is('removed_at', null),
        supabase
          .from('projects')
          .select('id')
          .or(`created_by.eq.${userId},assigned_user_id.eq.${userId}`),
        supabase
          .from('account_members')
          .select('account:accounts!inner(projects(id))')
          .eq('user_id', userId)
      ]);

      const projectIds = new Set<string>();
      assignedProjects?.forEach((ap: any) => projectIds.add(ap.project_id));
      directProjects?.forEach((p: { id: string }) => projectIds.add(p.id));
      (accountProjects as unknown as { account?: { projects?: { id: string }[] } }[] | null)?.forEach((am: { account?: { projects?: { id: string }[] } }) => {
        am.account?.projects?.forEach((p: { id: string }) => projectIds.add(p.id));
      });

      if (projectIds.size > 0) {
        query = query.in('project_id', Array.from(projectIds));
      } else {
        query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
      }
    }

    // Execute query
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Error fetching project updates', { 
        action: 'getProjectUpdates', 
        userId,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details
      }, error);
      return NextResponse.json({
        error: 'Failed to fetch project updates'
      }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: unknown) {
logger.error('Unexpected error in project-updates API', {
      action: 'getProjectUpdates',
      errorMessage: error instanceof Error ? error.message : String(error)
    }, error instanceof Error ? error : new Error(String(error)));
    return handleGuardError(error);
  }
}

