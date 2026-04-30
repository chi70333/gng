CREATE TABLE "ApiCommunicationLog" (
  "id" BIGSERIAL NOT NULL,
  "service" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "action" TEXT,
  "statusCode" INTEGER NOT NULL,
  "success" BOOLEAN NOT NULL,
  "durationMs" INTEGER,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "errorMessage" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ApiCommunicationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiCommunicationLog_service_createdAt_idx"
  ON "ApiCommunicationLog"("service", "createdAt" DESC);

CREATE INDEX "ApiCommunicationLog_success_createdAt_idx"
  ON "ApiCommunicationLog"("success", "createdAt" DESC);

CREATE INDEX "ApiCommunicationLog_createdAt_idx"
  ON "ApiCommunicationLog"("createdAt" DESC);
