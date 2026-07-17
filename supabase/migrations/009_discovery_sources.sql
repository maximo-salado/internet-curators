-- 009_discovery_sources.sql
-- Discovery pipeline: source candidates + editorial review

-- Extend curators with editor role
ALTER TABLE curators ADD COLUMN IF NOT EXISTS role text DEFAULT 'curator';
-- Valid values: 'curator', 'editor'
-- Only editors can approve/reject discovered sources.
-- Set manually: UPDATE curators SET role = 'editor' WHERE user_id = '<max user id>';

-- Discovered sources — candidates awaiting editorial review
CREATE TABLE discovered_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_url text NOT NULL,
  site_url text DEFAULT '',
  title text NOT NULL,
  description text DEFAULT '',
  platform text DEFAULT '',           -- 'substack', 'ghost', 'wordpress', 'bearblog', 'mastodon', etc.
  language text DEFAULT 'en',         -- 'en' or 'es'
  recent_posts jsonb DEFAULT '[]',    -- [{title, link, date}] — 2-3 recent post titles for sniff test
  suggested_tags text[] DEFAULT '{}', -- auto-suggested perspective tags
  independence_signals jsonb DEFAULT '{}', -- {self_hosted, custom_domain, has_trackers, platform_type}
  status text DEFAULT 'pending',      -- 'pending', 'approved', 'rejected'
  discovered_by text DEFAULT '',      -- 'hermes-weekly-scan', 'manual', 'import-batch'
  discovered_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES curators(id),
  UNIQUE(feed_url)
);

-- Rejected sources — logged so Hermes never re-suggests them
CREATE TABLE rejected_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_url text NOT NULL UNIQUE,
  site_url text DEFAULT '',
  title text DEFAULT '',
  reason text DEFAULT '',             -- why it was rejected (for filter refinement)
  rejected_at timestamptz DEFAULT now(),
  rejected_by uuid REFERENCES curators(id)
);

-- Indexes
CREATE INDEX idx_discovered_status ON discovered_sources(status);
CREATE INDEX idx_discovered_platform ON discovered_sources(platform);
CREATE INDEX idx_discovered_language ON discovered_sources(language);
CREATE INDEX idx_discovered_feed_url ON discovered_sources(feed_url);
CREATE INDEX idx_discovered_reviewed_at ON discovered_sources(reviewed_at DESC);
CREATE INDEX idx_rejected_feed_url ON rejected_sources(feed_url);
CREATE INDEX idx_rejected_at ON rejected_sources(rejected_at DESC);

-- RLS: discovered_sources — publicly readable, any authenticated user can insert
-- (editor check happens at approve/reject time, not insert time — allows cron/automation)
ALTER TABLE discovered_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Discovered sources are publicly readable" ON discovered_sources FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert discovered sources" ON discovered_sources FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Editors can update discovered sources" ON discovered_sources FOR UPDATE
  USING (EXISTS (SELECT 1 FROM curators WHERE user_id = auth.uid() AND role = 'editor'));

-- RLS: rejected_sources — publicly readable, editors can insert
ALTER TABLE rejected_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rejected sources are publicly readable" ON rejected_sources FOR SELECT USING (true);
CREATE POLICY "Editors can insert rejected sources" ON rejected_sources FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM curators WHERE user_id = auth.uid() AND role = 'editor'));
