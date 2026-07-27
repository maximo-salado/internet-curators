-- 022_daily_issues.sql
-- Daily magazine issues: frozen, ordered snapshot of the approved pool.
-- One issue per UTC day. Articles never repeat across issues.

CREATE TABLE issues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_number  int  NOT NULL UNIQUE,
  date          date NOT NULL UNIQUE,
  origin        text NOT NULL DEFAULT 'auto'
                 CHECK (origin IN ('auto', 'curated')),
  published     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_issues_date ON issues(date DESC);
CREATE INDEX idx_issues_number ON issues(issue_number DESC);

-- Junction: which articles are in an issue, in what order.
CREATE TABLE issue_articles (
  issue_id    uuid REFERENCES issues(id) ON DELETE CASCADE NOT NULL,
  article_id  uuid REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  position    int  NOT NULL,
  PRIMARY KEY (issue_id, article_id),
  UNIQUE (issue_id, position)
);

CREATE INDEX idx_issue_articles_issue ON issue_articles(issue_id, position);

-- Never-repeat guarantee: each article in at most one issue.
CREATE UNIQUE INDEX uniq_article_one_issue ON issue_articles(article_id);

-- RLS: public read, service role write
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Issues are publicly readable" ON issues
  FOR SELECT USING (published = true);
CREATE POLICY "Service role manages issues" ON issues
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

ALTER TABLE issue_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Issue articles are publicly readable" ON issue_articles
  FOR SELECT USING (true);
CREATE POLICY "Service role manages issue articles" ON issue_articles
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
