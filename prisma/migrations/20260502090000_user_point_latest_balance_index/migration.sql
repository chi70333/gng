-- Speeds up admin user mileage sorting, which reads the latest point ledger row per user.
CREATE INDEX "UserPointHistory_userId_id_idx" ON "UserPointHistory"("userId", "id" DESC);
