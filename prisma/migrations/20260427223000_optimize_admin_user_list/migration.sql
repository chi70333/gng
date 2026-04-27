-- [GNG] Speed up /admin/users by matching the default admin list filter/sort
-- and enabling substring search over member identity fields.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "User_deletedAt_createdAt_idx"
  ON "User" ("deletedAt", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "User_deletedAt_status_createdAt_idx"
  ON "User" ("deletedAt", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "User_loginId_trgm_idx"
  ON "User" USING GIN ("loginId" gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "loginId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "User_email_trgm_idx"
  ON "User" USING GIN ("email" gin_trgm_ops)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "User_name_trgm_idx"
  ON "User" USING GIN ("name" gin_trgm_ops)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "User_phone_trgm_idx"
  ON "User" USING GIN ("phone" gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "phone" IS NOT NULL;
