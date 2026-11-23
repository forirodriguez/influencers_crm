-- Preferencias de avisos, verificación de teléfono, silencios por acuerdo
-- y el índice único de mensajes de WhatsApp. No modifica migraciones anteriores.

ALTER TABLE "users" ADD COLUMN "email_reminders" boolean DEFAULT true NOT NULL
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_summary" boolean DEFAULT true NOT NULL
--> statement-breakpoint
CREATE TABLE "phone_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
)
--> statement-breakpoint
ALTER TABLE "phone_verifications" ADD CONSTRAINT "phone_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
--> statement-breakpoint
CREATE INDEX "phone_verifications_user_idx" ON "phone_verifications" USING btree ("user_id")
--> statement-breakpoint
CREATE TABLE "reminder_mutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
)
--> statement-breakpoint
ALTER TABLE "reminder_mutes" ADD CONSTRAINT "reminder_mutes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action
--> statement-breakpoint
ALTER TABLE "reminder_mutes" ADD CONSTRAINT "reminder_mutes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
--> statement-breakpoint
ALTER TABLE "reminder_mutes" ADD CONSTRAINT "reminder_mutes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action
--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_mutes_user_deal_unique" ON "reminder_mutes" USING btree ("user_id","deal_id") WHERE "deleted_at" is null
--> statement-breakpoint
CREATE INDEX "reminder_mutes_workspace_idx" ON "reminder_mutes" USING btree ("workspace_id")
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_wa_id_unique" ON "whatsapp_messages" USING btree ("wa_message_id") WHERE "wa_message_id" is not null
--> statement-breakpoint
DROP TRIGGER IF EXISTS reminder_mutes_touch ON reminder_mutes
--> statement-breakpoint
CREATE TRIGGER reminder_mutes_touch BEFORE UPDATE ON reminder_mutes FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at()
--> statement-breakpoint
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE phone_verifications FORCE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE reminder_mutes ENABLE ROW LEVEL SECURITY
--> statement-breakpoint
ALTER TABLE reminder_mutes FORCE ROW LEVEL SECURITY
--> statement-breakpoint
CREATE POLICY phone_verifications_select ON phone_verifications FOR SELECT
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY phone_verifications_insert ON phone_verifications FOR INSERT
  WITH CHECK (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY phone_verifications_update ON phone_verifications FOR UPDATE
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
  WITH CHECK (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY phone_verifications_delete ON phone_verifications FOR DELETE
  USING (current_user = 'app_jobs' OR user_id = app.current_user_id())
--> statement-breakpoint
CREATE POLICY reminder_mutes_select ON reminder_mutes FOR SELECT
  USING (
    current_user = 'app_jobs'
    OR (
      deleted_at IS NULL
      AND user_id = app.current_user_id()
      AND workspace_id IN (SELECT app.user_workspace_ids())
    )
  )
--> statement-breakpoint
CREATE POLICY reminder_mutes_insert ON reminder_mutes FOR INSERT
  WITH CHECK (
    current_user = 'app_jobs'
    OR (
      user_id = app.current_user_id()
      AND app.membership_role(workspace_id) IN ('owner', 'manager')
    )
  )
--> statement-breakpoint
CREATE POLICY reminder_mutes_update ON reminder_mutes FOR UPDATE
  USING (
    current_user = 'app_jobs'
    OR (
      deleted_at IS NULL
      AND user_id = app.current_user_id()
      AND app.membership_role(workspace_id) IN ('owner', 'manager')
    )
  )
  WITH CHECK (
    current_user = 'app_jobs'
    OR (
      user_id = app.current_user_id()
      AND app.membership_role(workspace_id) IN ('owner', 'manager')
    )
  )
--> statement-breakpoint
CREATE POLICY reminder_mutes_delete ON reminder_mutes FOR DELETE
  USING (
    current_user = 'app_jobs'
    OR (
      user_id = app.current_user_id()
      AND app.membership_role(workspace_id) IN ('owner', 'manager')
    )
  )
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE phone_verifications, reminder_mutes TO app_user, app_jobs
