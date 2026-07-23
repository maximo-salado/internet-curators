-- 016_tag_system_refactor.sql
-- Tag system refactor: trust, infra, platform facets + discovered_source_tags junction
-- Plan: .hermes/plans/tag-system-refactor.md

-- 1. Add new facets to tags CHECK constraint
-- Drop existing constraint (name from 014_taxonomy_foundation.sql)
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_facet_check;
ALTER TABLE tags ADD CONSTRAINT tags_facet_check
  CHECK (facet IN ('topic', 'voice', 'stance', 'format', 'language', 'trust', 'infra', 'platform'));

-- 2. Create discovered_source_tags junction table
CREATE TABLE discovered_source_tags (
  source_id uuid REFERENCES discovered_sources(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  edited_at timestamptz DEFAULT now(),
  edited_by uuid REFERENCES curators(id),
  PRIMARY KEY (source_id, tag_id)
);

CREATE INDEX idx_dst_tag ON discovered_source_tags(tag_id);

ALTER TABLE discovered_source_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Discovered source tags are publicly readable" ON discovered_source_tags FOR SELECT USING (true);
CREATE POLICY "Editors and service_role can manage discovered source tags" ON discovered_source_tags FOR ALL
  USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM curators WHERE user_id = auth.uid() AND role = 'editor'
  ));

-- 3. Seed tags

-- Trust facet
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('Content Credentials', 'content-credentials', 'trust', 1, ARRAY['contentcredentials.org','c2pa.org']),
  ('Trust Project', 'trust-project', 'trust', 2, ARRAY['thetrustproject.org']),
  ('JTI Certified', 'jti-certified', 'trust', 3, ARRAY['journalismtrustinitiative.org']),
  ('IFCN Signatory', 'ifcn-signatory', 'trust', 4, ARRAY['ifcncodeofprinciples.poynter.org']),
  ('Creative Commons', 'creative-commons', 'trust', 5, ARRAY['creativecommons.org','licensebuttons.net']),
  ('Public Domain', 'public-domain', 'trust', 6, ARRAY[]::text[]),
  ('Not by AI', 'not-by-ai', 'trust', 7, ARRAY['notbyai.fyi']),
  ('IndieWeb', 'indieweb', 'trust', 8, ARRAY['indieweb.org','webmention'])
ON CONFLICT (slug) DO NOTHING;

-- Infra facet (no-trackers only — has-trackers stays in jsonb)
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('Self-Hosted', 'self-hosted', 'infra', 1, ARRAY[]::text[]),
  ('Custom Domain', 'custom-domain', 'infra', 2, ARRAY[]::text[]),
  ('No Trackers', 'no-trackers', 'infra', 3, ARRAY[]::text[])
ON CONFLICT (slug) DO NOTHING;

-- Platform facet
INSERT INTO tags (name, slug, facet, display_order) VALUES
  ('WordPress', 'wordpress', 'platform', 1),
  ('Ghost', 'ghost', 'platform', 2),
  ('Substack', 'substack', 'platform', 3),
  ('Bear Blog', 'bearblog', 'platform', 4),
  ('Mastodon', 'mastodon', 'platform', 5),
  ('Lemmy', 'lemmy', 'platform', 6),
  ('Micro.blog', 'microblog', 'platform', 7),
  ('Neocities', 'neocities', 'platform', 8),
  ('Tumblr', 'tumblr', 'platform', 9),
  ('Medium', 'medium', 'platform', 10),
  ('Blogger', 'blogger', 'platform', 11),
  ('Custom', 'custom', 'platform', 12),
  ('Other', 'other', 'platform', 13)
ON CONFLICT (slug) DO NOTHING;

-- Language facet (add if missing)
INSERT INTO tags (name, slug, facet, display_order) VALUES
  ('English', 'en', 'language', 1),
  ('Spanish', 'es', 'language', 2)
ON CONFLICT (slug) DO NOTHING;
