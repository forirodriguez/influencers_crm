-- The product voice is Uruguayan Spanish, and a workspace without a country
-- starts in pesos uruguayos. Existing rows keep the currency and locale they have.
ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'es-UY'
--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "default_currency" SET DEFAULT 'UYU'
