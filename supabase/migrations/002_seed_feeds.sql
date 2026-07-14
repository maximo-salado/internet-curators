-- Seed collections and sources for Max's curator
-- Skips existing collections, adds missing sources

DO $$
DECLARE
  curator_id uuid := 'da2111b3-1b27-49e6-a4a3-72da55f10ce2';
  col_id uuid;
BEGIN
  -- Politics
  SELECT id INTO col_id FROM collections WHERE slug = 'politics';
  IF col_id IS NULL THEN
    INSERT INTO collections (curator_id, name, slug) VALUES (curator_id, 'Politics', 'politics') RETURNING id INTO col_id;
  END IF;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://theintercept.com/feed/?lang=en') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://www.democracynow.org/democracynow.rss') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://www.propublica.org/feeds/propublica/main') ON CONFLICT DO NOTHING;

  -- Alternative Music
  SELECT id INTO col_id FROM collections WHERE slug = 'alternative-music';
  IF col_id IS NULL THEN
    INSERT INTO collections (curator_id, name, slug) VALUES (curator_id, 'Alternative Music', 'alternative-music') RETURNING id INTO col_id;
  END IF;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://pitchfork.com/rss/news/') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://www.stereogum.com/feed/') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://brooklynvegan.com/feed/') ON CONFLICT DO NOTHING;

  -- Punk Art
  SELECT id INTO col_id FROM collections WHERE slug = 'punk-art';
  IF col_id IS NULL THEN
    INSERT INTO collections (curator_id, name, slug) VALUES (curator_id, 'Punk Art', 'punk-art') RETURNING id INTO col_id;
  END IF;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://hifructose.com/feed/') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://beautifulbizarre.net/feed/') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://www.juxtapoz.com/feed/') ON CONFLICT DO NOTHING;

  -- Design
  SELECT id INTO col_id FROM collections WHERE slug = 'design';
  IF col_id IS NULL THEN
    INSERT INTO collections (curator_id, name, slug) VALUES (curator_id, 'Design', 'design') RETURNING id INTO col_id;
  END IF;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://www.dezeen.com/feed/') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://eyeondesign.aiga.org/feed/') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://www.itsnicethat.com/feed') ON CONFLICT DO NOTHING;

  -- Open Source
  SELECT id INTO col_id FROM collections WHERE slug = 'open-source';
  IF col_id IS NULL THEN
    INSERT INTO collections (curator_id, name, slug) VALUES (curator_id, 'Open Source', 'open-source') RETURNING id INTO col_id;
  END IF;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://opensource.com/feed') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://www.smashingmagazine.com/feed/') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://alistapart.com/main/feed/') ON CONFLICT DO NOTHING;

  -- Camera Trapping
  SELECT id INTO col_id FROM collections WHERE slug = 'camera-trapping';
  IF col_id IS NULL THEN
    INSERT INTO collections (curator_id, name, slug) VALUES (curator_id, 'Camera Trapping', 'camera-trapping') RETURNING id INTO col_id;
  END IF;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://winterberrywildlife.ouroneacrefarm.com/feed/') ON CONFLICT DO NOTHING;
  INSERT INTO sources (collection_id, feed_url) VALUES (col_id, 'https://naturespy.org/blogs/journal.atom') ON CONFLICT DO NOTHING;

END $$;
