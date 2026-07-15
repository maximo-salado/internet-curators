-- Migration 008: Follower count atomic operations + vote apply function
-- Fixes H1 (follower race) and C1 (vote inflation)

-- Atomic follower increment
CREATE OR REPLACE FUNCTION increment_follower_count(p_curator_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  INSERT INTO follower_counts (curator_id, count) VALUES (p_curator_id, 1)
  ON CONFLICT (curator_id) DO UPDATE SET count = follower_counts.count + 1;
$$;

-- Atomic follower decrement
CREATE OR REPLACE FUNCTION decrement_follower_count(p_curator_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE follower_counts SET count = GREATEST(0, count - 1) WHERE curator_id = p_curator_id;
$$;

-- apply_vote is in migration 007 (better version with article validation)
-- This migration only handles follower count operations

GRANT EXECUTE ON FUNCTION increment_follower_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_follower_count(uuid) TO anon, authenticated;
