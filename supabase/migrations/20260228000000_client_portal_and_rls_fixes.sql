-- Migration: Add client portal columns and fix missing RLS policies
-- Date: 2026-02-28
-- Description:
--   1. Add client portal columns to user_profiles (is_client, client_account_id, etc.)
--   2. Enable RLS on deliverables table
--   3. Enable RLS on task_dependencies table
--   4. Enable RLS on task_week_allocations table
--   5. Add display_order column to tasks for Kanban ordering

-- ============================================================================
-- 1. CLIENT PORTAL: Add missing columns to user_profiles
-- ============================================================================
ALTER TABLE "public"."user_profiles"
  ADD COLUMN IF NOT EXISTS "is_client" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "client_account_id" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "client_contact_name" text,
  ADD COLUMN IF NOT EXISTS "client_company_position" text;

-- Index for quick client lookups
CREATE INDEX IF NOT EXISTS "idx_user_profiles_is_client" ON "public"."user_profiles" ("is_client") WHERE "is_client" = true;
CREATE INDEX IF NOT EXISTS "idx_user_profiles_client_account_id" ON "public"."user_profiles" ("client_account_id") WHERE "client_account_id" IS NOT NULL;

-- ============================================================================
-- 2. DELIVERABLES: Enable RLS
-- ============================================================================
ALTER TABLE "public"."deliverables" ENABLE ROW LEVEL SECURITY;

-- Users can view deliverables for projects they have access to
CREATE POLICY "Users can view deliverables for their projects" ON "public"."deliverables"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
    OR EXISTS (
      SELECT 1 FROM "public"."project_assignments"
      WHERE "project_id" = "deliverables"."project_id"
        AND "user_id" = auth.uid()
        AND "removed_at" IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM "public"."projects"
      WHERE "id" = "deliverables"."project_id"
        AND ("created_by" = auth.uid() OR "assigned_user_id" = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM "public"."projects" p
      JOIN "public"."accounts" a ON a."id" = p."account_id"
      WHERE p."id" = "deliverables"."project_id"
        AND a."account_manager_id" = auth.uid()
    )
  );

-- Users can create deliverables in their projects
CREATE POLICY "Users can create deliverables in their projects" ON "public"."deliverables"
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."project_assignments"
      WHERE "project_id" = "deliverables"."project_id"
        AND "user_id" = auth.uid()
        AND "removed_at" IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM "public"."projects"
      WHERE "id" = "deliverables"."project_id"
        AND ("created_by" = auth.uid() OR "assigned_user_id" = auth.uid())
    )
  );

-- Users can update deliverables they submitted or are assigned to review
CREATE POLICY "Users can update their deliverables" ON "public"."deliverables"
  FOR UPDATE USING (
    "submitted_by" = auth.uid()
    OR "approved_by" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
  );

-- Only submitters or superadmins can delete deliverables
CREATE POLICY "Users can delete their own deliverables" ON "public"."deliverables"
  FOR DELETE USING (
    "submitted_by" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
  );

-- ============================================================================
-- 3. TASK DEPENDENCIES: Enable RLS
-- ============================================================================
ALTER TABLE "public"."task_dependencies" ENABLE ROW LEVEL SECURITY;

-- Users can view dependencies for tasks in their projects
CREATE POLICY "Users can view task dependencies" ON "public"."task_dependencies"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
    OR EXISTS (
      SELECT 1 FROM "public"."tasks" t
      JOIN "public"."project_assignments" pa ON pa."project_id" = t."project_id"
      WHERE t."id" = "task_dependencies"."task_id"
        AND pa."user_id" = auth.uid()
        AND pa."removed_at" IS NULL
    )
  );

-- Users can manage dependencies for tasks in their projects
CREATE POLICY "Users can manage task dependencies" ON "public"."task_dependencies"
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
    OR EXISTS (
      SELECT 1 FROM "public"."tasks" t
      JOIN "public"."project_assignments" pa ON pa."project_id" = t."project_id"
      WHERE t."id" = "task_dependencies"."task_id"
        AND pa."user_id" = auth.uid()
        AND pa."removed_at" IS NULL
    )
  );

-- ============================================================================
-- 4. TASK WEEK ALLOCATIONS: Enable RLS
-- ============================================================================
ALTER TABLE "public"."task_week_allocations" ENABLE ROW LEVEL SECURITY;

-- Users can view allocations for their tasks or tasks in their projects
CREATE POLICY "Users can view task allocations" ON "public"."task_week_allocations"
  FOR SELECT USING (
    "assigned_user_id" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
    OR EXISTS (
      SELECT 1 FROM "public"."tasks" t
      JOIN "public"."project_assignments" pa ON pa."project_id" = t."project_id"
      WHERE t."id" = "task_week_allocations"."task_id"
        AND pa."user_id" = auth.uid()
        AND pa."removed_at" IS NULL
    )
  );

-- Users can manage their own allocations or allocations in their projects
CREATE POLICY "Users can manage task allocations" ON "public"."task_week_allocations"
  FOR ALL USING (
    "assigned_user_id" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
  );

-- ============================================================================
-- 5. TASKS: Add display_order for Kanban ordering persistence
-- ============================================================================
ALTER TABLE "public"."tasks"
  ADD COLUMN IF NOT EXISTS "display_order" integer DEFAULT 0;

-- Index for efficient ordering within project + status
CREATE INDEX IF NOT EXISTS "idx_tasks_display_order" ON "public"."tasks" ("project_id", "status", "display_order");
