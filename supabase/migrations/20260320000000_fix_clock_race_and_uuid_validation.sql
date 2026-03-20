-- Fix clock-in race condition: Prevent duplicate active clock sessions per user
-- This ensures only ONE active session can exist per user at a time
-- Without this, two concurrent clock-in requests could both pass the check
-- and create duplicate active sessions (TOCTOU race condition)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clock_sessions_one_active_per_user
  ON clock_sessions (user_id)
  WHERE is_active = true;
