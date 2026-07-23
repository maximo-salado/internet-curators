-- 017_backfill_trust_tags.sql
-- Backfill: map existing independence_signals jsonb trust keys → discovered_source_tags rows
-- Run AFTER 016 (seed tags must exist first)

INSERT INTO discovered_source_tags (source_id, tag_id)
SELECT ds.id, t.id
FROM discovered_sources ds
JOIN tags t ON (
  (ds.independence_signals->>'content_credentials' = 'true' AND t.slug = 'content-credentials')
  OR (ds.independence_signals->>'trust_project' = 'true' AND t.slug = 'trust-project')
  OR (ds.independence_signals->>'jti_certified' = 'true' AND t.slug = 'jti-certified')
  OR (ds.independence_signals->>'ifcn_signatory' = 'true' AND t.slug = 'ifcn-signatory')
  OR (ds.independence_signals->>'creative_commons' IS NOT NULL AND t.slug = 'creative-commons')
  OR (ds.independence_signals->>'not_by_ai' = 'true' AND t.slug = 'not-by-ai')
  OR (ds.independence_signals->>'indieweb' = 'true' AND t.slug = 'indieweb')
)
WHERE ds.independence_signals->>'_enrichment_attempted' = 'true'
ON CONFLICT (source_id, tag_id) DO NOTHING;

-- Note: platform tags and no-trackers tag are NOT backfilled.
-- Platform lives in discovered_sources.platform (top-level column), not in independence_signals.
-- no-trackers has no existing key (only has_trackers boolean exists).
-- Both will populate on next enrichment run for un-enriched sources.
-- For already-enriched sources, editors assign them manually on the detail page.
