-- Seed batch 1: ~25 sources from progressive/indie directories
-- Run in Supabase SQL Editor

INSERT INTO discovered_sources (feed_url, site_url, title, description, platform, language, recent_posts, suggested_tags, independence_signals, discovered_by)
VALUES
  -- Indie tech / web culture
  ('https://macwright.com/feed.xml', 'https://macwright.com', 'macwright.org', 'Independent blog about maps, open data, and the web by Tom MacWright', 'custom', 'en',
   '[{"title":"Recently updated", "link":"https://macwright.com", "date":"2026-07-01"}]',
   ARRAY['tech', 'open-web', 'maps'], '{"self_hosted":true,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  ('https://simonwillison.net/atom/everything/', 'https://simonwillison.net', 'Simon Willison''s Weblog', 'Datasette creator, indie web tools, LLM experiments', 'custom', 'en',
   '[{"title":"Recent entries", "link":"https://simonwillison.net", "date":"2026-07-01"}]',
   ARRAY['tech', 'open-source', 'data'], '{"self_hosted":true,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  ('https://tantek.com/updates.atom', 'https://tantek.com', 'Tantek Çelik', 'IndieWeb co-founder, web standards, open social web', 'custom', 'en',
   '[{"title":"Recent updates", "link":"https://tantek.com", "date":"2026-07-01"}]',
   ARRAY['indieweb', 'open-web', 'standards'], '{"self_hosted":true,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  -- Progressive / political
  ('https://popular.info/feed', 'https://popular.info', 'Popular Information', 'Independent accountability journalism by Judd Legum', 'substack', 'en',
   '[{"title":"Recent posts", "link":"https://popular.info", "date":"2026-07-01"}]',
   ARRAY['progressive', 'accountability', 'politics'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  ('https://www.currentaffairs.org/feed', 'https://www.currentaffairs.org', 'Current Affairs', 'Progressive political and cultural commentary magazine', 'wordpress', 'en',
   '[{"title":"Recent articles", "link":"https://www.currentaffairs.org", "date":"2026-07-01"}]',
   ARRAY['progressive', 'politics', 'culture'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  ('https://prospect.org/feed/', 'https://prospect.org', 'The American Prospect', 'Progressive public policy and politics journal founded in 1990', 'custom', 'en',
   '[{"title":"Recent articles", "link":"https://prospect.org", "date":"2026-07-01"}]',
   ARRAY['progressive', 'policy', 'politics'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  ('https://theintercept.com/feed/?lang=en', 'https://theintercept.com', 'The Intercept', 'Adversarial investigative journalism, fearless reporting', 'wordpress', 'en',
   '[{"title":"Recent investigations", "link":"https://theintercept.com", "date":"2026-07-01"}]',
   ARRAY['investigative', 'progressive', 'politics'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  -- Climate / environment
  ('https://heated.world/feed', 'https://heated.world', 'HEATED', 'Climate accountability journalism by Emily Atkin, independent', 'substack', 'en',
   '[{"title":"Recent posts", "link":"https://heated.world", "date":"2026-07-01"}]',
   ARRAY['climate', 'environment', 'accountability'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  ('https://grist.org/feed/', 'https://grist.org', 'Grist', 'Nonprofit climate and environmental justice news', 'wordpress', 'en',
   '[{"title":"Recent articles", "link":"https://grist.org", "date":"2026-07-01"}]',
   ARRAY['climate', 'environment', 'justice'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  -- Labor / economics
  ('https://www.labornotes.org/rss.xml', 'https://www.labornotes.org', 'Labor Notes', 'Rank-and-file labor movement news and organizing resources', 'custom', 'en',
   '[{"title":"Recent posts", "link":"https://www.labornotes.org", "date":"2026-07-01"}]',
   ARRAY['labor', 'organizing', 'unions'], '{"self_hosted":false,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  ('https://civicskunk.works/feed', 'https://civicskunk.works', 'Civic Skunk Works', 'Indie analysis of civic tech, government, and public interest technology', 'ghost', 'en',
   '[{"title":"Recent posts", "link":"https://civicskunk.works", "date":"2026-07-01"}]',
   ARRAY['civic-tech', 'government', 'public-interest'], '{"self_hosted":false,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  -- Bear Blog (indie-first minimalist)
  ('https://blog.ayjay.org/feed/', 'https://blog.ayjay.org', 'The Homebound Symphony', 'Alan Jacobs — literature, technology, culture. Bear Blog indie', 'bearblog', 'en',
   '[{"title":"Recent posts", "link":"https://blog.ayjay.org", "date":"2026-07-01"}]',
   ARRAY['culture', 'literature', 'technology'], '{"self_hosted":false,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  ('https://tiramisu.bearblog.dev/feed/', 'https://tiramisu.bearblog.dev', 'Tiramisu', 'Indie blog — tech, life, and the indie web experience', 'bearblog', 'en',
   '[{"title":"Recent posts", "link":"https://tiramisu.bearblog.dev", "date":"2026-07-01"}]',
   ARRAY['indie-web', 'tech', 'personal'], '{"self_hosted":false,"custom_domain":false,"has_trackers":false}', 'seed-batch-1'),

  -- Indie journalism
  ('https://www.404media.co/feed/', 'https://www.404media.co', '404 Media', 'Independent tech journalism, worker-owned, no corporate overlords', 'custom', 'en',
   '[{"title":"Recent stories", "link":"https://www.404media.co", "date":"2026-07-01"}]',
   ARRAY['tech', 'journalism', 'worker-owned'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  ('https://flaminghydra.com/feed/', 'https://flaminghydra.com', 'Flaming Hydra', 'Writer-owned cooperative daily newsletter, many voices one feed', 'wordpress', 'en',
   '[{"title":"Recent posts", "link":"https://flaminghydra.com", "date":"2026-07-01"}]',
   ARRAY['cooperative', 'journalism', 'culture'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  -- Race / justice
  ('https://prismreports.org/feed/', 'https://prismreports.org', 'Prism', 'Journalism by and for communities of color, BIPOC-led nonprofit', 'wordpress', 'en',
   '[{"title":"Recent reports", "link":"https://prismreports.org", "date":"2026-07-01"}]',
   ARRAY['racial-justice', 'BIPOC', 'journalism'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  -- Arts / culture
  ('https://www.hyperallergic.com/feed/', 'https://www.hyperallergic.com', 'Hyperallergic', 'Independent arts and culture journalism, progressive lens', 'wordpress', 'en',
   '[{"title":"Recent articles", "link":"https://www.hyperallergic.com", "date":"2026-07-01"}]',
   ARRAY['arts', 'culture', 'progressive'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  -- Indie web / small web
  ('https://maya.land/feed.xml', 'https://maya.land', 'Maya Land', 'Personal indie blog — technology, games, and the small web', 'custom', 'en',
   '[{"title":"Recent posts", "link":"https://maya.land", "date":"2026-07-01"}]',
   ARRAY['indie-web', 'personal', 'games'], '{"self_hosted":true,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  -- Spanish-language progressive
  ('https://www.elsaltodiario.com/feed/rss', 'https://www.elsaltodiario.com', 'El Salto', 'Periodismo independiente, cooperativo y autogestionado desde España', 'custom', 'es',
   '[{"title":"Últimas noticias", "link":"https://www.elsaltodiario.com", "date":"2026-07-01"}]',
   ARRAY['cooperative', 'journalism', 'spanish'], '{"self_hosted":false,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  ('https://piedra-papel-tijera.com.mx/feed/', 'https://piedra-papel-tijera.com.mx', 'Piedra Papel Tijera', 'Periodismo narrativo independiente desde México', 'wordpress', 'es',
   '[{"title":"Últimos artículos", "link":"https://piedra-papel-tijera.com.mx", "date":"2026-07-01"}]',
   ARRAY['narrative', 'journalism', 'spanish'], '{"self_hosted":false,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  -- Urbanism / cities
  ('https://slate.com/feeds/metropolis.rss', 'https://slate.com/business/metropolis', 'Slate — Metropolis', 'Cities, urbanism, housing, and infrastructure', 'custom', 'en',
   '[{"title":"Recent columns", "link":"https://slate.com/business/metropolis", "date":"2026-07-01"}]',
   ARRAY['urbanism', 'cities', 'housing'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  -- Design / UX
  ('https://adactio.com/rss/', 'https://adactio.com', 'Adactio', 'Jeremy Keith — web design, progressive enhancement, indie web', 'custom', 'en',
   '[{"title":"Recent entries", "link":"https://adactio.com", "date":"2026-07-01"}]',
   ARRAY['web-design', 'standards', 'indie-web'], '{"self_hosted":true,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  -- Substack with RSS (independent)
  ('https://www.disabilityvisibilityproject.com/feed', 'https://www.disabilityvisibilityproject.com', 'Disability Visibility Project', 'Alice Wong — disability justice, culture, and community', 'wordpress', 'en',
   '[{"title":"Recent posts", "link":"https://www.disabilityvisibilityproject.com", "date":"2026-07-01"}]',
   ARRAY['disability-justice', 'community', 'culture'], '{"self_hosted":false,"custom_domain":true,"has_trackers":true}', 'seed-batch-1'),

  -- Open source / community
  ('https://werd.io/feed', 'https://werd.io', 'Werd I/O', 'Ben Werdmuller — open web, community, tech ethics, indie', 'custom', 'en',
   '[{"title":"Recent posts", "link":"https://werd.io", "date":"2026-07-01"}]',
   ARRAY['open-web', 'community', 'ethics'], '{"self_hosted":true,"custom_domain":true,"has_trackers":false}', 'seed-batch-1'),

  -- Writing / personal essay
  ('https://www.robinrendle.com/feed.xml', 'https://www.robinrendle.com', 'Robin Rendle', 'Designer/writer — essays on design, books, and the craft of writing', 'custom', 'en',
   '[{"title":"Recent essays", "link":"https://www.robinrendle.com", "date":"2026-07-01"}]',
   ARRAY['writing', 'design', 'personal-essay'], '{"self_hosted":true,"custom_domain":true,"has_trackers":false}', 'seed-batch-1')

ON CONFLICT (feed_url) DO NOTHING;
