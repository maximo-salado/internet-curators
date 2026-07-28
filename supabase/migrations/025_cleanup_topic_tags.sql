-- 025_cleanup_topic_tags.sql
-- Remove granular child topic tags. Keep only parent-level categories
-- that group sources at a high level (~8-10 broad topics).
-- Meta tags + keyword matching will suggest topics from this set.

-- First, clear any article_tags and source_tags referencing child tags
DELETE FROM article_tags WHERE tag_id IN (
  SELECT id FROM tags WHERE facet = 'topic' AND parent_id IS NOT NULL
);

DELETE FROM source_tags WHERE tag_id IN (
  SELECT id FROM tags WHERE facet = 'topic' AND parent_id IS NOT NULL
);

DELETE FROM discovered_source_tags WHERE tag_id IN (
  SELECT id FROM tags WHERE facet = 'topic' AND parent_id IS NOT NULL
);

-- Then delete the child topic tags themselves
DELETE FROM tags WHERE facet = 'topic' AND parent_id IS NOT NULL;

-- Remaining parent topics after cleanup:
-- Arts & Culture
-- Politics & Society
-- Science & Technology
-- Health & Medicine
-- Business & Work
-- (plus any other standalone topics without children)
