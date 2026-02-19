CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Place_nameEt_lower_trgm_idx"
  ON "Place" USING GIN (lower("nameEt") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Place_nameEn_lower_trgm_idx"
  ON "Place" USING GIN (lower("nameEn") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Place_municipality_lower_trgm_idx"
  ON "Place" USING GIN (lower("municipality") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Place_addressEt_lower_trgm_idx"
  ON "Place" USING GIN (lower(coalesce("addressEt", '')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Place_addressEn_lower_trgm_idx"
  ON "Place" USING GIN (lower(coalesce("addressEn", '')) gin_trgm_ops);
