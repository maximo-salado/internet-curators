CREATE TABLE user_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  curator_id uuid REFERENCES curators(id) ON DELETE CASCADE,
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CHECK (
    (curator_id IS NOT NULL AND source_id IS NULL) OR
    (curator_id IS NULL AND source_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_user_follows_curator_uniq
  ON user_follows(user_id, curator_id)
  WHERE curator_id IS NOT NULL;

CREATE UNIQUE INDEX idx_user_follows_source_uniq
  ON user_follows(user_id, source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX idx_user_follows_user ON user_follows(user_id);
CREATE INDEX idx_user_follows_curator ON user_follows(curator_id);
CREATE INDEX idx_user_follows_source ON user_follows(source_id);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own follows" ON user_follows FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
