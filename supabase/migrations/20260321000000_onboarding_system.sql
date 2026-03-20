-- Migration: Onboarding System
-- Date: 2026-03-21
-- Description:
--   1. Create setup_tokens table for one-time superadmin initialization
--   2. Create onboarding_state table for tutorial progress tracking
--   3. Create user_invitations table for invitation tracking
--   4. Add onboarding columns to user_profiles

-- ============================================================================
-- 1. SETUP TOKENS: One-time tokens for superadmin initialization
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."setup_tokens" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "setup_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "setup_tokens_token_key" UNIQUE ("token"),
    CONSTRAINT "setup_tokens_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."user_profiles"("id")
);

ALTER TABLE "public"."setup_tokens" OWNER TO "postgres";

ALTER TABLE "public"."setup_tokens" ENABLE ROW LEVEL SECURITY;

-- Service role only — no direct user access
CREATE POLICY "setup_tokens_service_role_only"
  ON "public"."setup_tokens"
  FOR ALL
  USING (false);

COMMENT ON TABLE "public"."setup_tokens" IS 'One-time tokens for superadmin initialization during first-run setup.';

-- ============================================================================
-- 2. ONBOARDING STATE: Tutorial progress tracking per user
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."onboarding_state" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tutorial_completed" boolean DEFAULT false NOT NULL,
    "tutorial_step" integer DEFAULT 0 NOT NULL,
    "tutorial_data" "jsonb" DEFAULT '{}'::jsonb NOT NULL,
    "setup_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "onboarding_state_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "onboarding_state_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "onboarding_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."onboarding_state" OWNER TO "postgres";

ALTER TABLE "public"."onboarding_state" ENABLE ROW LEVEL SECURITY;

-- Users can read their own onboarding state
CREATE POLICY "onboarding_state_select_own"
  ON "public"."onboarding_state"
  FOR SELECT
  USING (auth.uid() = "user_id");

-- Users can update their own onboarding state
CREATE POLICY "onboarding_state_update_own"
  ON "public"."onboarding_state"
  FOR UPDATE
  USING (auth.uid() = "user_id");

-- Service role can insert (created during signup/invitation flow)
CREATE POLICY "onboarding_state_insert_service"
  ON "public"."onboarding_state"
  FOR INSERT
  WITH CHECK (true);

-- Auto-update updated_at
CREATE TRIGGER "onboarding_state_updated_at"
  BEFORE UPDATE ON "public"."onboarding_state"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_updated_at_column"();

COMMENT ON TABLE "public"."onboarding_state" IS 'Tracks tutorial progress and onboarding completion per user.';

-- ============================================================================
-- 3. USER INVITATIONS: Invitation tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."user_invitations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "department_id" "uuid",
    "invited_by" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_invitations_token_key" UNIQUE ("token"),
    CONSTRAINT "user_invitations_status_check" CHECK ("status" IN ('pending', 'accepted', 'expired', 'revoked')),
    CONSTRAINT "user_invitations_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id"),
    CONSTRAINT "user_invitations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id"),
    CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id")
);

ALTER TABLE "public"."user_invitations" OWNER TO "postgres";

ALTER TABLE "public"."user_invitations" ENABLE ROW LEVEL SECURITY;

-- Admins (superadmin or manage_user_roles permission) can view invitations
CREATE POLICY "user_invitations_select_admin"
  ON "public"."user_invitations"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
    OR EXISTS (
      SELECT 1 FROM "public"."user_roles" ur
      JOIN "public"."roles" r ON r."id" = ur."role_id"
      WHERE ur."user_id" = auth.uid()
      AND (r."permissions"->>'manage_user_roles')::boolean = true
    )
  );

-- Admins can create invitations
CREATE POLICY "user_invitations_insert_admin"
  ON "public"."user_invitations"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
    OR EXISTS (
      SELECT 1 FROM "public"."user_roles" ur
      JOIN "public"."roles" r ON r."id" = ur."role_id"
      WHERE ur."user_id" = auth.uid()
      AND (r."permissions"->>'manage_user_roles')::boolean = true
    )
  );

-- Admins can update invitations (revoke, etc.)
CREATE POLICY "user_invitations_update_admin"
  ON "public"."user_invitations"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."user_profiles"
      WHERE "id" = auth.uid() AND "is_superadmin" = true
    )
    OR EXISTS (
      SELECT 1 FROM "public"."user_roles" ur
      JOIN "public"."roles" r ON r."id" = ur."role_id"
      WHERE ur."user_id" = auth.uid()
      AND (r."permissions"->>'manage_user_roles')::boolean = true
    )
  );

-- Index for fast token lookups (invitation acceptance)
CREATE INDEX IF NOT EXISTS "idx_user_invitations_token" ON "public"."user_invitations" ("token");

-- Index for listing invitations by status
CREATE INDEX IF NOT EXISTS "idx_user_invitations_status" ON "public"."user_invitations" ("status");

-- Index for looking up invitations by email
CREATE INDEX IF NOT EXISTS "idx_user_invitations_email" ON "public"."user_invitations" ("email");

COMMENT ON TABLE "public"."user_invitations" IS 'Tracks user invitations with token-based acceptance flow.';

-- ============================================================================
-- 4. ADD ONBOARDING COLUMNS TO USER PROFILES
-- ============================================================================
ALTER TABLE "public"."user_profiles"
  ADD COLUMN IF NOT EXISTS "has_completed_onboarding" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "invited_by" "uuid",
  ADD COLUMN IF NOT EXISTS "invitation_id" "uuid";

-- Add foreign key constraints (idempotent via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_invited_by_fkey') THEN
    ALTER TABLE "public"."user_profiles"
      ADD CONSTRAINT "user_profiles_invited_by_fkey"
      FOREIGN KEY ("invited_by") REFERENCES "public"."user_profiles"("id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_invitation_id_fkey') THEN
    ALTER TABLE "public"."user_profiles"
      ADD CONSTRAINT "user_profiles_invitation_id_fkey"
      FOREIGN KEY ("invitation_id") REFERENCES "public"."user_invitations"("id");
  END IF;
END $$;

COMMENT ON COLUMN "public"."user_profiles"."has_completed_onboarding" IS 'Whether the user has completed the onboarding tutorial.';
COMMENT ON COLUMN "public"."user_profiles"."invited_by" IS 'The user who invited this user (NULL for self-registered or superadmin).';
COMMENT ON COLUMN "public"."user_profiles"."invitation_id" IS 'The invitation record that led to this user account.';
