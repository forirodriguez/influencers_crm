import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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

export const socialPlatformEnum = pgEnum("social_platform", ["instagram", "tiktok", "youtube", "other"]);
export const socialConnectionEnum = pgEnum("social_connection", ["api", "manual"]);
export const socialStatusEnum = pgEnum("social_status", ["active", "expired", "revoked", "error"]);

export type MediaKitSettings = {
  blocks: {
    photo: boolean;
    bio: boolean;
    metrics: boolean;
    services: boolean;
    contact: boolean;
  };
  accent: string;
  indexable: boolean;
  showPrices: boolean;
};

export const defaultMediaKitSettings: MediaKitSettings = {
  blocks: { photo: true, bio: true, metrics: true, services: true, contact: true },
  accent: "#b8432f",
  indexable: false,
  showPrices: false,
};

export const creatorProfiles = pgTable(
  "creator_profiles",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name").notNull(),
    slug: text("slug").notNull(),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    country: text("country"),
    city: text("city"),
    niches: text("niches").array().notNull().default(sql`'{}'::text[]`),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    publicEmail: text("public_email"),
    publicWhatsapp: text("public_whatsapp"),
    mediaKitSettings: jsonb("media_kit_settings").$type<MediaKitSettings>().notNull().default(defaultMediaKitSettings),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("creator_profiles_slug_unique").on(table.slug),
    index("creator_profiles_workspace_idx").on(table.workspaceId),
  ],
);

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: primaryId(),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    platform: socialPlatformEnum("platform").notNull(),
    handle: text("handle").notNull(),
    externalId: text("external_id"),
    connection: socialConnectionEnum("connection").notNull().default("manual"),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: "date" }),
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    status: socialStatusEnum("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("social_accounts_profile_idx").on(table.creatorProfileId),
    uniqueIndex("social_accounts_profile_platform_handle_unique")
      .on(table.creatorProfileId, table.platform, table.handle)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export const metricSnapshots = pgTable(
  "metric_snapshots",
  {
    id: primaryId(),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    followers: integer("followers"),
    following: integer("following"),
    mediaCount: integer("media_count"),
    likesTotal: bigint("likes_total", { mode: "bigint" }),
    reach30d: bigint("reach_30d", { mode: "bigint" }),
    views30d: bigint("views_30d", { mode: "bigint" }),
    interactions30d: bigint("interactions_30d", { mode: "bigint" }),
    demographics: jsonb("demographics").$type<Record<string, unknown>>(),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [index("metric_snapshots_account_captured_idx").on(table.socialAccountId, table.capturedAt)],
);

export const posts = pgTable(
  "posts",
  {
    id: primaryId(),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    url: text("url"),
    type: text("type"),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    thumbnailUrl: text("thumbnail_url"),
    metrics: jsonb("metrics").$type<Record<string, unknown>>(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("posts_account_external_unique")
      .on(table.socialAccountId, table.externalId)
      .where(sql`${table.externalId} is not null`),
  ],
);

export const services = pgTable(
  "services",
  {
    id: primaryId(),
    creatorProfileId: uuid("creator_profile_id")
      .notNull()
      .references(() => creatorProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    platform: text("platform"),
    priceMinor: bigint("price_minor", { mode: "bigint" }),
    currency: text("currency"),
    isFromPrice: boolean("is_from_price").notNull().default(false),
    visible: boolean("visible").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("services_profile_idx").on(table.creatorProfileId)],
);
