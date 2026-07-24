ALTER TABLE sources ADD COLUMN hidden boolean NOT NULL DEFAULT false;
CREATE INDEX idx_sources_hidden ON sources(hidden);
