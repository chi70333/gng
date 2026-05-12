-- Prevent the same PG transaction id from being applied to multiple payments.
-- PostgreSQL allows multiple NULL values, so manual-bank pending rows without
-- providerTxId are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_providerTxId_key"
ON "Payment" ("provider", "providerTxId");
