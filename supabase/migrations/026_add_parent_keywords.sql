-- 026_add_parent_keywords.sql
-- Parent topic tags have empty keywords after cleanup.
-- Populate them so the suggestion engine has something to match against.

UPDATE tags SET keywords = ARRAY[
  'art', 'culture', 'music', 'film', 'movie', 'cinema', 'tv', 'television',
  'design', 'book', 'novel', 'literature', 'gallery', 'exhibition', 'museum',
  'theater', 'theatre', 'dance', 'performance', 'comic', 'illustration',
  'painting', 'sculpture', 'photography', 'fashion', 'architecture',
  'gaming', 'video game', 'internet culture', 'digital culture'
] WHERE slug = 'arts-culture';

UPDATE tags SET keywords = ARRAY[
  'politics', 'government', 'policy', 'election', 'congress', 'senate',
  'law', 'legal', 'justice', 'civil rights', 'activism', 'protest',
  'climate', 'environment', 'energy', 'immigration', 'migrant',
  'labor', 'union', 'worker', 'inequality', 'economics', 'tax',
  'healthcare', 'education', 'media', 'journalism', 'press',
  'international', 'foreign policy', 'geopolitics', 'war', 'conflict',
  'abortion', 'reproductive', 'lgbtq', 'gender', 'race', 'racism',
  'disability', 'policing', 'prison', 'surveillance'
] WHERE slug = 'politics-society';

UPDATE tags SET keywords = ARRAY[
  'science', 'technology', 'tech', 'ai', 'artificial intelligence',
  'machine learning', 'programming', 'software', 'code', 'developer',
  'open source', 'internet', 'web', 'app', 'startup', 'data',
  'privacy', 'security', 'encryption', 'algorithm', 'platform',
  'digital', 'computer', 'hardware', 'engineering', 'research',
  'space', 'nasa', 'biology', 'physics', 'chemistry', 'math',
  'robot', 'automation', 'crypto', 'blockchain', 'vr', 'ar'
] WHERE slug = 'science-technology';

UPDATE tags SET keywords = ARRAY[
  'health', 'medicine', 'medical', 'public health', 'pandemic',
  'covid', 'vaccine', 'mental health', 'therapy', 'psychology',
  'wellness', 'nutrition', 'disease', 'treatment', 'hospital',
  'doctor', 'nurse', 'patient', 'pharma', 'drug', 'clinical',
  'disability', 'chronic illness', 'healthcare', 'medicare',
  'fda', 'cdc', 'nih'
] WHERE slug = 'health-medicine';

UPDATE tags SET keywords = ARRAY[
  'business', 'startup', 'entrepreneur', 'founder', 'venture capital',
  'funding', 'economy', 'economics', 'market', 'finance', 'banking',
  'investment', 'trade', 'industry', 'corporate', 'work', 'labor',
  'jobs', 'career', 'management', 'leadership', 'remote work',
  'gig economy', 'freelance', 'tech industry', 'big tech',
  'google', 'apple', 'meta', 'amazon', 'microsoft', 'antitrust',
  'monopoly', 'regulation', 'advertising'
] WHERE slug = 'business-work';
