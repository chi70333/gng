-- Speed up /admin/orders live list filters without changing no-cache behavior.
CREATE INDEX "Order_deletedAt_createdAt_idx" ON "Order"("deletedAt", "createdAt" DESC);
CREATE INDEX "Order_deletedAt_status_createdAt_idx" ON "Order"("deletedAt", "status", "createdAt" DESC);
