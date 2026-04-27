ALTER TABLE "User" ADD COLUMN "loginId" TEXT;

UPDATE "User"
SET "loginId" = split_part("email", '@', 1)
WHERE "loginId" IS NULL
  AND "email" LIKE '%@legacy.local'
  AND split_part("email", '@', 1) <> '';

CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");
