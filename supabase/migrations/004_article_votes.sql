-- 004_article_votes.sql
-- Anonymous vote counts per article (link = unique key, no user tracking)

CREATE TABLE article_votes (
  link text PRIMARY KEY,
  upvotes int DEFAULT 0,
  downvotes int DEFAULT 0
);

-- Everyone can read counts
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vote counts are publicly readable" ON article_votes FOR SELECT USING (true);
