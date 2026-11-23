import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "../../db/schema/helpers";

export const workspaceTypeEnum = pgEnum("workspace_type", ["personal", "agency"]);
export const workspacePlanEnum = pgEnum("workspace_plan", ["beta", "free", "pro", "agency"]);
export const membershipRoleEnum = pgEnum("membership_role", ["owner", "manager", "viewer"]);
export const legalDocumentEnum = pgEnum("legal_document", ["terms", "privacy"]);

export const users = pgTable(
  "users",
  {
    id: primaryId(),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    locale: text("locale").notNull().default("es-AR"),
    timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
    country: text("country"),
    phoneE164: text("phone_e164"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true, mode: "date" }),
    emailReminders: boolean("email_reminders").notNull().default(true),
    dailySummary: boolean("daily_summary").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email).where(sql`${table.deletedAt} is null`),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: primaryId(),
    name: text("name").notNull(),
    type: workspaceTypeEnum("type").notNull().default("personal"),
    country: text("country"),
    defaultCurrency: text("default_currency").notNull().default("ARS"),
    plan: workspacePlanEnum("plan").notNull().default("beta"),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [index("workspaces_type_idx").on(table.type)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("memberships_workspace_user_unique")
      .on(table.workspaceId, table.userId)
      .where(sql`${table.deletedAt} is null`),
    index("memberships_user_idx").on(table.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: membershipRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("invitations_token_hash_unique").on(table.tokenHash),
    index("invitations_workspace_idx").on(table.workspaceId),
  ],
);

export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    document: legalDocumentEnum("document").notNull(),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    ip: text("ip"),
  },
  (table) => [index("legal_acceptances_user_idx").on(table.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("audit_log_workspace_idx").on(table.workspaceId, table.createdAt)],
);

/**
 * Infrastructure for the local auth adapter. Not part of the product domain.
 * Supabase Auth owns credentials when AUTH_MODE=supabase. app_user cannot read these.
 */
export const authCredentials = pgTable("auth_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const magicLinks = pgTable(
  "magic_links",
  {
    id: primaryId(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("magic_links_token_hash_unique").on(table.tokenHash)],
);
