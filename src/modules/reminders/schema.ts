import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "../../db/schema/helpers";
import { users, workspaces } from "../identity/schema";

export const reminderEntityEnum = pgEnum("reminder_entity", ["deliverable", "payment"]);
export const reminderChannelEnum = pgEnum("reminder_channel", ["whatsapp", "email", "in_app"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed", "cancelled"]);
export const whatsappDirectionEnum = pgEnum("whatsapp_direction", ["in", "out"]);
export const whatsappCategoryEnum = pgEnum("whatsapp_category", ["utility", "authentication", "service"]);
export const consentSourceEnum = pgEnum("consent_source", ["web", "whatsapp"]);

export const reminderRules = pgTable(
  "reminder_rules",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entity: reminderEntityEnum("entity").notNull(),
    offsetMinutes: integer("offset_minutes").notNull(),
    channel: reminderChannelEnum("channel").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("reminder_rules_workspace_idx").on(table.workspaceId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    channel: reminderChannelEnum("channel").notNull(),
    template: text("template").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    status: notificationStatusEnum("status").notNull().default("pending"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("notifications_idempotency_key_unique").on(table.idempotencyKey),
    index("notifications_user_idx").on(table.userId, table.status),
  ],
);

export const whatsappConsents = pgTable(
  "whatsapp_consents",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phoneE164: text("phone_e164").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    source: consentSourceEnum("source").notNull(),
    consentTextVersion: text("consent_text_version").notNull(),
    ...timestamps,
  },
  (table) => [index("whatsapp_consents_user_idx").on(table.userId)],
);

export const whatsappMessages = pgTable(
  "whatsapp_messages",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    direction: whatsappDirectionEnum("direction").notNull(),
    waMessageId: text("wa_message_id"),
    type: text("type"),
    templateName: text("template_name"),
    category: whatsappCategoryEnum("category"),
    body: text("body"),
    billable: boolean("billable"),
    pricingCategory: text("pricing_category"),
    status: text("status"),
    ...timestamps,
  },
  (table) => [index("whatsapp_messages_user_idx").on(table.userId), index("whatsapp_messages_wa_id_idx").on(table.waMessageId)],
);
