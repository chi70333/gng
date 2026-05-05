CREATE TABLE "ExternalMemberWebhookLog" (
  "id" BIGSERIAL NOT NULL,
  "userId" BIGINT,
  "provider" TEXT NOT NULL DEFAULT 'kakao',
  "loginId" TEXT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "endpoint" TEXT NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'POST',
  "statusCode" INTEGER,
  "success" BOOLEAN NOT NULL DEFAULT false,
  "errorMessage" TEXT,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExternalMemberWebhookLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalMemberWebhookLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ExternalMemberWebhookLog_success_createdAt_idx"
  ON "ExternalMemberWebhookLog"("success", "createdAt" DESC);

CREATE INDEX "ExternalMemberWebhookLog_provider_createdAt_idx"
  ON "ExternalMemberWebhookLog"("provider", "createdAt" DESC);

CREATE INDEX "ExternalMemberWebhookLog_loginId_idx"
  ON "ExternalMemberWebhookLog"("loginId");

CREATE INDEX "ExternalMemberWebhookLog_userId_idx"
  ON "ExternalMemberWebhookLog"("userId");
