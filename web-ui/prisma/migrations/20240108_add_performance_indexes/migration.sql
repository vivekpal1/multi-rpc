-- Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_usage_userid_date" ON "Usage"("userId", "date" DESC);
CREATE INDEX IF NOT EXISTS "idx_apikey_userid_active" ON "ApiKey"("userId", "active");
CREATE INDEX IF NOT EXISTS "idx_apikey_lastused" ON "ApiKey"("lastUsedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_invoice_userid_status" ON "Invoice"("userId", "status");
CREATE INDEX IF NOT EXISTS "idx_webhook_userid_active" ON "Webhook"("userId", "active");

-- Add indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS "idx_user_createdat" ON "User"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_usage_requests" ON "Usage"("requests" DESC);
CREATE INDEX IF NOT EXISTS "idx_apikey_createdat" ON "ApiKey"("createdAt" DESC);

-- Add partial index for active records
CREATE INDEX IF NOT EXISTS "idx_apikey_active_partial" ON "ApiKey"("userId") WHERE "active" = true;
CREATE INDEX IF NOT EXISTS "idx_webhook_active_partial" ON "Webhook"("userId") WHERE "active" = true;

-- Add indexes for text search (if needed)
CREATE INDEX IF NOT EXISTS "idx_user_email_lower" ON "User"(LOWER("email"));
CREATE INDEX IF NOT EXISTS "idx_apikey_name_lower" ON "ApiKey"(LOWER("name"));