-- 023_create_daily_issue_fn.sql
-- Atomic snapshot function. One transaction, no orphan issues.
-- SECURITY DEFINER to write past RLS. Only service_role can execute.
-- Test-phase numbering: increments by 0.1 (0.1, 0.2, ...).
-- Switch to +1 when going live by changing the increment on line 35.

CREATE OR REPLACE FUNCTION create_daily_issue(
  p_date        date,
  p_origin      text,
  p_article_ids uuid[]
)
RETURNS TABLE (issue_id uuid, issue_number numeric, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issue_id     uuid;
  v_issue_number numeric;
BEGIN
  -- Serialize across concurrent cron fires.
  PERFORM pg_advisory_xact_lock(hashtext('create_daily_issue'));

  -- Idempotency: this date already has an issue → return it, create nothing.
  SELECT i.id, i.issue_number INTO v_issue_id, v_issue_number
  FROM issues i WHERE i.date = p_date;
  IF FOUND THEN
    RETURN QUERY SELECT v_issue_id, v_issue_number, false;
    RETURN;
  END IF;

  -- Empty pool → do NOT create an issue.
  IF p_article_ids IS NULL OR array_length(p_article_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'empty_pool' USING ERRCODE = 'P0001';
  END IF;

  v_issue_number := COALESCE((SELECT max(issues.issue_number) FROM issues), 0) + 0.1;

  INSERT INTO issues (issue_number, date, origin, published)
  VALUES (v_issue_number, p_date, p_origin, true)
  RETURNING id INTO v_issue_id;

  -- position = array ordinality - 1. Deterministic order from payload.
  -- If any article_id is already issued, uniq_article_one_issue raises → rollback.
  INSERT INTO issue_articles (issue_id, article_id, position)
  SELECT v_issue_id, u.article_id, (u.ord - 1)::int
  FROM unnest(p_article_ids) WITH ORDINALITY AS u(article_id, ord);

  RETURN QUERY SELECT v_issue_id, v_issue_number, true;
END;
$$;

REVOKE ALL ON FUNCTION create_daily_issue(date, text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION create_daily_issue(date, text, uuid[]) TO service_role;
