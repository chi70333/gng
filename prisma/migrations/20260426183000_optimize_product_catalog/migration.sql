-- Speed up public product catalog reads under traffic spikes.
-- Targets category pages, best/new product lists, price sorting, and review aggregates.
CREATE INDEX "Product_status_deletedAt_createdAt_idx" ON "Product"("status", "deletedAt", "createdAt" DESC);
CREATE INDEX "Product_status_deletedAt_soldCount_idx" ON "Product"("status", "deletedAt", "soldCount" DESC);
CREATE INDEX "Product_status_deletedAt_price_idx" ON "Product"("status", "deletedAt", "price");
CREATE INDEX "ProductReview_productId_isHidden_idx" ON "ProductReview"("productId", "isHidden");
