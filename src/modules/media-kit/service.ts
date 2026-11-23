import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/types";
import { ApiError, isUniqueViolation } from "../../lib/errors";
import { isCurrency } from "../../lib/constants";
import { majorToMinor } from "../../lib/money";
import { toE164 } from "../../lib/phone";
import { isReservedSlug, slugify } from "../../lib/slug";
import { creatorProfiles, metricSnapshots, services, socialAccounts, type MediaKitSettings } from "./schema";
import { defaultMediaKitSettings } from "./schema";
import { httpUrlOrEmpty, normalizeSettings } from "./settings";

const PLATFORMS = new Set(["instagram", "tiktok", "youtube", "other"]);

export type ProfileInput = {
  displayName: string;
  slug: string;
  bio: string | null;
  photoUrl: string | null;
  country: string | null;
  city: string | null;
  niches: string[];
  languages: string[];
  publicEmail: string | null;
  publicWhatsapp: string | null;
  settings: MediaKitSettings;
};

export async function createCreatorProfile(
  db: Db,
  input: { workspaceId: string; displayName: string; country: string | null },
): Promise<string> {
  const displayName = input.displayName.trim();
  if (displayName.length < 2 || displayName.length > 80) {
    throw new ApiError("invalid_name", "El nombre artístico tiene que tener entre 2 y 80 caracteres", 400);
  }
  const slug = await uniqueSlug(db, displayName);
  try {
    const [created] = await db
      .insert(creatorProfiles)
      .values({
        workspaceId: input.workspaceId,
        displayName,
        slug,
        country: cleanCountry(input.country),
        languages: ["es"],
        niches: [],
        mediaKitSettings: defaultMediaKitSettings,
      })
      .returning({ id: creatorProfiles.id });
    if (!created) throw new ApiError("forbidden", "No tenés permiso para crear un perfil", 403);
    return created.id;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError("slug_taken", "Ese link ya está usado", 409);
    throw error;
  }
}

export async function updateCreatorProfile(
  db: Db,
  input: { workspaceId: string; profileId: string; patch: ProfileInput },
): Promise<void> {
  const existing = await requireProfile(db, input.workspaceId, input.profileId);
  const displayName = input.patch.displayName.trim();
  if (displayName.length < 2 || displayName.length > 80) {
    throw new ApiError("invalid_name", "El nombre artístico tiene que tener entre 2 y 80 caracteres", 400);
  }
  const slug = input.patch.slug.trim().toLowerCase();
  assertSlug(slug);
  const bio = blankToNull(input.patch.bio);
  if (bio && bio.length > 280) throw new ApiError("bio_too_long", "La bio puede tener hasta 280 caracteres", 400);
  const country = cleanCountry(input.patch.country);
  const photoUrl = cleanUrl(input.patch.photoUrl, "La foto tiene que ser un link http(s)");
  const publicEmail = cleanEmail(input.patch.publicEmail);
  const publicWhatsapp = cleanPhone(input.patch.publicWhatsapp, country ?? existing.country);
  const settings = cleanSettings(input.patch.settings);
  try {
    const [updated] = await db
      .update(creatorProfiles)
      .set({
        displayName,
        slug,
        bio,
        photoUrl,
        country,
        city: blankToNull(input.patch.city)?.slice(0, 80) ?? null,
        niches: cleanList(input.patch.niches, 12, 40),
        languages: cleanList(input.patch.languages, 6, 12),
        publicEmail,
        publicWhatsapp,
        mediaKitSettings: settings,
      })
      .where(and(eq(creatorProfiles.id, input.profileId), eq(creatorProfiles.workspaceId, input.workspaceId), isNull(creatorProfiles.deletedAt)))
      .returning({ id: creatorProfiles.id });
    if (!updated) throw new ApiError("forbidden", "No tenés permiso para editar este media kit", 403);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isUniqueViolation(error)) throw new ApiError("slug_taken", "Ese link ya está usado", 409);
    throw error;
  }
}

export async function saveService(
  db: Db,
  input: {
    workspaceId: string;
    profileId: string;
    serviceId?: string;
    name: string;
    platform: string | null;
    price: string | null;
    currency: string | null;
    isFromPrice: boolean;
    visible: boolean;
  },
): Promise<string> {
  await requireProfile(db, input.workspaceId, input.profileId);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) throw new ApiError("invalid_service", "El servicio necesita un nombre", 400);
  const priceText = input.price?.trim() ?? "";
  let priceMinor: bigint | null = null;
  let currency: string | null = null;
  if (priceText) {
    if (!input.currency || !isCurrency(input.currency)) throw new ApiError("invalid_currency", "Elegí una moneda", 400);
    try {
      priceMinor = majorToMinor(priceText, input.currency);
    } catch {
      throw new ApiError("invalid_price", "El precio tiene que ser un número, sin separador de miles", 400);
    }
    currency = input.currency;
  }
  const platform = blankToNull(input.platform)?.slice(0, 40) ?? null;
  if (input.serviceId) {
    const [updated] = await db
      .update(services)
      .set({ name, platform, priceMinor, currency, isFromPrice: input.isFromPrice, visible: input.visible })
      .where(and(eq(services.id, input.serviceId), eq(services.creatorProfileId, input.profileId), isNull(services.deletedAt)))
      .returning({ id: services.id });
    if (!updated) throw new ApiError("not_found", "No encontramos ese servicio", 404);
    return updated.id;
  }
  const [created] = await db
    .insert(services)
    .values({ creatorProfileId: input.profileId, name, platform, priceMinor, currency, isFromPrice: input.isFromPrice, visible: input.visible })
    .returning({ id: services.id });
  if (!created) throw new ApiError("forbidden", "No tenés permiso para cargar servicios", 403);
  return created.id;
}

export async function removeService(db: Db, input: { workspaceId: string; profileId: string; serviceId: string }): Promise<void> {
  await requireProfile(db, input.workspaceId, input.profileId);
  const [visible] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.creatorProfileId, input.profileId), isNull(services.deletedAt)))
    .limit(1);
  if (!visible) throw new ApiError("not_found", "No encontramos ese servicio", 404);
  await db.delete(services).where(eq(services.id, input.serviceId));
}

export async function addManualAccount(
  db: Db,
  input: {
    workspaceId: string;
    profileId: string;
    platform: string;
    handle: string;
    followers: number | null;
    following: number | null;
    mediaCount: number | null;
    likesTotal: string | null;
  },
): Promise<string> {
  await requireProfile(db, input.workspaceId, input.profileId);
  if (!PLATFORMS.has(input.platform)) throw new ApiError("invalid_platform", "Esa red no está soportada", 400);
  const handle = normalizeHandle(input.handle);
  if (!handle) throw new ApiError("invalid_handle", "Falta el usuario de la red", 400);
  try {
    const [created] = await db
      .insert(socialAccounts)
      .values({
        creatorProfileId: input.profileId,
        platform: input.platform as "instagram" | "tiktok" | "youtube" | "other",
        handle,
        connection: "manual",
        status: "active",
        lastSyncedAt: new Date(),
      })
      .returning({ id: socialAccounts.id });
    if (!created) throw new ApiError("forbidden", "No tenés permiso para cargar redes", 403);
    await recordDeclaredSnapshot(db, created.id, input);
    return created.id;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (isUniqueViolation(error)) throw new ApiError("account_exists", "Esa red ya está cargada", 409);
    throw error;
  }
}

export async function updateManualAccount(
  db: Db,
  input: {
    workspaceId: string;
    accountId: string;
    followers: number | null;
    following: number | null;
    mediaCount: number | null;
    likesTotal: string | null;
  },
): Promise<void> {
  const account = await requireAccount(db, input.workspaceId, input.accountId);
  if (account.connection !== "manual") {
    throw new ApiError("api_account", "Las métricas conectadas se actualizan desde la red, no a mano", 400);
  }
  await recordDeclaredSnapshot(db, account.id, input);
  await db.update(socialAccounts).set({ lastSyncedAt: new Date() }).where(eq(socialAccounts.id, account.id));
}

export async function disconnectAccount(db: Db, input: { workspaceId: string; accountId: string }): Promise<void> {
  const account = await requireAccount(db, input.workspaceId, input.accountId);
  const [cleared] = await db
    .update(socialAccounts)
    .set({ accessTokenEnc: null, refreshTokenEnc: null, tokenExpiresAt: null, status: "revoked" })
    .where(and(eq(socialAccounts.id, account.id), isNull(socialAccounts.deletedAt)))
    .returning({ id: socialAccounts.id });
  if (!cleared) throw new ApiError("forbidden", "No tenés permiso para desconectar esta red", 403);
  // Un update que pone deleted_at no pasa la política de lectura. El delete sí, y se lleva el token.
  await db.delete(socialAccounts).where(eq(socialAccounts.id, account.id));
}

export async function requireProfile(db: Db, workspaceId: string, profileId: string) {
  const [profile] = await db
    .select()
    .from(creatorProfiles)
    .where(and(eq(creatorProfiles.id, profileId), eq(creatorProfiles.workspaceId, workspaceId), isNull(creatorProfiles.deletedAt)))
    .limit(1);
  if (!profile) throw new ApiError("not_found", "No encontramos ese perfil", 404);
  return profile;
}

export async function requireAccount(db: Db, workspaceId: string, accountId: string) {
  const [row] = await db
    .select({
      id: socialAccounts.id,
      creatorProfileId: socialAccounts.creatorProfileId,
      platform: socialAccounts.platform,
      handle: socialAccounts.handle,
      connection: socialAccounts.connection,
      status: socialAccounts.status,
      accessTokenEnc: socialAccounts.accessTokenEnc,
      refreshTokenEnc: socialAccounts.refreshTokenEnc,
      tokenExpiresAt: socialAccounts.tokenExpiresAt,
      lastSyncedAt: socialAccounts.lastSyncedAt,
      photoUrl: creatorProfiles.photoUrl,
    })
    .from(socialAccounts)
    .innerJoin(creatorProfiles, eq(creatorProfiles.id, socialAccounts.creatorProfileId))
    .where(
      and(
        eq(socialAccounts.id, accountId),
        eq(creatorProfiles.workspaceId, workspaceId),
        isNull(socialAccounts.deletedAt),
        isNull(creatorProfiles.deletedAt),
      ),
    )
    .limit(1);
  if (!row) throw new ApiError("not_found", "No encontramos esa red", 404);
  return row;
}

export async function recordDeclaredSnapshot(
  db: Db,
  accountId: string,
  input: { followers: number | null; following: number | null; mediaCount: number | null; likesTotal: string | null },
): Promise<void> {
  await db.insert(metricSnapshots).values({
    socialAccountId: accountId,
    followers: positiveInt(input.followers),
    following: positiveInt(input.following),
    mediaCount: positiveInt(input.mediaCount),
    likesTotal: positiveBigint(input.likesTotal),
    raw: { source: "declared" },
  });
}

function positiveInt(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.trunc(value), 2_000_000_000);
}

function positiveBigint(value: string | null): bigint | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

function assertSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 48) {
    throw new ApiError("invalid_slug", "El link solo puede tener minúsculas, números y guiones", 400);
  }
  if (isReservedSlug(slug)) throw new ApiError("reserved_slug", "Ese link está reservado", 400);
}

async function uniqueSlug(db: Db, displayName: string): Promise<string> {
  const base = slugify(displayName);
  let candidate = isReservedSlug(base) ? `${base}-creator` : base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const existing = await db.select({ id: creatorProfiles.id }).from(creatorProfiles).where(eq(creatorProfiles.slug, candidate)).limit(1);
    if (existing.length === 0 && !isReservedSlug(candidate)) return candidate;
    candidate = `${base}-${randomBytes(2).toString("hex")}`;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function cleanCountry(value: string | null): string | null {
  const country = blankToNull(value)?.toUpperCase() ?? null;
  if (!country) return null;
  if (!["AR", "MX", "CO", "UY"].includes(country)) throw new ApiError("invalid_country", "Elegí un país de la lista", 400);
  return country;
}

function cleanEmail(value: string | null): string | null {
  const email = blankToNull(value)?.toLowerCase() ?? null;
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError("invalid_email", "El email público no es válido", 400);
  return email;
}

function cleanPhone(value: string | null, country: string | null): string | null {
  const raw = blankToNull(value);
  if (!raw) return null;
  const phone = toE164(raw, country === "AR" || country === "MX" || country === "CO" || country === "UY" ? country : undefined);
  if (!phone) throw new ApiError("invalid_phone", "El WhatsApp público tiene que estar en formato internacional", 400);
  return phone;
}

function cleanUrl(value: string | null, message: string): string | null {
  const raw = blankToNull(value);
  if (!raw) return null;
  try {
    return httpUrlOrEmpty(raw);
  } catch {
    throw new ApiError("invalid_url", message, 400);
  }
}

function cleanList(values: string[], max: number, itemMax: number): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    unique.add(trimmed.slice(0, itemMax));
    if (unique.size >= max) break;
  }
  return [...unique];
}

function cleanSettings(settings: MediaKitSettings): MediaKitSettings {
  const normalized = normalizeSettings(settings);
  return {
    ...normalized,
    featured: normalized.featured.map((item) => ({
      ...item,
      logoUrl: item.logoUrl ? cleanUrl(item.logoUrl, "El logo tiene que ser un link http(s)") ?? "" : "",
    })),
  };
}

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase().replace(/\s+/g, "");
}
