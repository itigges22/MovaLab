-- Drop the broken trigger on project_issues
-- The table doesn't have an updated_at column but the trigger tries to set NEW.updated_at
DROP TRIGGER IF EXISTS update_project_issues_updated_at ON public.project_issues;
