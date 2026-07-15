-- Wipe platform user's collections, sources, and cached articles
-- Run in Supabase SQL Editor

DO $$
DECLARE
  plat_user_id uuid;
  plat_curator_id uuid;
BEGIN
  SELECT id INTO plat_user_id FROM auth.users WHERE email = 'localhost.sepia538@passmail.net';
  SELECT id INTO plat_curator_id FROM curators WHERE user_id = plat_user_id;

  DELETE FROM articles WHERE source_id IN (
    SELECT s.id FROM sources s 
    JOIN collections c ON s.collection_id = c.id 
    WHERE c.curator_id = plat_curator_id
  );

  DELETE FROM sources WHERE collection_id IN (
    SELECT id FROM collections WHERE curator_id = plat_curator_id
  );

  DELETE FROM collections WHERE curator_id = plat_curator_id;

  RAISE NOTICE 'Cleaned up curator: %', plat_curator_id;
END $$;
