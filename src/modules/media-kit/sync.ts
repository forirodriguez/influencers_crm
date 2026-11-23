import { and, eq, inArray, isNull } from "drizzle-orm";
import { getJobsDb, withUser } from "../../db/client";
import type { Db } from "../../db/types";
import { getInstagramAdapter, getTikTokAdapter } from "../../integrations";
import type { InstagramAdapter, InstagramMedia, InstagramProfile } from "../../integrations/instagram/adapter";
import type { TikTokAdapter, TikTokProfile, TikTokVideo } from "../../integrations/tiktok/adapter";
import { decryptString, encryptString } from "../../lib/crypto";
import { ApiError, IntegrationNotConfigured, SocialApiError } from "../../lib/errors";
import { canManualSync, demographicsForStorage, shouldSkipDailySync, tokenDue, INSTAGRAM_REFRESH_WINDOW_MS, TIKTOK_REFRESH_WINDOW_MS } from "./gate";
import { creatorProfiles, metricSnapshots, posts, socialAccounts } from "./schema";
import { requireAccount, requireProfile } from "./service";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERSONAL_MESSAGE =
  "Tu cuenta de Instagram es personal. Para conectarla: Instagram → Configuración y actividad → Tipo de cuenta y herramientas → Cambiar a cuenta profesional → Creador. Después volvé a conectar.";

type LoadedAccount = Awaited<ReturnType<typeof requireAccount>>;

export async function connectInstagram(input: {
  userId: string;
  workspaceId: string;
  profileId: string;
  code: string;
  redirectUri: string;
  adapter?: InstagramAdapter;
}): Promise<{ accountId: string }> {
  const adapter = input.adapter ?? getInstagramAdapter();
  const token = await callProvider(() => adapter.exchangeCode(input.code, input.redirectUri));
  const profile = await callProvider(() => adapter.fetchProfile(token.accessToken));
  if (profile.accountType === "PERSONAL") throw new ApiError("instagram_personal", PERSONAL_MESSAGE, 400);
  const media = profile.rateLimited ? [] : await callProvider(() => adapter.fetchRecentMedia(token.accessToken));
  return withUser(input.userId, async (db) => {
    const creator = await requireProfile(db, input.workspaceId, input.profileId);
    const accountId = await upsertApiAccount(db, {
      profileId: creator.id,
      platform: "instagram",
      handle: profile.handle,
      externalId: profile.externalId || token.externalId,
      accessToken: token.accessToken,
      refreshToken: null,
      expiresAt: token.expiresAt,
      scopes: token.scopes,
    });
    await writeInstagramSnapshot(db, accountId, profile, media);
    if (!creator.photoUrl && profile.avatarUrl) {
      await db.update(creatorProfiles).set({ photoUrl: profile.avatarUrl }).where(eq(creatorProfiles.id, creator.id));
    }
    return { accountId };
  });
}

export async function connectTikTok(input: {
  userId: string;
  workspaceId: string;
  profileId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  adapter?: TikTokAdapter;
}): Promise<{ accountId: string }> {
  const adapter = input.adapter ?? getTikTokAdapter();
  const token = await callProvider(() =>
    adapter.exchangeCode({ code: input.code, codeVerifier: input.codeVerifier, redirectUri: input.redirectUri }),
  );
  const profile = await callProvider(() => adapter.fetchProfile(token.accessToken));
  const videos = await callProvider(() => adapter.fetchRecentVideos(token.accessToken));
  return withUser(input.userId, async (db) => {
    const creator = await requireProfile(db, input.workspaceId, input.profileId);
    const accountId = await upsertApiAccount(db, {
      profileId: creator.id,
      platform: "tiktok",
      handle: profile.handle,
      externalId: profile.externalId || token.externalId,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      scopes: token.scopes,
    });
    await writeTikTokSnapshot(db, accountId, profile, videos);
    if (!creator.photoUrl && profile.avatarUrl) {
      await db.update(creatorProfiles).set({ photoUrl: profile.avatarUrl }).where(eq(creatorProfiles.id, creator.id));
    }
    return { accountId };
  });
}

export async function manualSync(input: {
  userId: string;
  workspaceId: string;
  accountId: string;
  now?: Date;
  instagram?: InstagramAdapter;
  tiktok?: TikTokAdapter;
}): Promise<void> {
  const now = input.now ?? new Date();
  const loaded = await withUser(input.userId, (db) => requireAccount(db, input.workspaceId, input.accountId));
  assertSyncable(loaded, now, true);
  const payload = await fetchPayload(loaded, { instagram: input.instagram, tiktok: input.tiktok });
  await withUser(input.userId, (db) => persistPayload(db, loaded.id, payload, now));
}

export async function syncDueAccounts(now = new Date()): Promise<{ synced: number; skipped: number; failed: number }> {
  const db = getJobsDb();
  const accounts = await db
    .select({
      id: socialAccounts.id,
      platform: socialAccounts.platform,
      connection: socialAccounts.connection,
      status: socialAccounts.status,
      accessTokenEnc: socialAccounts.accessTokenEnc,
      refreshTokenEnc: socialAccounts.refreshTokenEnc,
      tokenExpiresAt: socialAccounts.tokenExpiresAt,
      lastSyncedAt: socialAccounts.lastSyncedAt,
      creatorProfileId: socialAccounts.creatorProfileId,
      handle: socialAccounts.handle,
    })
    .from(socialAccounts)
    .where(and(eq(socialAccounts.connection, "api"), eq(socialAccounts.status, "active"), isNull(socialAccounts.deletedAt)));
  let synced = 0;
  let skipped = 0;
  let failed = 0;
  for (const account of accounts) {
    if (account.platform !== "instagram" && account.platform !== "tiktok") {
      skipped += 1;
      continue;
    }
    if (shouldSkipDailySync(account.lastSyncedAt, now) || !account.accessTokenEnc) {
      skipped += 1;
      continue;
    }
    try {
      const payload = await fetchPayload({ ...account, photoUrl: null });
      await persistPayload(db, account.id, payload, now);
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, skipped, failed };
}

export async function refreshExpiringTokens(now = new Date()): Promise<{ refreshed: number; failed: number }> {
  const db = getJobsDb();
  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.connection, "api"),
        inArray(socialAccounts.status, ["active", "expired"]),
        isNull(socialAccounts.deletedAt),
      ),
    );
  let refreshed = 0;
  let failed = 0;
  for (const account of accounts) {
    const window = account.platform === "instagram" ? INSTAGRAM_REFRESH_WINDOW_MS : account.platform === "tiktok" ? TIKTOK_REFRESH_WINDOW_MS : 0;
    const grace = account.platform === "tiktok" ? 7 * DAY_MS : DAY_MS;
    if (!window || !tokenDue(account.tokenExpiresAt, now, window, grace)) continue;
    try {
      if (account.platform === "instagram" && account.accessTokenEnc) {
        const next = await getInstagramAdapter().refreshAccessToken(decryptString(account.accessTokenEnc));
        await db
          .update(socialAccounts)
          .set({ accessTokenEnc: encryptString(next.accessToken), tokenExpiresAt: next.expiresAt, status: "active" })
          .where(eq(socialAccounts.id, account.id));
        refreshed += 1;
      } else if (account.platform === "tiktok" && account.refreshTokenEnc) {
        const next = await getTikTokAdapter().refreshAccessToken(decryptString(account.refreshTokenEnc));
        await db
          .update(socialAccounts)
          .set({
            accessTokenEnc: encryptString(next.accessToken),
            refreshTokenEnc: next.refreshToken ? encryptString(next.refreshToken) : account.refreshTokenEnc,
            tokenExpiresAt: next.expiresAt,
            status: "active",
          })
          .where(eq(socialAccounts.id, account.id));
        refreshed += 1;
      }
    } catch {
      failed += 1;
      await db.update(socialAccounts).set({ status: "expired" }).where(eq(socialAccounts.id, account.id));
    }
  }
  return { refreshed, failed };
}

type SyncPayload =
  | { platform: "instagram"; profile: InstagramProfile; media: InstagramMedia[] }
  | { platform: "tiktok"; profile: TikTokProfile; videos: TikTokVideo[] };

async function fetchPayload(
  account: LoadedAccount,
  adapters: { instagram?: InstagramAdapter; tiktok?: TikTokAdapter } = {},
): Promise<SyncPayload> {
  if (!account.accessTokenEnc) throw new ApiError("missing_token", "Volvé a conectar la cuenta", 409);
  const token = decryptString(account.accessTokenEnc);
  try {
    if (account.platform === "instagram") {
      const adapter = adapters.instagram ?? getInstagramAdapter();
      const profile = await adapter.fetchProfile(token);
      if (profile.accountType === "PERSONAL") throw new SocialApiError("instagram", "personal_account", PERSONAL_MESSAGE, 400);
      const media = profile.rateLimited ? [] : await adapter.fetchRecentMedia(token);
      return { platform: "instagram", profile, media };
    }
    if (account.platform === "tiktok") {
      const adapter = adapters.tiktok ?? getTikTokAdapter();
      const profile = await adapter.fetchProfile(token);
      const videos = await adapter.fetchRecentVideos(token);
      return { platform: "tiktok", profile, videos };
    }
    throw new ApiError("unsupported", "Esa red no se sincroniza por API", 400);
  } catch (error) {
    if (error instanceof SocialApiError && (error.code === "expired" || error.code === "personal_account")) {
      await getJobsDb()
        .update(socialAccounts)
        .set({ status: error.code === "expired" ? "expired" : "error" })
        .where(eq(socialAccounts.id, account.id));
    }
    throw mapSocialError(error);
  }
}

async function persistPayload(db: Db, accountId: string, payload: SyncPayload, now: Date): Promise<void> {
  if (payload.platform === "instagram") {
    await writeInstagramSnapshot(db, accountId, payload.profile, payload.media, now);
    return;
  }
  await writeTikTokSnapshot(db, accountId, payload.profile, payload.videos, now);
}

function assertSyncable(account: LoadedAccount, now: Date, manual: boolean): void {
  if (account.connection !== "api") throw new ApiError("manual_account", "Esta red está declarada a mano", 400);
  if (account.platform !== "instagram" && account.platform !== "tiktok") {
    throw new ApiError("unsupported", "Esa red no se sincroniza por API", 400);
  }
  if (!manual) return;
  const gate = canManualSync(account.lastSyncedAt, now);
  if (!gate.ok) {
    const minutes = Math.max(1, Math.ceil((gate.retryAt.getTime() - now.getTime()) / 60000));
    throw new ApiError("sync_rate_limited", `Podés actualizar de nuevo en ${minutes} min.`, 429);
  }
}

async function upsertApiAccount(
  db: Db,
  input: {
    profileId: string;
    platform: "instagram" | "tiktok";
    handle: string;
    externalId: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    scopes: string[];
  },
): Promise<string> {
  const handle = input.handle.trim().replace(/^@/, "").toLowerCase();
  const [existing] = await db
    .select({ id: socialAccounts.id })
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.creatorProfileId, input.profileId),
        eq(socialAccounts.platform, input.platform),
        eq(socialAccounts.handle, handle),
        isNull(socialAccounts.deletedAt),
      ),
    )
    .limit(1);
  const values = {
    externalId: input.externalId,
    connection: "api" as const,
    accessTokenEnc: encryptString(input.accessToken),
    refreshTokenEnc: input.refreshToken ? encryptString(input.refreshToken) : null,
    tokenExpiresAt: input.expiresAt,
    scopes: input.scopes,
    status: "active" as const,
    lastSyncedAt: new Date(),
  };
  if (existing) {
    await db.update(socialAccounts).set(values).where(eq(socialAccounts.id, existing.id));
    return existing.id;
  }
  const [created] = await db
    .insert(socialAccounts)
    .values({ creatorProfileId: input.profileId, platform: input.platform, handle, ...values })
    .returning({ id: socialAccounts.id });
  if (!created) throw new ApiError("forbidden", "No tenés permiso para conectar esta red", 403);
  return created.id;
}

async function writeInstagramSnapshot(db: Db, accountId: string, profile: InstagramProfile, media: InstagramMedia[], now = new Date()) {
  await db.insert(metricSnapshots).values({
    socialAccountId: accountId,
    capturedAt: now,
    followers: profile.followers,
    following: profile.following,
    mediaCount: profile.mediaCount,
    reach30d: toBigint(profile.reach30d),
    views30d: toBigint(profile.views30d),
    interactions30d: toBigint(profile.interactions30d),
    demographics: demographicsForStorage(profile.followers, profile.demographics),
    raw: { source: "instagram", demographicsStatus: profile.demographicsStatus, rateLimited: profile.rateLimited },
  });
  await db.update(socialAccounts).set({ lastSyncedAt: now, status: "active" }).where(eq(socialAccounts.id, accountId));
  await upsertPosts(
    db,
    accountId,
    media.map((item) => ({
      externalId: item.externalId,
      url: item.url,
      type: item.type,
      thumbnailUrl: item.thumbnailUrl,
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
      metrics: item.metrics,
    })),
    now,
  );
}

async function writeTikTokSnapshot(db: Db, accountId: string, profile: TikTokProfile, videos: TikTokVideo[], now = new Date()) {
  await db.insert(metricSnapshots).values({
    socialAccountId: accountId,
    capturedAt: now,
    followers: profile.followers,
    following: profile.following,
    mediaCount: profile.videoCount,
    likesTotal: toBigint(profile.likesTotal),
    raw: { source: "tiktok", audience: "unavailable" },
  });
  await db.update(socialAccounts).set({ lastSyncedAt: now, status: "active" }).where(eq(socialAccounts.id, accountId));
  await upsertPosts(
    db,
    accountId,
    videos.map((video) => ({
      externalId: video.externalId,
      url: video.url,
      type: "video",
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
      metrics: { views: video.views, likes: video.likes, comments: video.comments, shares: video.shares },
    })),
    now,
  );
}

async function upsertPosts(
  db: Db,
  accountId: string,
  items: Array<{
    externalId: string;
    url: string | null;
    type: string;
    thumbnailUrl: string | null;
    publishedAt: Date | null;
    metrics: Record<string, number>;
  }>,
  now: Date,
) {
  if (items.length === 0) return;
  const existing = await db
    .select({ id: posts.id, externalId: posts.externalId })
    .from(posts)
    .where(and(eq(posts.socialAccountId, accountId), isNull(posts.deletedAt)));
  const byExternal = new Map(existing.flatMap((row) => (row.externalId ? [[row.externalId, row.id] as const] : [])));
  for (const item of items) {
    const current = byExternal.get(item.externalId);
    const values = {
      url: item.url,
      type: item.type,
      thumbnailUrl: item.thumbnailUrl,
      publishedAt: item.publishedAt,
      metrics: item.metrics,
      fetchedAt: now,
    };
    if (current) {
      await db.update(posts).set(values).where(eq(posts.id, current));
    } else {
      await db.insert(posts).values({ socialAccountId: accountId, externalId: item.externalId, ...values });
    }
  }
}

function toBigint(value: number | null): bigint | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  return BigInt(Math.trunc(value));
}

async function callProvider<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw mapSocialError(error);
  }
}

function mapSocialError(error: unknown): Error {
  if (error instanceof ApiError) return error;
  if (error instanceof SocialApiError) {
    if (error.code === "personal_account") return new ApiError("instagram_personal", PERSONAL_MESSAGE, 400);
    if (error.code === "rate_limited") {
      const name = error.integration === "instagram" ? "Instagram" : "TikTok";
      return new ApiError("provider_rate_limited", `${name} limitó las consultas. Probá más tarde.`, 429);
    }
    if (error.code === "expired") return new ApiError("token_expired", "El acceso venció. Volvé a conectar la cuenta.", 409);
    return new ApiError("provider_error", error.message, 502);
  }
  if (error instanceof IntegrationNotConfigured) return new ApiError("not_configured", error.message, 503);
  if (error instanceof Error) return error;
  return new Error("Error de red");
}
