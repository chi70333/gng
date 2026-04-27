ALTER TABLE "Board" ADD COLUMN "legacyIndex" INTEGER;
CREATE UNIQUE INDEX "Board_legacyIndex_key" ON "Board"("legacyIndex");

ALTER TABLE "Post"
  ADD COLUMN "authorName" TEXT NOT NULL DEFAULT '고객',
  ADD COLUMN "authorEmail" TEXT;

ALTER TABLE "Post"
  ADD CONSTRAINT "Post_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt" DESC);

ALTER TABLE "Comment"
  ADD COLUMN "authorName" TEXT NOT NULL DEFAULT '고객',
  ADD COLUMN "password" TEXT;

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt" DESC);

ALTER TABLE "Inquiry"
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '고객',
  ADD COLUMN "password" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Inquiry"
  ADD CONSTRAINT "Inquiry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Inquiry_email_createdAt_idx" ON "Inquiry"("email", "createdAt" DESC);
