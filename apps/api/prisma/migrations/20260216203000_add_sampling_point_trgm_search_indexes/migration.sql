CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "SamplingPoint_name_lower_trgm_idx"
  ON "SamplingPoint" USING GIN (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "SamplingPoint_address_lower_trgm_idx"
  ON "SamplingPoint" USING GIN (lower(coalesce(address, '')) gin_trgm_ops);
