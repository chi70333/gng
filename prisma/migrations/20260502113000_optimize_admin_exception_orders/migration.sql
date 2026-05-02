-- Speed up /admin/orders?exception=mileage-not-2000000 no-cache admin scans.
CREATE INDEX "Order_deletedAt_pointsUsed_createdAt_idx" ON "Order"("deletedAt", "pointsUsed", "createdAt" DESC);
