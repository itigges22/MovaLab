import { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase-server';

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
  const { projectId } = await params;
  const supabase = await createServerSupabase();
  if (!supabase) return { title: 'Project' };

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .single();

  return {
    title: project?.name || 'Project',
  };
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
