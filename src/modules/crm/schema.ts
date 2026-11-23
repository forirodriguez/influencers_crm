import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "../../db/schema/helpers";
import { users, workspaces } from "../identity/schema";
import { creatorProfiles, posts } from "../media-kit/schema";

export const stageKindEnum = pgEnum("stage_kind", ["open", "won", "done", "lost"]);
export const compensationTypeEnum = pgEnum("compensation_type", ["paid", "barter", "mixed", "affiliate"]);
export const dealSourceEnum = pgEnum("deal_source", [
  "ig_dm",
  "tiktok_dm",
  "email",
  "whatsapp",
  "referral",
  "other",
]);
export const deliverablePlatformEnum = pgEnum("deliverable_platform", ["instagram", "tiktok", "other"]);
export const deliverableFormatEnum = pgEnum("deliverable_format", ["reel", "story", "post", "video", "ugc"]);
export const deliverableStatusEnum = pgEnum("deliverable_status", [
  "pending",
  "in_review",
  "approved",
  "published",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "overdue", "partial", "paid", "written_off"]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "bank_transfer",
  "mercado_pago",
  "cash",
  "paypal",
  "other",
]);

export const brands = pgTable(
  "brands",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
    website: text("website"),
    instagram: text("instagram"),
    tiktok: text("tiktok"),
    industry: text("industry"),
    country: text("country"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("brands_workspace_name_unique")
      .on(table.workspaceId, table.nameNormalized)
      .where(sql`${table.deletedAt} is null`),
    index("brands_workspace_idx").on(table.workspaceId),
  ],
);

export const brandContacts = pgTable(
  "brand_contacts",
  {
    id: primaryId(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    whatsappE164: text("whatsapp_e164"),
    instagram: text("instagram"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [index("brand_contacts_brand_idx").on(table.brandId), index("brand_contacts_workspace_idx").on(table.workspaceId)],
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    kind: stageKindEnum("kind").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("pipeline_stages_workspace_position_unique")
      .on(table.workspaceId, table.position)
      .where(sql`${table.deletedAt} is null`),
    index("pipeline_stages_workspace_idx").on(table.workspaceId),
  ],
);

export const deals = pgTable(
  "deals",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    primaryContactId: uuid("primary_contact_id").references(() => brandContacts.id, { onDelete: "set null" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    compensationType: compensationTypeEnum("compensation_type").notNull().default("paid"),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currency: text("currency"),
    barterValueMinor: bigint("barter_value_minor", { mode: "bigint" }),
    barterCurrency: text("barter_currency"),
    source: dealSourceEnum("source"),
    expectedCloseDate: date("expected_close_date"),
    lostReason: text("lost_reason"),
    exclusivityCategory: text("exclusivity_category"),
    exclusivityUntil: date("exclusivity_until"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("deals_workspace_stage_idx").on(table.workspaceId, table.stageId),
    index("deals_workspace_brand_idx").on(table.workspaceId, table.brandId),
    index("deals_creator_profile_idx").on(table.creatorProfileId),
  ],
);

export const deliverables = pgTable(
  "deliverables",
  {
    id: primaryId(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: deliverablePlatformEnum("platform").notNull(),
    format: deliverableFormatEnum("format").notNull(),
    quantity: integer("quantity").notNull().default(1),
    draftDueAt: timestamp("draft_due_at", { withTimezone: true, mode: "date" }),
    approvalDueAt: timestamp("approval_due_at", { withTimezone: true, mode: "date" }),
    publishDueAt: timestamp("publish_due_at", { withTimezone: true, mode: "date" }),
    status: deliverableStatusEnum("status").notNull().default("pending"),
    postUrl: text("post_url"),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("deliverables_workspace_publish_idx").on(table.workspaceId, table.publishDueAt),
    index("deliverables_deal_idx").on(table.dealId),
  ],
);

export const paymentExpectations = pgTable(
  "payment_expectations",
  {
    id: primaryId(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    dueDate: date("due_date").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    note: text("note"),
    ...timestamps,
  },
  (table) => [
    index("payment_expectations_workspace_status_due_idx").on(table.workspaceId, table.status, table.dueDate),
    index("payment_expectations_deal_idx").on(table.dealId),
  ],
);

export const paymentsReceived = pgTable(
  "payments_received",
  {
    id: primaryId(),
    paymentExpectationId: uuid("payment_expectation_id")
      .notNull()
      .references(() => paymentExpectations.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true, mode: "date" }).notNull(),
    method: paymentMethodEnum("method").notNull(),
    note: text("note"),
    ...timestamps,
  },
  (table) => [index("payments_received_expectation_idx").on(table.paymentExpectationId)],
);

export const activities = pgTable(
  "activities",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [index("activities_deal_idx").on(table.dealId), index("activities_workspace_idx").on(table.workspaceId)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    filename: text("filename").notNull(),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    ...timestamps,
  },
  (table) => [index("attachments_deal_idx").on(table.dealId)],
);
