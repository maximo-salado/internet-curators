-- 011_discovery_pipeline.sql
-- Category/tag lookup tables + service_role RLS policies for cron jobs

-- === Category and tag lookup tables ===

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order int DEFAULT 0
);

CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order int DEFAULT 0
);

-- Add category column to discovered_sources
ALTER TABLE discovered_sources ADD COLUMN IF NOT EXISTS category text DEFAULT '';

-- Seed categories (generic, user-facing browsing buckets)
INSERT INTO categories (name, display_order) VALUES
  ('politics', 1), ('tech', 2), ('culture', 3), ('design', 4),
  ('music', 5), ('gaming', 6), ('science', 7), ('journalism', 8),
  ('personal', 9), ('programming', 10), ('AI', 11)
ON CONFLICT (name) DO NOTHING;

-- Seed tags (taste/flavor, refinement layer)
INSERT INTO tags (name, display_order) VALUES
  ('indie', 1), ('progressive', 2), ('mainstream', 3), ('commercial', 4),
  ('investigative', 5), ('personal-essay', 6), ('academic', 7),
  ('tutorial', 8), ('opinion', 9), ('news', 10)
ON CONFLICT (name) DO NOTHING;

-- Public read for both
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are publicly readable" ON categories FOR SELECT USING (true);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tags are publicly readable" ON tags FOR SELECT USING (true);

-- === Fix RLS for cron jobs (service_role bypass) ===

-- discovered_sources: allow service_role to INSERT + UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert discovered sources" ON discovered_sources;
CREATE POLICY "Authenticated or service_role can insert discovered sources" ON discovered_sources FOR INSERT
  WITH CHECK (auth.role() IN ('authenticated', 'service_role'));

DROP POLICY IF EXISTS "Editors can update discovered sources" ON discovered_sources;
CREATE POLICY "Editors or service_role can update discovered sources" ON discovered_sources FOR UPDATE
  USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM curators WHERE user_id = auth.uid() AND role = 'editor'
  ))
  WITH CHECK (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM curators WHERE user_id = auth.uid() AND role = 'editor'
  ));

-- rejected_sources: allow service_role to INSERT
DROP POLICY IF EXISTS "Editors can insert rejected sources" ON rejected_sources;
CREATE POLICY "Editors or service_role can insert rejected sources" ON rejected_sources FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM curators WHERE user_id = auth.uid() AND role = 'editor'
  ));

-- sources: allow service_role to DELETE (needed for seed audit cleanup)
CREATE POLICY "Service role can delete sources" ON sources FOR DELETE
  USING (auth.role() = 'service_role');

-- collections: allow service_role to DELETE
CREATE POLICY "Service role can delete collections" ON collections FOR DELETE
  USING (auth.role() = 'service_role');
