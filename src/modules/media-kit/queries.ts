import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getAppDb } from "../../db/client";
import type { Db } from "../../db/types";
import { creatorProfiles, metricSnapshots, services, socialAccounts, type MediaKitSettings } from "./schema";

export type PublicMediaKit = {
  slug: string;
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  country: string | null;
  city: string | null;
  niches: string[];
  languages: string[];
  publicEmail: string | null;
  publicWhatsapp: string | null;
  settings: MediaKitSettings;
  services: Array<{
    name: string;
    platform: string | null;
    priceMinor: string | null;
    currency: string | null;
    isFromPrice: boolean;
  }>;
  accounts: Array<{
    platform: string;
    handle: string;
    connection: string;
    followers: number | null;
    reach30d: string | null;
    views30d: string | null;
    capturedAt: string | null;
  }>;
};

export async function getPublicMediaKit(slug: string): Promise<PublicMediaKit | null> {
  const result = await getAppDb().execute<{ kit: PublicMediaKit | null }>(
    sql`select app.get_public_media_kit(${slug}) as kit`,
  );
  const rows = result as unknown as Array<{ kit: PublicMediaKit | null }>;
  return rows[0]?.kit ?? null;
}

export async function listCreatorProfiles(db: Db, workspaceId: string) {
  const profiles = await db
    .select()
    .from(creatorProfiles)
    .where(and(eq(creatorProfiles.workspaceId, workspaceId), isNull(creatorProfiles.deletedAt)))
    .orderBy(desc(creatorProfiles.createdAt));

  const profileIds = profiles.map((profile) => profile.id);
  if (profileIds.length === 0) return [];

  const accounts = await db
    .select({
      id: socialAccounts.id,
      creatorProfileId: socialAccounts.creatorProfileId,
      platform: socialAccounts.platform,
      handle: socialAccounts.handle,
      connection: socialAccounts.connection,
      status: socialAccounts.status,
      followers: metricSnapshots.followers,
    })
    .from(socialAccounts)
    .leftJoin(metricSnapshots, eq(metricSnapshots.socialAccountId, socialAccounts.id))
    .where(and(isNull(socialAccounts.deletedAt)));

  const serviceRows = await db.select().from(services).where(isNull(services.deletedAt));

  return profiles.map((profile) => ({
    ...profile,
    accounts: accounts.filter((account) => account.creatorProfileId === profile.id),
    services: serviceRows.filter((service) => service.creatorProfileId === profile.id && service.deletedAt === null),
  }));
}
