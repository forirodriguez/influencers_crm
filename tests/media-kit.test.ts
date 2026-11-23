import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { closePools, getJobsDb, withAdmin, withUser } from "../src/db/client";
import { truncatePublicTables } from "../src/db/truncate";
import { encryptString } from "../src/lib/crypto";
import { ApiError } from "../src/lib/errors";
import type { InstagramAdapter, InstagramProfile } from "../src/integrations/instagram/adapter";
import { registerWithPassword } from "../src/modules/identity/service";
import { memberships } from "../src/modules/identity/schema";
import { getPublicMediaKit, listWorkspaceProfiles } from "../src/modules/media-kit/queries";
import { metricSnapshots, socialAccounts } from "../src/modules/media-kit/schema";
import { disconnectAccount, saveService, updateCreatorProfile } from "../src/modules/media-kit/service";
import { connectInstagram, manualSync, refreshExpiringTokens, syncDueAccounts } from "../src/modules/media-kit/sync";

beforeEach(async () => {
  const admin = postgres(process.env.DATABASE_URL!, { max: 1 });
  await truncatePublicTables(admin);
  await admin.end();
});

afterAll(async () => {
  await closePools();
});

async function creator(email: string, country: "AR" | "MX" | "CO" | "UY" = "AR") {
  const registered = await registerWithPassword({
    name: "Cami Test",
    email,
    password: "password123",
    country,
    acceptTerms: true,
  });
  const profiles = await withUser(registered.userId, (db) => listWorkspaceProfiles(db, registered.workspaceId));
  const profile = profiles[0];
  if (!profile) throw new Error("falta el perfil");
  return { ...registered, profile };
}

const baseProfile = {
  externalId: "ig-1",
  handle: "cami.test",
  accountType: "MEDIA_CREATOR" as const,
  avatarUrl: null,
  followers: 40,
  following: 10,
  mediaCount: 4,
  reach30d: 20,
  views30d: 30,
  interactions30d: 5,
  demographics: { countries: [{ label: "AR", share: 1 }], cities: [], ages: [], genders: [] },
  demographicsStatus: "under_100" as const,
  rateLimited: false,
};

function adapterFor(profile: InstagramProfile): InstagramAdapter {
  return {
    getAuthorizationUrl: () => "https://www.instagram.com/oauth/authorize",
    exchangeCode: async () => ({ accessToken: "secret-ig-token", expiresAt: new Date("2027-01-01T00:00:00Z"), externalId: profile.externalId, scopes: ["instagram_business_basic"] }),
    refreshAccessToken: async (accessToken) => ({ accessToken, expiresAt: new Date("2027-06-01T00:00:00Z") }),
    fetchProfile: async () => profile,
    fetchRecentMedia: async () => [
      { externalId: "post-1", url: "https://instagram.com/p/abc", type: "reel", thumbnailUrl: null, publishedAt: "2026-11-01T12:00:00.000Z", metrics: { views: 100, likes: 8 } },
    ],
  };
}

describe("media kit", () => {
  it("guarda el perfil, oculta precios y publica el link", async () => {
    const cami = await creator("cami-kit@example.com");
    await withUser(cami.userId, (db) =>
      updateCreatorProfile(db, {
        workspaceId: cami.workspaceId,
        profileId: cami.profile.id,
        patch: {
          displayName: "Cami Gómez",
          slug: "cami-gomez-test",
          bio: "Belleza cotidiana.",
          photoUrl: null,
          country: "AR",
          city: "Buenos Aires",
          niches: ["belleza", "skincare"],
          languages: ["es"],
          publicEmail: "hola@example.com",
          publicWhatsapp: "+54 9 11 5555 0101",
          settings: {
            ...cami.profile.settings,
            showPrices: false,
            featured: [{ id: "bruma", brand: "Bruma", logoUrl: "https://cdn.example/bruma.png", detail: "Reel serum" }],
            declaredAudience: { summary: "Mayoría en AMBA", countries: [{ label: "Argentina", share: 0.8 }], ages: [], genders: [] },
          },
        },
      }),
    );
    await withUser(cami.userId, (db) =>
      saveService(db, {
        workspaceId: cami.workspaceId,
        profileId: cami.profile.id,
        name: "Reel 30–60 s",
        platform: "instagram",
        price: "450000",
        currency: "ARS",
        isFromPrice: true,
        visible: true,
      }),
    );
    const kit = await getPublicMediaKit("cami-gomez-test");
    expect(kit?.displayName).toBe("Cami Gómez");
    expect(kit?.publicWhatsapp).toBe("+5491155550101");
    expect(kit?.settings.showPrices).toBe(false);
    expect(kit?.settings.featured[0]?.brand).toBe("Bruma");
    expect(kit?.settings.declaredAudience?.summary).toBe("Mayoría en AMBA");
    expect(kit?.services[0]?.priceMinor).toBe("45000000");
    expect(JSON.stringify(kit)).not.toContain("accessToken");
  });

  it("conecta Instagram en mock, esconde la audiencia chica y borra el token al desconectar", async () => {
    const cami = await creator("cami-ig@example.com");
    const connected = await connectInstagram({
      userId: cami.userId,
      workspaceId: cami.workspaceId,
      profileId: cami.profile.id,
      code: "mock",
      redirectUri: "http://localhost:3000/api/v1/social/instagram/callback",
      adapter: adapterFor(baseProfile),
    });
    const kit = await getPublicMediaKit(cami.profile.slug);
    const account = kit?.accounts.find((item) => item.handle === "cami.test");
    expect(account?.connection).toBe("api");
    expect(account?.followers).toBe(40);
    expect(account?.demographics).toBeNull();
    expect(account?.posts[0]?.metrics.views).toBe(100);
    expect(JSON.stringify(kit)).not.toContain("secret-ig-token");

    const stored = await getJobsDb().select().from(socialAccounts).where(eq(socialAccounts.id, connected.accountId));
    expect(stored[0]?.accessTokenEnc?.startsWith("v1.")).toBe(true);
    expect(stored[0]?.accessTokenEnc).not.toContain("secret-ig-token");

    await expect(
      manualSync({
        userId: cami.userId,
        workspaceId: cami.workspaceId,
        accountId: connected.accountId,
        now: new Date(),
        instagram: adapterFor({ ...baseProfile, followers: 150, demographicsStatus: "available" }),
      }),
    ).rejects.toMatchObject({ code: "sync_rate_limited" });

    await withUser(cami.userId, (db) => disconnectAccount(db, { workspaceId: cami.workspaceId, accountId: connected.accountId }));
    const gone = await getJobsDb().select().from(socialAccounts).where(eq(socialAccounts.id, connected.accountId));
    expect(gone).toHaveLength(0);
    expect((await getPublicMediaKit(cami.profile.slug))?.accounts.find((item) => item.handle === "cami.test")).toBeUndefined();
  });

  it("muestra la demografía recién desde 100 seguidores", async () => {
    const cami = await creator("cami-demo@example.com");
    await connectInstagram({
      userId: cami.userId,
      workspaceId: cami.workspaceId,
      profileId: cami.profile.id,
      code: "mock",
      redirectUri: "http://localhost/callback",
      adapter: adapterFor({
        ...baseProfile,
        handle: "cami.grande",
        followers: 180,
        demographicsStatus: "available",
        demographics: { countries: [{ label: "AR", share: 0.7 }], cities: [{ label: "Buenos Aires", share: 0.4 }], ages: [], genders: [] },
      }),
    });
    const kit = await getPublicMediaKit(cami.profile.slug);
    const demographics = kit?.accounts.find((item) => item.handle === "cami.grande")?.demographics as { countries?: unknown[] };
    expect(demographics.countries?.length).toBeGreaterThan(0);
  });

  it("el sync diario y la renovación usan el rol de jobs", async () => {
    const cami = await creator("cami-job@example.com");
    await withUser(cami.userId, async (db) => {
      await db.insert(socialAccounts).values({
        creatorProfileId: cami.profile.id,
        platform: "instagram",
        handle: "job.cami",
        connection: "api",
        status: "active",
        accessTokenEnc: encryptString("job-token"),
        tokenExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
    });
    const synced = await syncDueAccounts(new Date("2026-11-23T07:00:00Z"));
    expect(synced.synced).toBe(1);
    const snapshots = await getJobsDb().select().from(metricSnapshots);
    expect(snapshots.some((row) => row.followers === 35200)).toBe(true);
    const refreshed = await refreshExpiringTokens(new Date());
    expect(refreshed.refreshed).toBe(1);
    const [account] = await getJobsDb().select().from(socialAccounts);
    expect(account?.tokenExpiresAt && account.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 20 * 24 * 60 * 60 * 1000);
  });

  it("no guarda una cuenta personal y un viewer no edita", async () => {
    const cami = await creator("cami-personal@example.com");
    const personal = adapterFor({ ...baseProfile, accountType: "PERSONAL", handle: "personal.cami" });
    await expect(
      connectInstagram({
        userId: cami.userId,
        workspaceId: cami.workspaceId,
        profileId: cami.profile.id,
        code: "x",
        redirectUri: "http://localhost/callback",
        adapter: personal,
      }),
    ).rejects.toBeInstanceOf(ApiError);
    const accounts = await withUser(cami.userId, (db) => db.select().from(socialAccounts));
    expect(accounts).toHaveLength(0);

    const viewer = await registerWithPassword({
      name: "Lector",
      email: "lector-kit@example.com",
      password: "password123",
      country: "AR",
      acceptTerms: true,
    });
    await withAdmin(async (db) => {
      await db.insert(memberships).values({ workspaceId: cami.workspaceId, userId: viewer.userId, role: "viewer", acceptedAt: new Date() });
    });
    await expect(
      withUser(viewer.userId, (db) =>
        updateCreatorProfile(db, {
          workspaceId: cami.workspaceId,
          profileId: cami.profile.id,
          patch: { ...cami.profile, displayName: "No", slug: "no-deberia", bio: null, photoUrl: null, country: "AR", city: null, publicEmail: null, publicWhatsapp: null },
        }),
      ),
    ).rejects.toThrow();
  });
});
