import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { isAdminLevel } from '@/lib/rbac';
import DepartmentAdminTabs from '@/components/department-admin-tabs';

interface DepartmentAdminPageProps {
  params: Promise<{
    departmentId: string;
  }>;
}

export default async function DepartmentAdminPage({ params }: DepartmentAdminPageProps) {
  // Await params for Next.js 15 compatibility
  const { departmentId } = await params;
  
  const supabase = await createServerSupabase();
  if (!supabase) {
    redirect('/login');
  }

  // Get current user and check permissions
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    redirect('/login');
  }

  // Get user profile with roles (must include is_superadmin and role permissions)
  const { data: userProfile, error: profileError } = await supabase
    .from('user_profiles')
    .select(`
      *,
      user_roles!user_roles_user_id_fkey (
        id,
        role_id,
        roles!user_roles_role_id_fkey (
          id,
          name,
          department_id,
          permissions,
          is_system_role,
          departments!roles_department_id_fkey (
            id,
            name
          )
        )
      )
    `)
    .eq('id', (user as any).id)
    .single();

  if (profileError || !userProfile) {
    redirect('/login');
  }

  // Check if user has admin privileges
  const hasAdminPrivileges = await isAdminLevel(userProfile as unknown as import('@/lib/rbac-types').UserWithRoles);

  if (!hasAdminPrivileges) {
    redirect('/departments');
  }

  // Get department details
  const { data: department, error: departmentError } = await supabase
    .from('departments')
    .select('*')
    .eq('id', departmentId)
    .single();

  if (departmentError || !department) {
    redirect('/departments');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{department.name} Administration</h1>
        <p className="text-muted-foreground">
          Manage roles, team settings, and department configuration
        </p>
      </div>

      <DepartmentAdminTabs departmentId={departmentId} />
    </div>
  );
}
