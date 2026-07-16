-- 007_fix_rls_policies.sql
-- Security audit: tighten RLS policies and add atomic vote function

-- C2: Drop open INSERT/UPDATE policies on article_votes.
-- Writes are now handled exclusively by apply_vote() (SECURITY DEFINER),
-- so anonymous users never need direct table access.
DROP POLICY IF EXISTS "Anyone can vote" ON article_votes;
DROP POLICY IF EXISTS "Anyone can update votes" ON article_votes;

-- C3: Restrict articles INSERT to service_role only (RSS ingest pipeline).
DROP POLICY IF EXISTS "Service can insert articles" ON articles;
CREATE POLICY "Service can insert articles" ON articles
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- C1 + C2: Atomic vote helper.
-- Validates the article exists, then upserts vote counts in a single
-- statement — no TOCTOU race between read and write.
-- SECURITY DEFINER lets anon callers write to article_votes without
-- needing a permissive RLS INSERT/UPDATE policy.
CREATE OR REPLACE FUNCTION apply_vote(p_link text, p_prev int, p_next int)
RETURNS TABLE (upvotes int, downvotes int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM articles WHERE link = p_link) THEN
    RAISE EXCEPTION 'article_not_found';
  END IF;

  INSERT INTO article_votes (link, upvotes, downvotes)
  VALUES (
    p_link,
    GREATEST(0, CASE WHEN p_next = 1  THEN 1 ELSE 0 END),
    GREATEST(0, CASE WHEN p_next = -1 THEN 1 ELSE 0 END)
  )
  ON CONFLICT (link) DO UPDATE SET
    upvotes   = GREATEST(0, article_votes.upvotes
                  - CASE WHEN p_prev = 1  THEN 1 ELSE 0 END
                  + CASE WHEN p_next = 1  THEN 1 ELSE 0 END),
    downvotes = GREATEST(0, article_votes.downvotes
                  - CASE WHEN p_prev = -1 THEN 1 ELSE 0 END
                  + CASE WHEN p_next = -1 THEN 1 ELSE 0 END);

  RETURN QUERY
    SELECT av.upvotes, av.downvotes
    FROM article_votes av
    WHERE av.link = p_link;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_vote(text, int, int) TO anon, authenticated;
