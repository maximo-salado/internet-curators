-- 004_article_votes.sql
-- Anonymous vote counts per article (link = unique key, no user tracking)

CREATE TABLE article_votes (
  link text PRIMARY KEY,
  upvotes int DEFAULT 0,
  downvotes int DEFAULT 0
);

-- Everyone can read counts, anyone can insert/update (anonymous voting)
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vote counts are publicly readable" ON article_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can vote" ON article_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update votes" ON article_votes FOR UPDATE USING (true);
