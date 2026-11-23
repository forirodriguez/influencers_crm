import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { encryptString } from "../lib/crypto";
import { majorToMinor } from "../lib/money";
import { toE164 } from "../lib/phone";
import { LEGAL_VERSION, WHATSAPP_CONSENT_VERSION } from "../lib/constants";
import { activities, brandContacts, brands, deals, deliverables, paymentExpectations, paymentsReceived, pipelineStages } from "../modules/crm/schema";
import { createWorkspaceWithOwner } from "../modules/identity/bootstrap";
import { hashPassword } from "../modules/identity/password";
import { authCredentials, invitations, legalAcceptances, memberships, users } from "../modules/identity/schema";
import { creatorProfiles, metricSnapshots, services, socialAccounts } from "../modules/media-kit/schema";
import { notifications, whatsappConsents } from "../modules/reminders/schema";
import { connectionOptions } from "./connection";
import { assertMigrationConnection, isHostedDatabase } from "./hosted";
import { loadEnvFile } from "./load-env";
import { schema } from "./schema";
import { truncatePublicTables } from "./truncate";
import type { Db } from "./types";

loadEnvFile();

const DEMO_PASSWORD = "demo1234";

function iso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function when(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

function phone(value: string): string {
  const parsed = toE164(value);
  if (!parsed) throw new Error(`Teléfono inválido: ${value}`);
  return parsed;
}

async function stageId(db: Db, workspaceId: string, name: string): Promise<string> {
  const [row] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.workspaceId, workspaceId), eq(pipelineStages.name, name)))
    .limit(1);
  if (!row) throw new Error(`Falta la etapa ${name}`);
  return row.id;
}

type Person = {
  email: string;
  name: string;
  locale: string;
  timezone: string;
  country: string;
  currency: string;
  city: string;
  niches: string[];
  bio: string;
  slug: string;
};

async function createPerson(db: Db, passwordHash: string, person: Person) {
  const [user] = await db
    .insert(users)
    .values({
      email: person.email,
      name: person.name,
      locale: person.locale,
      timezone: person.timezone,
      country: person.country,
      phoneE164: null,
    })
    .returning();
  if (!user) throw new Error("No se pudo crear el usuario demo");
  await db.insert(authCredentials).values({ userId: user.id, passwordHash });
  await db.insert(legalAcceptances).values([
    { userId: user.id, document: "terms", version: LEGAL_VERSION, ip: "127.0.0.1" },
    { userId: user.id, document: "privacy", version: LEGAL_VERSION, ip: "127.0.0.1" },
  ]);
  const workspace = await createWorkspaceWithOwner(db, {
    ownerId: user.id,
    name: person.name,
    type: "personal",
    country: person.country,
    currency: person.currency,
    profile: {
      displayName: person.name,
      slug: person.slug,
      country: person.country,
      city: person.city,
      niches: person.niches,
      bio: person.bio,
      publicEmail: person.email,
      languages: ["es"],
    },
  });
  return { user, workspaceId: workspace.workspaceId, profileId: workspace.profileId! };
}

export async function seedDemo(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL es obligatorio");
  if (databaseUrl.includes("influencers_crm_test")) throw new Error("No se seedea la base de tests");
  const hosted = isHostedDatabase(databaseUrl);
  if ((hosted || process.env.NODE_ENV === "production") && process.env.ALLOW_SEED !== "true") {
    throw new Error("El seed borra los datos de la base. En Supabase o en producción hace falta ALLOW_SEED=true");
  }

  assertMigrationConnection(databaseUrl);
  const connection = postgres(databaseUrl, connectionOptions(databaseUrl, 1));
  await truncatePublicTables(connection);
  const db = drizzle(connection, { schema });
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const cami = await createPerson(db, passwordHash, {
    email: "cami@demo.influencerscrm.test",
    name: "Cami Gómez",
    locale: "es-UY",
    timezone: "America/Argentina/Buenos_Aires",
    country: "AR",
    currency: "ARS",
    city: "Buenos Aires",
    niches: ["belleza", "lifestyle"],
    bio: "Belleza cotidiana y reseñas honestas desde Buenos Aires. 35 mil en Instagram.",
    slug: "cami-gomez",
  });
  const diego = await createPerson(db, passwordHash, {
    email: "diego@demo.influencerscrm.test",
    name: "Diego Ruiz",
    locale: "es-UY",
    timezone: "America/Mexico_City",
    country: "MX",
    currency: "MXN",
    city: "Ciudad de México",
    niches: ["comida", "humor"],
    bio: "Recetas cortas y humor de oficina. Principalmente TikTok.",
    slug: "diego-ruiz",
  });
  const nati = await createPerson(db, passwordHash, {
    email: "nati@demo.influencerscrm.test",
    name: "Natalia Ospina",
    locale: "es-UY",
    timezone: "America/Bogota",
    country: "CO",
    currency: "COP",
    city: "Bogotá",
    niches: ["café", "viajes"],
    bio: "Café de origen y viajes cortos por Colombia.",
    slug: "nati-ospina",
  });

  const [valenUser] = await db
    .insert(users)
    .values({
      email: "valen@demo.influencerscrm.test",
      name: "Valen Pereyra",
      locale: "es-UY",
      timezone: "America/Montevideo",
      country: "UY",
    })
    .returning();
  if (!valenUser) throw new Error("No se pudo crear a Valen");
  await db.insert(authCredentials).values({ userId: valenUser.id, passwordHash });
  await db.insert(legalAcceptances).values([
    { userId: valenUser.id, document: "terms", version: LEGAL_VERSION, ip: "127.0.0.1" },
    { userId: valenUser.id, document: "privacy", version: LEGAL_VERSION, ip: "127.0.0.1" },
  ]);
  const agency = await createWorkspaceWithOwner(db, {
    ownerId: valenUser.id,
    name: "Estudio Rambla",
    type: "agency",
    country: "UY",
    currency: "UYU",
    profile: {
      displayName: "Valen Pereyra",
      slug: "valen-pereyra",
      country: "UY",
      city: "Montevideo",
      niches: ["dirección creativa"],
      bio: "Estudio chico que lleva creators de Uruguay.",
      publicEmail: "valen@demo.influencerscrm.test",
    },
  });

  await db.insert(memberships).values({
    workspaceId: agency.workspaceId,
    userId: diego.user.id,
    role: "viewer",
    invitedBy: valenUser.id,
    acceptedAt: new Date(),
  });

  const [luz] = await db
    .insert(creatorProfiles)
    .values({
      workspaceId: agency.workspaceId,
      displayName: "Luz Ferreira",
      slug: "luz-ferreira",
      country: "UY",
      city: "Montevideo",
      niches: ["moda"],
      languages: ["es"],
      bio: "Moda local y looks de entre casa.",
      publicEmail: "luz@demo.influencerscrm.test",
    })
    .returning();
  const [mateo] = await db
    .insert(creatorProfiles)
    .values({
      workspaceId: agency.workspaceId,
      displayName: "Mateo Silva",
      slug: "mateo-silva",
      country: "UY",
      city: "Montevideo",
      niches: ["tecnología"],
      languages: ["es"],
      bio: "Unboxings claros, sin gritar.",
      publicEmail: "mateo@demo.influencerscrm.test",
    })
    .returning();
  if (!luz || !mateo || !agency.profileId) throw new Error("Faltan perfiles de la agencia");

  await db.insert(services).values([
    { creatorProfileId: cami.profileId, name: "Reel 30–60 s", platform: "instagram", priceMinor: majorToMinor("450000", "ARS"), currency: "ARS", isFromPrice: true, visible: true },
    { creatorProfileId: cami.profileId, name: "Pack de 3 stories", platform: "instagram", priceMinor: majorToMinor("180000", "ARS"), currency: "ARS", isFromPrice: false, visible: true },
    { creatorProfileId: diego.profileId, name: "Video de receta", platform: "tiktok", priceMinor: majorToMinor("8000", "MXN"), currency: "MXN", isFromPrice: true, visible: true },
    { creatorProfileId: nati.profileId, name: "Reel de origen", platform: "instagram", priceMinor: majorToMinor("1800000", "COP"), currency: "COP", isFromPrice: false, visible: true },
    { creatorProfileId: luz.id, name: "Reel de look", platform: "instagram", priceMinor: majorToMinor("15000", "UYU"), currency: "UYU", isFromPrice: true, visible: true },
  ]);

  const [camiIg] = await db
    .insert(socialAccounts)
    .values({
      creatorProfileId: cami.profileId,
      platform: "instagram",
      handle: "camigomez",
      externalId: "ig-cami",
      connection: "api",
      accessTokenEnc: encryptString("mock-ig-token-cami"),
      scopes: ["instagram_business_basic", "instagram_business_manage_insights"],
      status: "active",
      lastSyncedAt: new Date(),
    })
    .returning();
  const [camiTiktok] = await db
    .insert(socialAccounts)
    .values({
      creatorProfileId: cami.profileId,
      platform: "tiktok",
      handle: "camigomez",
      connection: "api",
      accessTokenEnc: encryptString("mock-tt-token-cami"),
      status: "active",
      lastSyncedAt: new Date(),
    })
    .returning();
  if (camiTiktok) {
    await db.insert(metricSnapshots).values({
      socialAccountId: camiTiktok.id,
      followers: 18400,
      following: 210,
      mediaCount: 96,
      likesTotal: 640000n,
      views30d: 210000n,
      raw: { source: "mock" },
    });
  }
  await db.insert(socialAccounts).values([
    { creatorProfileId: diego.profileId, platform: "tiktok", handle: "diegoruiz", connection: "api", accessTokenEnc: encryptString("mock-tt-token-diego"), status: "active", lastSyncedAt: new Date() },
    { creatorProfileId: diego.profileId, platform: "instagram", handle: "diegoruiz", connection: "manual", status: "active" },
    { creatorProfileId: nati.profileId, platform: "instagram", handle: "nati.ospina", connection: "manual", status: "active" },
    { creatorProfileId: luz.id, platform: "instagram", handle: "luzferreira", connection: "api", accessTokenEnc: encryptString("mock-ig-token-luz"), status: "active", lastSyncedAt: new Date() },
    { creatorProfileId: mateo.id, platform: "tiktok", handle: "mateosilva", connection: "manual", status: "active" },
  ]);
  if (camiIg) {
    await db.insert(metricSnapshots).values({
      socialAccountId: camiIg.id,
      followers: 35200,
      following: 890,
      mediaCount: 410,
      reach30d: 84000n,
      views30d: 126000n,
      interactions30d: 6400n,
      demographics: { countries: [{ code: "AR", share: 0.71 }], cities: [{ name: "Buenos Aires", share: 0.38 }] },
      raw: { source: "mock" },
    });
  }

  async function brand(workspaceId: string, input: { name: string; normalized: string; country: string; industry: string; website?: string; instagram?: string; notes?: string; contact: { name: string; role: string; email: string; phone: string } }) {
    const [row] = await db
      .insert(brands)
      .values({
        workspaceId,
        name: input.name,
        nameNormalized: input.normalized,
        country: input.country,
        industry: input.industry,
        website: input.website,
        instagram: input.instagram,
        notes: input.notes,
      })
      .returning();
    if (!row) throw new Error("No se pudo crear la marca");
    const [contact] = await db
      .insert(brandContacts)
      .values({
        brandId: row.id,
        workspaceId,
        name: input.contact.name,
        role: input.contact.role,
        email: input.contact.email,
        whatsappE164: phone(input.contact.phone),
      })
      .returning();
    return { brand: row, contactId: contact?.id ?? null };
  }

  const bruma = await brand(cami.workspaceId, {
    name: "Bruma Belleza",
    normalized: "bruma belleza",
    country: "AR",
    industry: "cosmética",
    website: "https://bruma.example",
    instagram: "brumabelleza",
    notes: "Pagan por transferencia, suelen tardar un mes.",
    contact: { name: "Sofía Herrera", role: "Brand manager", email: "sofia@bruma.example", phone: "+5491112345678" },
  });
  const feria = await brand(cami.workspaceId, {
    name: "Feria Palermo Casa",
    normalized: "feria palermo casa",
    country: "AR",
    industry: "lifestyle",
    contact: { name: "Martín Paz", role: "Prensa", email: "martin@feria.example", phone: "+5491144445555" },
  });
  const andes = await brand(cami.workspaceId, {
    name: "Andes Outdoor",
    normalized: "andes outdoor",
    country: "AR",
    industry: "outdoor",
    notes: "Acuerdan en USD y pagan en pesos al tipo del día. En el MVP no convertimos.",
    contact: { name: "Laura Kim", role: "Marketing", email: "laura@andes.example", phone: "+5491155566666" },
  });
  const nube = await brand(diego.workspaceId, {
    name: "Café Nube",
    normalized: "cafe nube",
    country: "MX",
    industry: "alimentos",
    instagram: "cafenube",
    contact: { name: "Regina Solís", role: "Fundadora", email: "regina@cafenube.example", phone: "+525512345678" },
  });
  const taller = await brand(diego.workspaceId, {
    name: "Taller Norte",
    normalized: "taller norte",
    country: "MX",
    industry: "moda",
    contact: { name: "Iván Cruz", role: "Compras", email: "ivan@tallernorte.example", phone: "+525598765432" },
  });
  const paramo = await brand(nati.workspaceId, {
    name: "Café Páramo",
    normalized: "cafe paramo",
    country: "CO",
    industry: "café",
    contact: { name: "Camilo Restrepo", role: "Comercial", email: "camilo@paramo.example", phone: "+573001234567" },
  });
  const liga = await brand(nati.workspaceId, {
    name: "Liga Local",
    normalized: "liga local",
    country: "CO",
    industry: "deporte",
    contact: { name: "Ana Vélez", role: "Contenido", email: "ana@ligalocal.example", phone: "+573102223344" },
  });
  const puerto = await brand(agency.workspaceId, {
    name: "Tienda Puerto",
    normalized: "tienda puerto",
    country: "UY",
    industry: "moda",
    contact: { name: "Elena Costa", role: "Dueña", email: "elena@tiendapuerto.example", phone: "+59899123456" },
  });
  const audio = await brand(agency.workspaceId, {
    name: "Andes Audio",
    normalized: "andes audio",
    country: "UY",
    industry: "tecnología",
    contact: { name: "Pedro Núñez", role: "Producto", email: "pedro@andesaudio.example", phone: "+59894111222" },
  });

  async function deal(input: {
    workspaceId: string;
    profileId: string;
    brandId: string;
    contactId: string | null;
    userId: string;
    stage: string;
    title: string;
    compensation: "paid" | "barter" | "mixed" | "affiliate";
    amount?: string;
    currency?: string;
    barter?: string;
    barterCurrency?: string;
    source?: "ig_dm" | "tiktok_dm" | "email" | "whatsapp" | "referral" | "other";
    lostReason?: string;
    notes?: string;
  }) {
    const [row] = await db
      .insert(deals)
      .values({
        workspaceId: input.workspaceId,
        creatorProfileId: input.profileId,
        brandId: input.brandId,
        primaryContactId: input.contactId,
        stageId: await stageId(db, input.workspaceId, input.stage),
        title: input.title,
        compensationType: input.compensation,
        amountMinor: input.amount && input.currency ? majorToMinor(input.amount, input.currency) : null,
        currency: input.currency ?? null,
        barterValueMinor: input.barter && input.barterCurrency ? majorToMinor(input.barter, input.barterCurrency) : null,
        barterCurrency: input.barterCurrency ?? null,
        source: input.source,
        lostReason: input.lostReason,
        notes: input.notes,
        createdBy: input.userId,
      })
      .returning();
    if (!row) throw new Error("No se pudo crear el acuerdo");
    await db.insert(activities).values({
      workspaceId: input.workspaceId,
      dealId: row.id,
      actorUserId: input.userId,
      type: "note",
      payload: { text: "Cargado en el seed de demostración" },
    });
    return row.id;
  }

  const serum = await deal({
    workspaceId: cami.workspaceId,
    profileId: cami.profileId,
    brandId: bruma.brand.id,
    contactId: bruma.contactId,
    userId: cami.user.id,
    stage: "En producción",
    title: "Reel serum vitamina C",
    compensation: "paid",
    amount: "450000",
    currency: "ARS",
    source: "ig_dm",
  });
  await db.insert(deliverables).values({
    dealId: serum,
    workspaceId: cami.workspaceId,
    platform: "instagram",
    format: "reel",
    quantity: 1,
    status: "in_review",
    draftDueAt: when(1),
    publishDueAt: when(3),
  });
  await db.insert(paymentExpectations).values({
    dealId: serum,
    workspaceId: cami.workspaceId,
    amountMinor: majorToMinor("450000", "ARS"),
    currency: "ARS",
    dueDate: iso(30),
    status: "pending",
  });

  const stories = await deal({
    workspaceId: cami.workspaceId,
    profileId: cami.profileId,
    brandId: feria.brand.id,
    contactId: feria.contactId,
    userId: cami.user.id,
    stage: "Negociando",
    title: "Stories feria de diseño",
    compensation: "barter",
    barter: "85000",
    barterCurrency: "ARS",
    source: "whatsapp",
    notes: "Canje de entradas y un mueble chico. Todavía no cerramos.",
  });
  await db.insert(deliverables).values({
    dealId: stories,
    workspaceId: cami.workspaceId,
    platform: "instagram",
    format: "story",
    quantity: 3,
    status: "pending",
    publishDueAt: when(10),
  });

  const camp = await deal({
    workspaceId: cami.workspaceId,
    profileId: cami.profileId,
    brandId: andes.brand.id,
    contactId: andes.contactId,
    userId: cami.user.id,
    stage: "Publicado",
    title: "Post campamento de otoño",
    compensation: "paid",
    amount: "400",
    currency: "USD",
    source: "email",
  });
  await db.insert(deliverables).values({
    dealId: camp,
    workspaceId: cami.workspaceId,
    platform: "instagram",
    format: "post",
    quantity: 1,
    status: "published",
    publishDueAt: when(-20),
    postUrl: "https://instagram.com/p/cami-andes",
  });
  await db.insert(paymentExpectations).values({
    dealId: camp,
    workspaceId: cami.workspaceId,
    amountMinor: majorToMinor("400", "USD"),
    currency: "USD",
    dueDate: iso(-18),
    status: "overdue",
    note: "Prometieron pagar a los 15 días de publicado.",
  });

  await deal({
    workspaceId: cami.workspaceId,
    profileId: cami.profileId,
    brandId: bruma.brand.id,
    contactId: bruma.contactId,
    userId: cami.user.id,
    stage: "Perdido",
    title: "Campaña verano",
    compensation: "paid",
    amount: "200000",
    currency: "ARS",
    source: "ig_dm",
    lostReason: "Se fueron con otra creadora del mismo nicho.",
  });

  const labial = await deal({
    workspaceId: cami.workspaceId,
    profileId: cami.profileId,
    brandId: bruma.brand.id,
    contactId: bruma.contactId,
    userId: cami.user.id,
    stage: "Cobrado",
    title: "Reel labial mate",
    compensation: "paid",
    amount: "320000",
    currency: "ARS",
    source: "referral",
  });
  const [paidExpectation] = await db
    .insert(paymentExpectations)
    .values({
      dealId: labial,
      workspaceId: cami.workspaceId,
      amountMinor: majorToMinor("320000", "ARS"),
      currency: "ARS",
      dueDate: iso(-20),
      status: "paid",
    })
    .returning();
  if (paidExpectation) {
    await db.insert(paymentsReceived).values({
      paymentExpectationId: paidExpectation.id,
      workspaceId: cami.workspaceId,
      amountMinor: majorToMinor("320000", "ARS"),
      currency: "ARS",
      receivedAt: when(-12),
      method: "mercado_pago",
      note: "Llegó completo, sin comprobante fiscal.",
    });
  }

  const receta = await deal({
    workspaceId: diego.workspaceId,
    profileId: diego.profileId,
    brandId: nube.brand.id,
    contactId: nube.contactId,
    userId: diego.user.id,
    stage: "Confirmado",
    title: "Video receta de olla",
    compensation: "paid",
    amount: "8000",
    currency: "MXN",
    source: "tiktok_dm",
  });
  await db.insert(deliverables).values({
    dealId: receta,
    workspaceId: diego.workspaceId,
    platform: "tiktok",
    format: "video",
    quantity: 1,
    status: "pending",
    draftDueAt: when(2),
    publishDueAt: when(7),
  });
  await db.insert(paymentExpectations).values({
    dealId: receta,
    workspaceId: diego.workspaceId,
    amountMinor: majorToMinor("8000", "MXN"),
    currency: "MXN",
    dueDate: iso(20),
    status: "pending",
  });
  await deal({
    workspaceId: diego.workspaceId,
    profileId: diego.profileId,
    brandId: taller.brand.id,
    contactId: taller.contactId,
    userId: diego.user.id,
    stage: "Lead",
    title: "Haul denim",
    compensation: "paid",
    amount: "5000",
    currency: "MXN",
    source: "ig_dm",
  });

  const cafe = await deal({
    workspaceId: nati.workspaceId,
    profileId: nati.profileId,
    brandId: paramo.brand.id,
    contactId: paramo.contactId,
    userId: nati.user.id,
    stage: "Publicado",
    title: "Reel origen del café",
    compensation: "paid",
    amount: "1800000",
    currency: "COP",
    source: "whatsapp",
  });
  const [partial] = await db
    .insert(paymentExpectations)
    .values({
      dealId: cafe,
      workspaceId: nati.workspaceId,
      amountMinor: majorToMinor("1800000", "COP"),
      currency: "COP",
      dueDate: iso(-5),
      status: "partial",
      note: "Falta la segunda transferencia.",
    })
    .returning();
  if (partial) {
    await db.insert(paymentsReceived).values({
      paymentExpectationId: partial.id,
      workspaceId: nati.workspaceId,
      amountMinor: majorToMinor("1000000", "COP"),
      currency: "COP",
      receivedAt: when(-2),
      method: "bank_transfer",
    });
  }
  const ugc = await deal({
    workspaceId: nati.workspaceId,
    profileId: nati.profileId,
    brandId: liga.brand.id,
    contactId: liga.contactId,
    userId: nati.user.id,
    stage: "Confirmado",
    title: "UGC para pauta, sin publicar",
    compensation: "paid",
    amount: "900000",
    currency: "COP",
    source: "email",
  });
  await db.insert(deliverables).values({
    dealId: ugc,
    workspaceId: nati.workspaceId,
    platform: "other",
    format: "ugc",
    quantity: 2,
    status: "pending",
    approvalDueAt: when(4),
  });
  await db.insert(paymentExpectations).values({
    dealId: ugc,
    workspaceId: nati.workspaceId,
    amountMinor: majorToMinor("900000", "COP"),
    currency: "COP",
    dueDate: iso(15),
    status: "pending",
  });

  const invierno = await deal({
    workspaceId: agency.workspaceId,
    profileId: luz.id,
    brandId: puerto.brand.id,
    contactId: puerto.contactId,
    userId: valenUser.id,
    stage: "En producción",
    title: "Reel colección invierno",
    compensation: "paid",
    amount: "15000",
    currency: "UYU",
    source: "email",
  });
  await db.insert(deliverables).values({
    dealId: invierno,
    workspaceId: agency.workspaceId,
    platform: "instagram",
    format: "reel",
    quantity: 1,
    status: "approved",
    publishDueAt: when(5),
  });
  await db.insert(paymentExpectations).values({
    dealId: invierno,
    workspaceId: agency.workspaceId,
    amountMinor: majorToMinor("15000", "UYU"),
    currency: "UYU",
    dueDate: iso(25),
    status: "pending",
  });
  await deal({
    workspaceId: agency.workspaceId,
    profileId: mateo.id,
    brandId: audio.brand.id,
    contactId: audio.contactId,
    userId: valenUser.id,
    stage: "Negociando",
    title: "Unboxing auriculares",
    compensation: "paid",
    amount: "600",
    currency: "USD",
    source: "referral",
  });

  await db.insert(whatsappConsents).values({
    userId: cami.user.id,
    phoneE164: phone("+5491112345678"),
    source: "web",
    consentTextVersion: WHATSAPP_CONSENT_VERSION,
  });
  await db.update(users).set({ phoneE164: phone("+5491112345678"), phoneVerifiedAt: new Date() }).where(eq(users.id, cami.user.id));

  await db.insert(notifications).values({
    workspaceId: cami.workspaceId,
    userId: cami.user.id,
    idempotencyKey: "seed:cami:overdue:andes",
    channel: "in_app",
    template: "cobro_vencido",
    payload: {
      title: "Cobro vencido",
      body: "Andes Outdoor debe USD 400.",
      url: "/cobros",
      brand: "Andes Outdoor",
      currency: "USD",
      amount: "400",
    },
    status: "sent",
    sentAt: new Date(),
    scheduledFor: new Date(),
  });

  const inviteToken = "invitacion-demo";
  await db.insert(invitations).values({
    workspaceId: agency.workspaceId,
    email: "equipo@demo.influencerscrm.test",
    role: "manager",
    tokenHash: createHash("sha256").update(inviteToken).digest("hex"),
    expiresAt: when(7),
  });

  await connection.end();
  console.log("Seed listo. Contraseña demo1234. Invitación de agencia: invitacion-demo");
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("seed.ts")) {
  seedDemo().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
