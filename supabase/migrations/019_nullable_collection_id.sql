-- 019_nullable_collection_id.sql
-- Sources no longer require a collection (editorial pipeline removed)

alter table sources alter column collection_id drop not null;
