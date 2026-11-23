import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getAppDb } from "../../db/client";
import type { Db } from "../../db/types";
import { INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS } from "../../integrations/instagram/adapter";
import { creatorProfiles, metricSnapshots, services, socialAccounts } from "./schema";
import { normalizeSettings } from "./settings";
import type { EditorAccount, EditorProfile, EditorService, PublicAccount, PublicMediaKit, PublicPost, PublicService } from "./types";

export type { PublicMediaKit } from "./types";

export async function getPublicMediaKit(slug: string): Promise<PublicMediaKit | null> {
  const result = await getAppDb().execute<{ kit: unknown }>(sql`select app.get_public_media_kit(${slug}) as kit`);
  const rows = result as unknown as Array<{ kit: unknown }>;
  return normalizePublicKit(rows[0]?.kit);
}

export async function listWorkspaceProfiles(db: Db, workspaceId: string): Promise<EditorProfile[]> {
  const profiles = await db
    .select()
    .from(creatorProfiles)
    .where(and(eq(creatorProfiles.workspaceId, workspaceId), isNull(creatorProfiles.deletedAt)))
    .orderBy(desc(creatorProfiles.createdAt));
  if (profiles.length === 0) return [];

  const profileIds = profiles.map((profile) => profile.id);
  const accounts = await db
    .select({
      id: socialAccounts.id,
      creatorProfileId: socialAccounts.creatorProfileId,
      platform: socialAccounts.platform,
      handle: socialAccounts.handle,
      connection: socialAccounts.connection,
      status: socialAccounts.status,
      lastSyncedAt: socialAccounts.lastSyncedAt,
    })
    .from(socialAccounts)
    .where(and(inArray(socialAccounts.creatorProfileId, profileIds), isNull(socialAccounts.deletedAt)));

  const accountIds = accounts.map((account) => account.id);
  const snapshots =
    accountIds.length === 0
      ? []
      : await db
          .select()
          .from(metricSnapshots)
          .where(and(inArray(metricSnapshots.socialAccountId, accountIds), isNull(metricSnapshots.deletedAt)))
          .orderBy(desc(metricSnapshots.capturedAt));
  const latest = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) {
    if (!latest.has(snapshot.socialAccountId)) latest.set(snapshot.socialAccountId, snapshot);
  }

  const serviceRows = await db
    .select()
    .from(services)
    .where(and(inArray(services.creatorProfileId, profileIds), isNull(services.deletedAt)))
    .orderBy(services.createdAt);

  return profiles.map((profile) => ({
    id: profile.id,
    displayName: profile.displayName,
    slug: profile.slug,
    bio: profile.bio,
    photoUrl: profile.photoUrl,
    country: profile.country,
    city: profile.city,
    niches: profile.niches,
    languages: profile.languages,
    publicEmail: profile.publicEmail,
    publicWhatsapp: profile.publicWhatsapp,
    settings: normalizeSettings(profile.mediaKitSettings),
    services: serviceRows.filter((service) => service.creatorProfileId === profile.id).map(toEditorService),
    accounts: accounts
      .filter((account) => account.creatorProfileId === profile.id)
      .map((account) => toEditorAccount(account, latest.get(account.id))),
  }));
}

export async function listCreatorProfiles(db: Db, workspaceId: string): Promise<EditorProfile[]> {
  return listWorkspaceProfiles(db, workspaceId);
}

function toEditorService(service: typeof services.$inferSelect): EditorService {
  return {
    id: service.id,
    name: service.name,
    platform: service.platform,
    priceMinor: service.priceMinor === null ? null : service.priceMinor.toString(),
    currency: service.currency,
    isFromPrice: service.isFromPrice,
    visible: service.visible,
  };
}

function toEditorAccount(
  account: {
    id: string;
    platform: string;
    handle: string;
    connection: "api" | "manual";
    status: string;
    lastSyncedAt: Date | null;
  },
  snapshot: typeof metricSnapshots.$inferSelect | undefined,
): EditorAccount {
  const followers = snapshot?.followers ?? null;
  const hidden = account.platform === "instagram" && (followers ?? 0) < INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS;
  return {
    id: account.id,
    platform: account.platform,
    handle: account.handle,
    connection: account.connection,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null,
    followers,
    following: snapshot?.following ?? null,
    mediaCount: snapshot?.mediaCount ?? null,
    likesTotal: snapshot?.likesTotal == null ? null : snapshot.likesTotal.toString(),
    reach30d: snapshot?.reach30d == null ? null : snapshot.reach30d.toString(),
    views30d: snapshot?.views30d == null ? null : snapshot.views30d.toString(),
    interactions30d: snapshot?.interactions30d == null ? null : snapshot.interactions30d.toString(),
    demographics: hidden ? null : (snapshot?.demographics ?? null),
    demographicsHidden: hidden,
  };
}

export function normalizePublicKit(value: unknown): PublicMediaKit | null {
  const record = asRecord(value);
  if (!record || typeof record.slug !== "string" || typeof record.displayName !== "string") return null;
  const accounts = Array.isArray(record.accounts) ? record.accounts.map(readAccount).filter((item) => item !== null) : [];
  const serviceRows = Array.isArray(record.services) ? record.services.map(readService).filter((item) => item !== null) : [];
  return {
    slug: record.slug,
    displayName: record.displayName,
    bio: textOrNull(record.bio),
    photoUrl: textOrNull(record.photoUrl),
    country: textOrNull(record.country),
    city: textOrNull(record.city),
    niches: stringList(record.niches),
    languages: stringList(record.languages),
    publicEmail: textOrNull(record.publicEmail),
    publicWhatsapp: textOrNull(record.publicWhatsapp),
    settings: normalizeSettings(record.settings),
    services: serviceRows,
    accounts,
  };
}

function readAccount(value: unknown): PublicAccount | null {
  const record = asRecord(value);
  if (!record || typeof record.platform !== "string" || typeof record.handle !== "string") return null;
  const followers = intOrNull(record.followers);
  const hidden = record.platform === "instagram" && (followers ?? 0) < INSTAGRAM_DEMOGRAPHICS_MIN_FOLLOWERS;
  return {
    platform: record.platform,
    handle: record.handle,
    connection: record.connection === "api" ? "api" : "manual",
    followers,
    following: intOrNull(record.following),
    mediaCount: intOrNull(record.mediaCount),
    likesTotal: textOrNull(record.likesTotal),
    reach30d: textOrNull(record.reach30d),
    views30d: textOrNull(record.views30d),
    interactions30d: textOrNull(record.interactions30d),
    demographics: hidden ? null : (record.demographics ?? null),
    capturedAt: record.capturedAt == null ? null : String(record.capturedAt),
    posts: Array.isArray(record.posts) ? record.posts.map(readPost).filter((item) => item !== null) : [],
  };
}

function readPost(value: unknown): PublicPost | null {
  const record = asRecord(value);
  if (!record) return null;
  const metrics = record.metrics && typeof record.metrics === "object" ? (record.metrics as Record<string, unknown>) : {};
  const numbers: Record<string, number> = {};
  for (const [key, metric] of Object.entries(metrics)) {
    if (typeof metric === "number" && Number.isFinite(metric)) numbers[key] = metric;
  }
  return {
    url: textOrNull(record.url),
    type: textOrNull(record.type),
    thumbnailUrl: textOrNull(record.thumbnailUrl),
    publishedAt: record.publishedAt == null ? null : String(record.publishedAt),
    metrics: numbers,
  };
}

function readService(value: unknown): PublicService | null {
  const record = asRecord(value);
  if (!record || typeof record.name !== "string") return null;
  return {
    name: record.name,
    platform: textOrNull(record.platform),
    priceMinor: record.priceMinor == null ? null : String(record.priceMinor),
    currency: textOrNull(record.currency),
    isFromPrice: record.isFromPrice === true,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function intOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
