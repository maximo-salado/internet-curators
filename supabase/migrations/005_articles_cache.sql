-- 005_articles_cache.sql
-- Cache parsed RSS articles for fast feed serving

CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES sources ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  link text NOT NULL,
  pub_date timestamptz NOT NULL DEFAULT now(),
  content_snippet text DEFAULT '',
  content text DEFAULT '',
  image text,
  created_at timestamptz DEFAULT now(),

  UNIQUE(source_id, link)
);

CREATE INDEX idx_articles_source ON articles(source_id);
CREATE INDEX idx_articles_pub_date ON articles(pub_date DESC);

-- RLS: articles are publicly readable
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles are publicly readable" ON articles FOR SELECT USING (true);
CREATE POLICY "Service can insert articles" ON articles FOR INSERT WITH CHECK (true);
