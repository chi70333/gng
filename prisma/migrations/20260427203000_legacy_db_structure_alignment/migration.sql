-- Align the modern schema with legacy MySQL backup structure without importing member data.
-- Legacy source tables: member, member_addrs, social_member, coupon, coupon_list, trade, trade_goods, admin_list.

ALTER TABLE "User"
  ADD COLUMN "legacyMemberId" INTEGER,
  ADD COLUMN "nickname" TEXT,
  ADD COLUMN "memberType" TEXT NOT NULL DEFAULT 'M',
  ADD COLUMN "smsAgreedAt" TIMESTAMP(3),
  ADD COLUMN "legacyPointBalance" INTEGER;

CREATE UNIQUE INDEX "User_legacyMemberId_key" ON "User"("legacyMemberId");
CREATE INDEX "User_memberType_createdAt_idx" ON "User"("memberType", "createdAt" DESC);

CREATE TABLE "UserBusinessProfile" (
  "id" BIGSERIAL NOT NULL,
  "userId" BIGINT NOT NULL,
  "companyName" TEXT,
  "ceoName" TEXT,
  "businessType" TEXT,
  "businessItem" TEXT,
  "businessNumber" TEXT,
  "zipCode" TEXT,
  "address1" TEXT,
  "address2" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserBusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserBusinessProfile_userId_key" ON "UserBusinessProfile"("userId");

ALTER TABLE "UserBusinessProfile"
  ADD CONSTRAINT "UserBusinessProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserRefundAccount" (
  "id" BIGSERIAL NOT NULL,
  "userId" BIGINT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountHolder" TEXT NOT NULL,
  "accountNumber" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserRefundAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserRefundAccount_userId_key" ON "UserRefundAccount"("userId");

ALTER TABLE "UserRefundAccount"
  ADD CONSTRAINT "UserRefundAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAddress"
  ADD COLUMN "legacySeq" INTEGER,
  ADD COLUMN "legacyMemberId" TEXT;

CREATE UNIQUE INDEX "UserAddress_legacySeq_key" ON "UserAddress"("legacySeq");
CREATE INDEX "UserAddress_legacyMemberId_idx" ON "UserAddress"("legacyMemberId");

ALTER TABLE "UserSocialAccount"
  ADD COLUMN "legacyUid" INTEGER;

CREATE UNIQUE INDEX "UserSocialAccount_legacyUid_key" ON "UserSocialAccount"("legacyUid");

ALTER TABLE "Coupon"
  ADD COLUMN "legacyId" INTEGER;

CREATE UNIQUE INDEX "Coupon_legacyId_key" ON "Coupon"("legacyId");

ALTER TABLE "CouponIssue"
  ADD COLUMN "legacyId" INTEGER;

CREATE UNIQUE INDEX "CouponIssue_legacyId_key" ON "CouponIssue"("legacyId");

ALTER TABLE "Order"
  ADD COLUMN "legacyId" INTEGER,
  ADD COLUMN "legacyTradeCode" TEXT;

CREATE UNIQUE INDEX "Order_legacyId_key" ON "Order"("legacyId");
CREATE UNIQUE INDEX "Order_legacyTradeCode_key" ON "Order"("legacyTradeCode");

ALTER TABLE "OrderItem"
  ADD COLUMN "legacyId" INTEGER,
  ADD COLUMN "legacyTradeCode" TEXT;

CREATE UNIQUE INDEX "OrderItem_legacyId_key" ON "OrderItem"("legacyId");
CREATE INDEX "OrderItem_legacyTradeCode_idx" ON "OrderItem"("legacyTradeCode");

ALTER TABLE "AdminUser"
  ADD COLUMN "legacyId" INTEGER;

CREATE UNIQUE INDEX "AdminUser_legacyId_key" ON "AdminUser"("legacyId");
