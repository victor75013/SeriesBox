-- ===========================
-- Migration: Add note column to watchlist
-- Run this in Supabase SQL Editor
-- ===========================

-- 1. Add the 'note' column to the watchlist table
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS note TEXT;

-- 2. Add UPDATE policy (was missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'watchlist'
    AND policyname = 'Users can update own watchlist'
  ) THEN
    CREATE POLICY "Users can update own watchlist" ON watchlist
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$$;
