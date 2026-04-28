-- Degraded-mode product search support when Meilisearch is not configured or unavailable.
-- These pg_trgm indexes keep Prisma contains filters bounded enough for the 30s cached fallback path.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Product_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "status" = 'active';

CREATE INDEX IF NOT EXISTS "Product_sku_trgm_idx"
  ON "Product" USING GIN ("sku" gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "status" = 'active';

CREATE INDEX IF NOT EXISTS "Product_summary_trgm_idx"
  ON "Product" USING GIN ("summary" gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "status" = 'active';

CREATE INDEX IF NOT EXISTS "Brand_name_trgm_idx"
  ON "Brand" USING GIN ("name" gin_trgm_ops);
