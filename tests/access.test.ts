import { afterAll, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { closePools, getAppDb, getJobsDb, withAdmin, withUser } from "../src/db/client";
import { truncatePublicTables } from "../src/db/truncate";
import { brands } from "../src/modules/crm/schema";
import { memberships } from "../src/modules/identity/schema";
import { createAgencyWorkspace, registerWithPassword } from "../src/modules/identity/service";
import { getPublicMediaKit } from "../src/modules/media-kit/queries";

beforeEach(async () => {
  const admin = postgres(process.env.DATABASE_URL!, { max: 1 });
  await truncatePublicTables(admin);
  await admin.end();
});

afterAll(async () => {
  await closePools();
});

describe("acceso por workspace", () => {
  it("registra un workspace personal y aísla las filas", async () => {
    const cami = await registerWithPassword({
      name: "Cami Test",
      email: "cami-test@example.com",
      password: "password123",
      country: "AR",
      acceptTerms: true,
    });
    const diego = await registerWithPassword({
      name: "Diego Test",
      email: "diego-test@example.com",
      password: "password123",
      country: "MX",
      acceptTerms: true,
    });

    await withUser(cami.userId, async (db) => {
      await db.insert(brands).values({
        workspaceId: cami.workspaceId,
        name: "Bruma Belleza",
        nameNormalized: "bruma belleza",
        country: "AR",
      });
    });

    const visibleToDiego = await withUser(diego.userId, async (db) => db.select().from(brands));
    expect(visibleToDiego).toHaveLength(0);

    const visibleToCami = await withUser(cami.userId, async (db) => db.select().from(brands));
    expect(visibleToCami.map((brand) => brand.name)).toEqual(["Bruma Belleza"]);

    await expect(
      withUser(diego.userId, async (db) =>
        db.insert(brands).values({
          workspaceId: cami.workspaceId,
          name: "Intrusa",
          nameNormalized: "intrusa",
        }),
      ),
    ).rejects.toThrow();

    const asJobs = await getJobsDb().select().from(brands);
    expect(asJobs).toHaveLength(1);
    const anonymous = await getAppDb().select().from(brands);
    expect(anonymous).toHaveLength(0);
  });

  it("un viewer no puede escribir y app_user no lee contraseñas", async () => {
    const owner = await registerWithPassword({
      name: "Valen Test",
      email: "valen-test@example.com",
      password: "password123",
      country: "UY",
      acceptTerms: true,
    });
    const viewer = await registerWithPassword({
      name: "Lector Test",
      email: "lector-test@example.com",
      password: "password123",
      country: "UY",
      acceptTerms: true,
    });
    const agency = await createAgencyWorkspace(owner.userId, "Estudio Test");
    await withAdmin(async (db) => {
      await db.insert(memberships).values({
        workspaceId: agency.workspaceId,
        userId: viewer.userId,
        role: "viewer",
        acceptedAt: new Date(),
      });
    });

    await expect(
      withUser(viewer.userId, async (db) =>
        db.insert(brands).values({
          workspaceId: agency.workspaceId,
          name: "No debería",
          nameNormalized: "no deberia",
        }),
      ),
    ).rejects.toThrow();

    const app = postgres(process.env.DATABASE_URL_APP!, { max: 1 });
    await expect(app`select * from auth_credentials`).rejects.toThrow();
    await app.end();
  });

  it("el media kit público no requiere sesión", async () => {
    const creator = await registerWithPassword({
      name: "Nati Test",
      email: "nati-test@example.com",
      password: "password123",
      country: "CO",
      acceptTerms: true,
    });
    const [profile] = await withUser(creator.userId, async (db) => {
      const { creatorProfiles } = await import("../src/modules/media-kit/schema");
      return db.select({ slug: creatorProfiles.slug }).from(creatorProfiles).where(eq(creatorProfiles.workspaceId, creator.workspaceId));
    });
    const kit = await getPublicMediaKit(profile?.slug ?? "");
    expect(kit?.displayName).toBe("Nati Test");
    expect(JSON.stringify(kit)).not.toContain("accessToken");
    expect(await getPublicMediaKit("no-existe")).toBeNull();
  });
});
