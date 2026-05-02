-- Adds an operator-controlled flag for category product sections on the shop main page.
ALTER TABLE "Category"
ADD COLUMN "showOnDashboard" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Category_showOnDashboard_isActive_sortOrder_idx"
ON "Category"("showOnDashboard", "isActive", "sortOrder");
