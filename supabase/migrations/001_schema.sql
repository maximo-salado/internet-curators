-- 001_schema.sql
-- Internet Curators — database schema

-- Curators (one per user, created on first collection)
CREATE TABLE curators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  display_name text NOT NULL,
  bio text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Collections (a curator can have many)
CREATE TABLE collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id uuid REFERENCES curators NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- RSS sources within a collection
CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES collections ON DELETE CASCADE NOT NULL,
  feed_url text NOT NULL,
  site_url text DEFAULT '',
  title text DEFAULT '',
  description text DEFAULT '',
  last_fetched_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Follower counts (number only, no user IDs stored)
CREATE TABLE follower_counts (
  curator_id uuid PRIMARY KEY REFERENCES curators ON DELETE CASCADE,
  count int DEFAULT 0
);

-- Indexes
CREATE INDEX idx_collections_curator ON collections(curator_id);
CREATE INDEX idx_collections_slug ON collections(slug);
CREATE INDEX idx_sources_collection ON sources(collection_id);
CREATE INDEX idx_curators_user ON curators(user_id);

-- RLS: curators
ALTER TABLE curators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Curators are publicly readable" ON curators FOR SELECT USING (true);
CREATE POLICY "Users can create their own curator" ON curators FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own curator" ON curators FOR UPDATE USING (auth.uid() = user_id);

-- RLS: collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Collections are publicly readable" ON collections FOR SELECT USING (true);
CREATE POLICY "Curators can create collections" ON collections FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM curators WHERE id = curator_id AND user_id = auth.uid()));
CREATE POLICY "Curators can update own collections" ON collections FOR UPDATE
  USING (EXISTS (SELECT 1 FROM curators WHERE id = curator_id AND user_id = auth.uid()));

-- RLS: sources
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sources are publicly readable" ON sources FOR SELECT USING (true);
CREATE POLICY "Curators can add sources to own collections" ON sources FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM collections c JOIN curators cu ON c.curator_id = cu.id
    WHERE c.id = collection_id AND cu.user_id = auth.uid()
  ));
CREATE POLICY "Curators can delete own sources" ON sources FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM collections c JOIN curators cu ON c.curator_id = cu.id
    WHERE c.id = collection_id AND cu.user_id = auth.uid()
  ));

-- RLS: follower_counts
ALTER TABLE follower_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follower counts are publicly readable" ON follower_counts FOR SELECT USING (true);
