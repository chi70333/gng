-- [GNG] Store cart snapshots in DB when Redis env vars are unavailable on Vercel.
CREATE TABLE "CartSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "identityType" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CartSnapshot_key_key" ON "CartSnapshot"("key");
CREATE INDEX "CartSnapshot_identityType_identityId_idx" ON "CartSnapshot"("identityType", "identityId");
CREATE INDEX "CartSnapshot_expiresAt_idx" ON "CartSnapshot"("expiresAt");
