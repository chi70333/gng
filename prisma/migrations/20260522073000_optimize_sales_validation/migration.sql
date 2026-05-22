-- Speed up /admin/sales-validation daily aggregates and sorting.
CREATE INDEX "UserPointHistory_createdAt_userId_idx"
  ON "UserPointHistory"("createdAt" DESC, "userId");

CREATE INDEX "Order_createdAt_userId_idx"
  ON "Order"("createdAt" DESC, "userId");

CREATE INDEX "ApiCommunicationLog_sales_validation_scan_idx"
  ON "ApiCommunicationLog"("createdAt" DESC, "service", "action")
  WHERE "method" = 'POST'
    AND "success" = true;

CREATE INDEX "ApiCommunicationLog_sales_validation_userid_idx"
  ON "ApiCommunicationLog"(
    LOWER(COALESCE("requestPayload"->>'userid', '')),
    "createdAt" DESC
  )
  WHERE "method" = 'POST'
    AND "success" = true
    AND "service" IN ('gng-api', 'point-sync')
    AND COALESCE("action", '') IN ('add', 'point_sync')
    AND NULLIF("requestPayload"->>'amount', '') ~ '^-?[0-9]+$';
