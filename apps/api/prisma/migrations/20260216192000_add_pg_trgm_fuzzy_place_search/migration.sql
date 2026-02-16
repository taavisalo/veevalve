CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Place_nameEt_trgm_idx"
  ON "Place" USING GIN ("nameEt" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Place_nameEn_trgm_idx"
  ON "Place" USING GIN ("nameEn" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Place_municipality_trgm_idx"
  ON "Place" USING GIN ("municipality" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Place_addressEt_trgm_idx"
  ON "Place" USING GIN ("addressEt" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Place_addressEn_trgm_idx"
  ON "Place" USING GIN ("addressEn" gin_trgm_ops);
