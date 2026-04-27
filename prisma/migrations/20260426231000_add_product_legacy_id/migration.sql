-- Preserve legacy goods.idx for goods_detail.php?goodsIdx=N compatibility redirects.
ALTER TABLE "Product" ADD COLUMN "legacyId" INTEGER;

UPDATE "Product"
SET "legacyId" = ("attributes"->'legacy'->>'goodsIdx')::INTEGER
WHERE "legacyId" IS NULL
  AND ("attributes"->'legacy'->>'goodsIdx') ~ '^[0-9]+$';

CREATE UNIQUE INDEX "Product_legacyId_key" ON "Product"("legacyId");
