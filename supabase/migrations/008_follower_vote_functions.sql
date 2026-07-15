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

-- Atomic vote application (prev/next in {-1, 0, 1})
CREATE OR REPLACE FUNCTION apply_vote(p_link text, p_prev smallint, p_next smallint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE article_votes
  SET upvotes = GREATEST(0, upvotes - CASE WHEN p_prev = 1 THEN 1 ELSE 0 END + CASE WHEN p_next = 1 THEN 1 ELSE 0 END),
      downvotes = GREATEST(0, downvotes - CASE WHEN p_prev = -1 THEN 1 ELSE 0 END + CASE WHEN p_next = -1 THEN 1 ELSE 0 END)
  WHERE link = p_link;
$$;

-- Grant execute to both anon and authenticated roles
GRANT EXECUTE ON FUNCTION increment_follower_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_follower_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_vote(text, smallint, smallint) TO anon, authenticated;
