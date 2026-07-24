CREATE TABLE blacklisted_feeds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_url    text UNIQUE NOT NULL,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only service-role / admin can read or write
ALTER TABLE blacklisted_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON blacklisted_feeds USING (false);
