-- 003_published.sql
-- Add published flag to collections (default false = private)

ALTER TABLE collections ADD COLUMN IF NOT EXISTS published boolean DEFAULT false;

-- Index for filtering published collections
CREATE INDEX IF NOT EXISTS idx_collections_published ON collections(published);

-- Update RLS: everyone can read published collections;
-- all collections still readable (feed combines both with attribution rules)
-- No RLS changes needed — existing SELECT policy already allows public reads
