-- Legacy goods_list.php compatibility.
-- Maps legacy category.idx values used by /goods_list.php?Index=N to the new Category rows.
CREATE TABLE "CategoryLegacyMap" (
    "id" BIGSERIAL NOT NULL,
    "legacyIndex" INTEGER NOT NULL,
    "legacyCode" TEXT,
    "categoryId" BIGINT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'legacy.category.idx',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryLegacyMap_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CategoryLegacyMap_legacyIndex_key" ON "CategoryLegacyMap"("legacyIndex");
CREATE INDEX "CategoryLegacyMap_categoryId_idx" ON "CategoryLegacyMap"("categoryId");

ALTER TABLE "CategoryLegacyMap"
ADD CONSTRAINT "CategoryLegacyMap_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
