-- 014_taxonomy_foundation.sql
-- Unified faceted tag system replacing orphaned categories + tags from 011

-- Drop orphaned tables (nothing reads/writes them)
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS tags CASCADE;

-- Reset approved discovered_sources to pending so all candidates go through
-- the new taxonomy tagging flow on re-approval
UPDATE discovered_sources SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL
WHERE status = 'approved';

-- Remove approved sources (will be re-inserted on re-approval with taxonomy tags)
DELETE FROM sources;

-- Unified tags table
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  facet text NOT NULL CHECK (facet IN ('topic', 'voice', 'stance', 'format', 'language')),
  parent_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  display_order int DEFAULT 0,
  keywords text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tags_facet ON tags(facet);
CREATE INDEX idx_tags_parent ON tags(parent_id);

-- Source tags (editor-assigned)
CREATE TABLE source_tags (
  source_id uuid REFERENCES sources(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (source_id, tag_id)
);

-- Article tags (keyword-matched only; inherited tags resolve at query time via source_tags JOIN)
CREATE TABLE article_tags (
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (article_id, tag_id)
);

CREATE INDEX idx_article_tags_tag ON article_tags(tag_id);

-- RLS: public read
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tags are publicly readable" ON tags FOR SELECT USING (true);

ALTER TABLE source_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Source tags are publicly readable" ON source_tags FOR SELECT USING (true);

ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article tags are publicly readable" ON article_tags FOR SELECT USING (true);

-- RLS: editor + service_role write on source_tags
CREATE POLICY "Editors can manage source tags" ON source_tags FOR ALL
  USING (EXISTS (
    SELECT 1 FROM curators WHERE user_id = auth.uid() AND role = 'editor'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM curators WHERE user_id = auth.uid() AND role = 'editor'
  ));

CREATE POLICY "Service role can manage source tags" ON source_tags FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed: Topics (6 groups, 36 subtopics — restructured per Claude review)
-- Arts & Culture (8 subtopics)
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('Arts & Culture', 'arts-culture', 'topic', 1, '{}'),
  ('Film & TV', 'film-tv', 'topic', 2, ARRAY['cinema','filmmaker','director','screenwriter','streaming','netflix','hollywood','documentary','indie film','film festival','cinematography','box office','a24','criterion','showrunner','prestige tv']),
  ('Music', 'music', 'topic', 3, ARRAY['album','band','singer','rapper','songwriter','concert','tour','record label','streaming','spotify','vinyl','playlist','music industry','music festival','live music','dj','producer','beat']),
  ('Books & Literature', 'books-literature', 'topic', 4, ARRAY['novel','author','poet','poetry','fiction','non-fiction','publishing','book review','literary','bookshelf','reading','writer','memoir','essay collection','short story']),
  ('Visual Arts', 'visual-arts', 'topic', 5, ARRAY['art gallery','painter','sculpture','exhibition','museum','contemporary art','art fair','printmaking','ceramics','mural','street art','photography exhibit','art history']),
  ('Design', 'design', 'topic', 6, ARRAY['typography','branding','graphic design','UX design','UI design','product design','industrial design','design system','web design','interaction design','font','user experience']),
  ('Gaming', 'gaming', 'topic', 7, ARRAY['video game','indie game','nintendo','playstation','xbox','pc gaming','game design','steam','game developer','esports','tabletop','rpg','game studio','game review']),
  ('Humor & Satire', 'humor-satire', 'topic', 8, ARRAY['mcsweeney','reductress','clickhole','hard drive','humor writing','comedy criticism','satire as genre','history of comedy']),
  ('Performing Arts', 'performing-arts', 'topic', 9, ARRAY['theater','broadway','dance performance','ballet','opera','stage','choreography','live performance','comedy show','standup','improv']),
  ('Internet Culture', 'internet-culture', 'topic', 10, ARRAY['meme','viral','social media','tiktok','youtube','influencer','creator economy','online community','reddit','discord','content creator','digital culture','platform']);

-- Set parent_id for Arts & Culture children
UPDATE tags SET parent_id = (SELECT id FROM tags WHERE slug = 'arts-culture')
  WHERE slug IN ('film-tv', 'music', 'books-literature', 'visual-arts', 'design', 'gaming', 'humor-satire', 'performing-arts', 'internet-culture');

-- Politics & Society (8 subtopics — Climate & Energy moved here)
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('Politics & Society', 'politics-society', 'topic', 11, '{}'),
  ('US Politics', 'us-politics', 'topic', 12, ARRAY['congress','senate','supreme court','white house','election','democrat','republican','midterm','voter','ballot','gerrymander','electoral','governor','legislat']),
  ('Policy & Law', 'policy-law', 'topic', 13, ARRAY['legislation','regulation','supreme court','legal ruling','constitutional','federal law','state law','court case','lawsuit','judicial','statute','executive order']),
  ('Labor & Organizing', 'labor-organizing', 'topic', 14, ARRAY['union','strike','collective bargaining','worker','labor rights','nlrb','gig economy','wages','working condition','workplace','organizer','solidarity','labor movement','picket']),
  ('Civil Rights & Justice', 'civil-rights-justice', 'topic', 15, ARRAY['civil rights','racial justice','police reform','mass incarceration','disability rights','lgbtq','bodily autonomy','reproductive rights','aclu','discrimination','systemic','equity','justice reform','abolition']),
  ('Immigration', 'immigration', 'topic', 16, ARRAY['immigration','migrant','asylum','border','daca','refugee','deportation','ice','citizenship','undocumented','dreamer','naturalization']),
  ('International Affairs', 'international-affairs', 'topic', 17, ARRAY['geopolitic','foreign policy','nato','united nations','diplomacy','sanctions','treaty','global south','eu','brexit','war','conflict','peace','occupation','humanitarian']),
  ('Climate & Energy', 'climate-energy', 'topic', 18, ARRAY['climate change','emissions','renewable','solar','wind power','fossil fuel','carbon','net zero','greenwashing','biodiversity','ecosystem','sustainability','pollution','extinction','conservation']),
  ('Disinformation & Media', 'disinformation-media', 'topic', 19, ARRAY['misinformation','disinformation','propaganda','fact-check','media literacy','fake news','conspiracy','platform regulation','content moderation','algorithmic','information war']);

UPDATE tags SET parent_id = (SELECT id FROM tags WHERE slug = 'politics-society')
  WHERE slug IN ('us-politics', 'policy-law', 'labor-organizing', 'civil-rights-justice', 'immigration', 'international-affairs', 'climate-energy', 'disinformation-media');

-- Science & Technology (4 subtopics — Climate & Social Science moved out)
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('Science & Technology', 'science-technology', 'topic', 20, '{}'),
  ('Computing & Programming', 'computing-programming', 'topic', 21, ARRAY['open source','github','programming','developer','software engineer','coding','javascript','rust','python','api','compiler','web development','devops','linux','kernel']),
  ('AI & Machine Learning', 'ai-machine-learning', 'topic', 22, ARRAY['machine learning','llm','gpt','neural network','deep learning','transformer','model training','ai agent','artificial intelligence','openai','anthropic','chatbot','diffusion model','fine-tune','prompt']),
  ('Open Web & Digital Rights', 'open-web-digital-rights', 'topic', 23, ARRAY['indieweb','fediverse','mastodon','activitypub','rss','digital rights','net neutrality','privacy','surveillance','encryption','data protection','gdpr','decentralized','open protocol']),
  ('Health & Medicine', 'health-medicine', 'topic', 24, ARRAY['public health','pandemic','vaccine','covid','healthcare','medicare','medical research','drug','fda','clinical trial','mental health','therapy','psychiatry','wellness','nutrition']);

UPDATE tags SET parent_id = (SELECT id FROM tags WHERE slug = 'science-technology')
  WHERE slug IN ('computing-programming', 'ai-machine-learning', 'open-web-digital-rights', 'health-medicine');

-- Business & Work (5 subtopics, unchanged)
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('Business & Work', 'business-work', 'topic', 25, '{}'),
  ('Startups & Entrepreneurship', 'startups-entrepreneurship', 'topic', 26, ARRAY['startup','founder','venture capital','vc funding','y combinator','incubator','bootstrapping','saas','product-market fit','pitch deck','angel investor','unicorn']),
  ('Big Tech & Platforms', 'big-tech-platforms', 'topic', 27, ARRAY['google','apple','meta','amazon','microsoft','antitrust','monopoly','platform','big tech','surveillance capitalism','data broker','advertising tech','algorithm']),
  ('Media Industry', 'media-industry', 'topic', 28, ARRAY['journalism industry','newsroom','layoff','newspaper','digital media','subscription model','paywall','local news','news desert','press freedom','media consolidation']),
  ('Inequality & Economics', 'inequality-economics', 'topic', 29, ARRAY['inequality','wealth gap','billionaire','tax policy','inflation','recession','federal reserve','minimum wage','ubi','economic justice','debt','student loan','housing crisis']),
  ('Future of Work', 'future-of-work', 'topic', 30, ARRAY['remote work','hybrid work','four-day week','automation','job displacement','gig work','freelancer','coworking','ai replacement','workplace culture','quiet quitting']);

UPDATE tags SET parent_id = (SELECT id FROM tags WHERE slug = 'business-work')
  WHERE slug IN ('startups-entrepreneurship', 'big-tech-platforms', 'media-industry', 'inequality-economics', 'future-of-work');

-- Lifestyle (5 subtopics, unchanged)
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('Lifestyle', 'lifestyle', 'topic', 31, '{}'),
  ('Food & Cooking', 'food-cooking', 'topic', 32, ARRAY['recipe','cooking','restaurant','chef','food culture','cuisine','baking','fermentation','home cooking','food review','dining','ingredient','culinary']),
  ('Travel & Place', 'travel-place', 'topic', 33, ARRAY['travel','trip','destination','tourism','city guide','hiking','backpacking','road trip','local culture','place','geography','walking','neighborhood']),
  ('Parenting & Family', 'parenting-family', 'topic', 34, ARRAY['parenting','child','family','mom','dad','pregnancy','school','kid','toddler','teen','adoption','childcare','parental leave','homeschool']),
  ('Home & Urbanism', 'home-urbanism', 'topic', 35, ARRAY['housing','urban planning','city design','public transit','zoning','walkable','bike lane','architecture','rent','home ownership','neighborhood','suburb','street design']),
  ('Personal Growth', 'personal-growth', 'topic', 36, ARRAY['productivity','habit','meditation','mindfulness','self-improvement','goal setting','journal','routine','life lesson','reflection','personal development','growth mindset']);

UPDATE tags SET parent_id = (SELECT id FROM tags WHERE slug = 'lifestyle')
  WHERE slug IN ('food-cooking', 'travel-place', 'parenting-family', 'home-urbanism', 'personal-growth');

-- History & Ideas (5 subtopics — Social Science moved here)
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('History & Ideas', 'history-ideas', 'topic', 37, '{}'),
  ('Philosophy', 'philosophy', 'topic', 38, ARRAY['ethics','moral','consciousness','epistemology','existential','stoic','nietzsche','foucault','plato','aristotle','kant','philosophy of','philosopher','metaphysics','free will']),
  ('History', 'history', 'topic', 39, ARRAY['history of','historian','historical','archive','oral history','centur','ancient','medieval','cold war','civil war','revolution','colonial','indigenous history','historical analysis']),
  ('Social Science', 'social-science', 'topic', 40, ARRAY['sociology','anthropology','behavioral economics','psychology study','research paper','demographic','census','survey data','human behavior','cognitive','neuroscience']),
  ('Education', 'education', 'topic', 41, ARRAY['education','school','university','college','student','teacher','pedagogy','curriculum','academic','learning','literacy','higher ed','public school','charter school','student debt']),
  ('Religion & Belief', 'religion-belief', 'topic', 42, ARRAY['religion','faith','church','spiritual','theology','secular','atheism','buddhist','christian','muslim','jewish','hindu','belief system','religious practice']);

UPDATE tags SET parent_id = (SELECT id FROM tags WHERE slug = 'history-ideas')
  WHERE slug IN ('philosophy', 'history', 'social-science', 'education', 'religion-belief');

-- Seed: Voice (9 — article-level, keyword-matched — "Academic" renamed to "Scholarly")
INSERT INTO tags (name, slug, facet, display_order, keywords) VALUES
  ('Investigative', 'voice-investigative', 'voice', 1, ARRAY['according to documents','obtained by','investigation found','whistleblower','records show','freedom of information','foia','leaked','undercover','exclusive']),
  ('Personal Essay', 'voice-personal-essay', 'voice', 2, ARRAY['I remember','I think','I believe','in my experience','I learned','I realized','I was','memoir','first person']),
  ('Opinion', 'voice-opinion', 'voice', 3, ARRAY['should','must','ought','opinion','argument','we need','it is time','editorial','column','case against','case for']),
  ('News', 'voice-news', 'voice', 4, ARRAY['announced','reported','according to','said in a statement','press release','confirmed','breaking','update']),
  ('Tutorial', 'voice-tutorial', 'voice', 5, ARRAY['how to','guide','tutorial','step by step','walkthrough','learn','setup','getting started','beginner','introduction to']),
  ('Scholarly', 'voice-scholarly', 'voice', 6, ARRAY['abstract','methodology','findings','citation','literature review','data set','statistically','peer reviewed','journal of','doi','published in']),
  ('Review', 'voice-review', 'voice', 7, ARRAY['review','verdict','rating','worth it','recommend','pros and cons','hands on','tested','impressions']),
  ('Interview', 'voice-interview', 'voice', 8, ARRAY['sits down with','in conversation with','interview','told me','Q&A','asks','transcript','conversation']),
  ('Satire', 'voice-satire', 'voice', 9, ARRAY['satire','satirical','parody','the onion','humor','comedic','funny','spoof']);

-- Seed: Stance (8)
INSERT INTO tags (name, slug, facet, display_order) VALUES
  ('Indie', 'stance-indie', 'stance', 1),
  ('Worker-Owned', 'stance-worker-owned', 'stance', 2),
  ('Nonprofit', 'stance-nonprofit', 'stance', 3),
  ('Progressive', 'stance-progressive', 'stance', 4),
  ('Mainstream', 'stance-mainstream', 'stance', 5),
  ('Grassroots', 'stance-grassroots', 'stance', 6),
  ('Academic', 'stance-academic', 'stance', 7),
  ('Corporate', 'stance-corporate', 'stance', 8);

-- Seed: Format (8)
INSERT INTO tags (name, slug, facet, display_order) VALUES
  ('Longform', 'format-longform', 'format', 1),
  ('Newsletter', 'format-newsletter', 'format', 2),
  ('Magazine', 'format-magazine', 'format', 3),
  ('Blog', 'format-blog', 'format', 4),
  ('Podcast', 'format-podcast', 'format', 5),
  ('Linkblog', 'format-linkblog', 'format', 6),
  ('Video Essay', 'format-video-essay', 'format', 7),
  ('Comic', 'format-comic', 'format', 8);

-- Seed: Language (2)
INSERT INTO tags (name, slug, facet, display_order) VALUES
  ('English', 'lang-en', 'language', 1),
  ('Spanish', 'lang-es', 'language', 2);
