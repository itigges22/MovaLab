-- Fix workflow_instances INSERT RLS to also allow users with manage_all_projects
-- The previous policy blocked users with VIEW_ALL_PROJECTS/MANAGE_ALL_PROJECTS
-- from starting workflows on projects they can see but aren't directly assigned to.

DROP POLICY IF EXISTS "workflow_instances_insert" ON public.workflow_instances;

CREATE POLICY "workflow_instances_insert" ON public.workflow_instances
FOR INSERT WITH CHECK (
  public.user_is_superadmin()
  OR public.user_has_permission('execute_any_workflow'::text)
  OR public.user_has_permission('manage_all_workflows'::text)
  OR (
    public.user_has_permission('execute_workflows'::text)
    AND (
      public.user_can_start_project_workflow(project_id)
      OR public.user_has_permission('manage_all_projects'::text)
      OR public.user_has_permission('view_all_projects'::text)
    )
  )
);
