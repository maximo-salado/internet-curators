-- 012_system_curator.sql
-- Make user_id nullable + create system curator for platform collections

-- Allow system curators without auth users
ALTER TABLE curators ALTER COLUMN user_id DROP NOT NULL;

-- Create system curator for platform-owned collections
INSERT INTO curators (user_id, display_name, bio, role)
VALUES (NULL, 'Editorial Board', 'Platform-curated picks from the editorial team.', 'editor')
ON CONFLICT DO NOTHING;

-- Move "Editor's Picks" collection to the system curator
UPDATE collections
SET curator_id = (SELECT id FROM curators WHERE display_name = 'Editorial Board')
WHERE name = 'Editor''s Picks'
  AND curator_id != (SELECT id FROM curators WHERE display_name = 'Editorial Board');
