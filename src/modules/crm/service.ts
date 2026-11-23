import { and, eq, isNull, lt } from "drizzle-orm";
import type { CountryCode } from "libphonenumber-js";
import type { Db } from "../../db/types";
import { isCurrency } from "../../lib/constants";
import { zonedDateISO, formatCalendarDate } from "../../lib/dates";
import { ApiError } from "../../lib/errors";
import { formatMoney } from "../../lib/money";
import { normalizeName } from "../../lib/names";
import { toE164 } from "../../lib/phone";
import { loadMessages } from "../../i18n/load";
import { users } from "../identity/schema";
import { parseAmount } from "./amounts";
import { buildFollowUp } from "./follow-up";
import {
  findExclusivityClash,
  getBrand,
  listContacts,
  listProfiles,
  listStages,
  listPaymentExpectations,
} from "./queries";
import {
  activities,
  brandContacts,
  brands,
  deals,
  deliverables,
  paymentExpectations,
  paymentsReceived,
  pipelineStages,
} from "./schema";
import { nextPaymentStatus, outstandingMinor, displayPaymentStatus } from "./status";
import {
  contactSchema,
  createBrandSchema,
  createDealSchema,
  createStageSchema,
  deliverableSchema,
  moveDealSchema,
  noteSchema,
  parseInput,
  paymentSchema,
  receiptSchema,
  reorderStagesSchema,
  updateBrandSchema,
  updateContactSchema,
  updateDealSchema,
  updateDeliverableSchema,
  updatePaymentSchema,
} from "./validation";
import { parseUserDateTime } from "./wall-time";

export type CrmActor = { userId: string; workspaceId: string };

type FollowUpTemplates = { template?: string; subjectTemplate?: string };

function pgCode(error: unknown): string | null {
  const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
  for (const candidate of [error, cause]) {
    if (candidate && typeof candidate === "object" && "code" in candidate && typeof candidate.code === "string") {
      return candidate.code;
    }
  }
  return null;
}

async function insertUnique<T>(db: Db, fn: (tx: Db) => Promise<T>, message: string): Promise<T> {
  try {
    return await db.transaction(async (tx) => fn(tx as unknown as Db));
  } catch (error) {
    if (pgCode(error) === "23505") throw new ApiError("duplicate", message, 409);
    throw error;
  }
}

function countryHint(value: string | null | undefined): CountryCode | undefined {
  if (value && /^[A-Za-z]{2}$/.test(value)) return value.toUpperCase() as CountryCode;
  return undefined;
}

function phoneOrNull(value: string | null | undefined, country?: string | null): string | null {
  if (!value) return null;
  const parsed = toE164(value, countryHint(country));
  if (!parsed) throw new ApiError("invalid_phone", "El WhatsApp no es un número válido", 400);
  return parsed;
}

function emailOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new ApiError("invalid_email", "El email no es válido", 400);
  return value.toLowerCase();
}

function handle(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^@+/, "");
}

function linkOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function moneyPair(amount: string | null | undefined, currency: string | null | undefined) {
  if (amount == null) return { amountMinor: null, currency: null };
  if (!currency || !isCurrency(currency)) throw new ApiError("invalid_currency", "Elegí una moneda", 400);
  try {
    const amountMinor = parseAmount(amount, currency);
    if (amountMinor <= 0n) throw new Error("zero");
    return { amountMinor, currency };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("invalid_amount", "El monto tiene que ser un número positivo", 400);
  }
}

async function clock(db: Db, userId: string) {
  const [user] = await db
    .select({ timezone: users.timezone, locale: users.locale, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const timeZone = user?.timezone || "UTC";
  return {
    timeZone,
    locale: "es-UY",
    name: user?.name?.trim() || "yo",
    todayISO: zonedDateISO(new Date(), timeZone),
  };
}

function plusDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function logActivity(
  db: Db,
  actor: CrmActor,
  dealId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  await db.insert(activities).values({
    workspaceId: actor.workspaceId,
    dealId,
    actorUserId: actor.userId,
    type,
    payload,
  });
  await db
    .update(deals)
    .set({ updatedAt: new Date() })
    .where(and(eq(deals.id, dealId), eq(deals.workspaceId, actor.workspaceId), isNull(deals.deletedAt)));
}

async function requireBrand(db: Db, actor: CrmActor, brandId: string) {
  const brand = await getBrand(db, actor.workspaceId, brandId);
  if (!brand) throw new ApiError("not_found", "No encontramos esa marca", 404);
  return brand;
}

async function requireDeal(db: Db, actor: CrmActor, dealId: string) {
  const [deal] = await db
    .select()
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.workspaceId, actor.workspaceId), isNull(deals.deletedAt)))
    .limit(1);
  if (!deal) throw new ApiError("not_found", "No encontramos ese acuerdo", 404);
  return deal;
}

async function requireContact(db: Db, actor: CrmActor, brandId: string, contactId: string) {
  const [contact] = await db
    .select()
    .from(brandContacts)
    .where(
      and(
        eq(brandContacts.id, contactId),
        eq(brandContacts.brandId, brandId),
        eq(brandContacts.workspaceId, actor.workspaceId),
        isNull(brandContacts.deletedAt),
      ),
    )
    .limit(1);
  if (!contact) throw new ApiError("not_found", "No encontramos ese contacto", 404);
  return contact;
}

export async function createBrand(db: Db, actor: CrmActor, input: unknown) {
  const data = parseInput(createBrandSchema, input);
  const nameNormalized = normalizeName(data.name);
  if (!nameNormalized) throw new ApiError("invalid_body", "El nombre de la marca es obligatorio", 400);
  const [created] = await insertUnique(
    db,
    (tx) =>
      tx
        .insert(brands)
        .values({
          workspaceId: actor.workspaceId,
          name: data.name.trim(),
          nameNormalized,
          website: linkOrNull(data.website),
          instagram: handle(data.instagram),
          tiktok: handle(data.tiktok),
          industry: data.industry ?? null,
          country: data.country ?? null,
          notes: data.notes ?? null,
        })
        .returning(),
    "Ya hay una marca con ese nombre en este espacio",
  );
  if (!created) throw new ApiError("internal", "No se pudo crear la marca", 500);
  return created;
}

export async function updateBrand(db: Db, actor: CrmActor, brandId: string, input: unknown) {
  const current = await requireBrand(db, actor, brandId);
  const data = parseInput(updateBrandSchema, input);
  const name = data.name?.trim() ?? current.name;
  const nameNormalized = normalizeName(name);
  if (!nameNormalized) throw new ApiError("invalid_body", "El nombre de la marca es obligatorio", 400);
  const [updated] = await insertUnique(
    db,
    (tx) =>
      tx
        .update(brands)
        .set({
          name,
          nameNormalized,
          website: data.website !== undefined ? linkOrNull(data.website) : current.website,
          instagram: data.instagram !== undefined ? handle(data.instagram) : current.instagram,
          tiktok: data.tiktok !== undefined ? handle(data.tiktok) : current.tiktok,
          industry: data.industry !== undefined ? data.industry : current.industry,
          country: data.country !== undefined ? data.country : current.country,
          notes: data.notes !== undefined ? data.notes : current.notes,
        })
        .where(and(eq(brands.id, brandId), eq(brands.workspaceId, actor.workspaceId), isNull(brands.deletedAt)))
        .returning(),
    "Ya hay una marca con ese nombre en este espacio",
  );
  if (!updated) throw new ApiError("not_found", "No encontramos esa marca", 404);
  return updated;
}

export async function deleteBrand(db: Db, actor: CrmActor, brandId: string) {
  await requireBrand(db, actor, brandId);
  const [deal] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.brandId, brandId), eq(deals.workspaceId, actor.workspaceId), isNull(deals.deletedAt)))
    .limit(1);
  if (deal) throw new ApiError("brand_in_use", "Esta marca tiene acuerdos. Borrá o mové esos acuerdos antes.", 409);
  const now = new Date();
  await db
    .update(brandContacts)
    .set({ deletedAt: now })
    .where(and(eq(brandContacts.brandId, brandId), eq(brandContacts.workspaceId, actor.workspaceId), isNull(brandContacts.deletedAt)));
  await db
    .update(brands)
    .set({ deletedAt: now })
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, actor.workspaceId)));
  return { id: brandId };
}

export async function createContact(db: Db, actor: CrmActor, brandId: string, input: unknown) {
  const brand = await requireBrand(db, actor, brandId);
  const data = parseInput(contactSchema, input);
  const [created] = await db
    .insert(brandContacts)
    .values({
      brandId,
      workspaceId: actor.workspaceId,
      name: data.name.trim(),
      role: data.role ?? null,
      email: emailOrNull(data.email),
      whatsappE164: phoneOrNull(data.whatsapp, brand.country),
      instagram: handle(data.instagram),
      notes: data.notes ?? null,
    })
    .returning();
  if (!created) throw new ApiError("internal", "No se pudo crear el contacto", 500);
  return created;
}

export async function updateContact(db: Db, actor: CrmActor, brandId: string, contactId: string, input: unknown) {
  const brand = await requireBrand(db, actor, brandId);
  const current = await requireContact(db, actor, brandId, contactId);
  const data = parseInput(updateContactSchema, input);
  const name = data.name?.trim() || current.name;
  const [updated] = await db
    .update(brandContacts)
    .set({
      name,
      role: data.role !== undefined ? data.role : current.role,
      email: data.email !== undefined ? emailOrNull(data.email) : current.email,
      whatsappE164: data.whatsapp !== undefined ? phoneOrNull(data.whatsapp, brand.country) : current.whatsappE164,
      instagram: data.instagram !== undefined ? handle(data.instagram) : current.instagram,
      notes: data.notes !== undefined ? data.notes : current.notes,
    })
    .where(and(eq(brandContacts.id, contactId), eq(brandContacts.workspaceId, actor.workspaceId)))
    .returning();
  if (!updated) throw new ApiError("not_found", "No encontramos ese contacto", 404);
  return updated;
}

export async function deleteContact(db: Db, actor: CrmActor, brandId: string, contactId: string) {
  await requireContact(db, actor, brandId, contactId);
  await db
    .update(brandContacts)
    .set({ deletedAt: new Date() })
    .where(and(eq(brandContacts.id, contactId), eq(brandContacts.workspaceId, actor.workspaceId)));
  await db
    .update(deals)
    .set({ primaryContactId: null })
    .where(and(eq(deals.primaryContactId, contactId), eq(deals.workspaceId, actor.workspaceId)));
  return { id: contactId };
}

export async function createStage(db: Db, actor: CrmActor, input: unknown) {
  const data = parseInput(createStageSchema, input);
  const stages = await listStages(db, actor.workspaceId);
  const position = stages.reduce((max, stage) => Math.max(max, stage.position), -1) + 1;
  const [created] = await insertUnique(
    db,
    (tx) =>
      tx
        .insert(pipelineStages)
        .values({ workspaceId: actor.workspaceId, name: data.name.trim(), position, kind: data.kind })
        .returning(),
    "Ya hay una etapa en esa posición",
  );
  if (!created) throw new ApiError("internal", "No se pudo crear la etapa", 500);
  return created;
}

export async function reorderStages(db: Db, actor: CrmActor, input: unknown) {
  const data = parseInput(reorderStagesSchema, input);
  const current = await listStages(db, actor.workspaceId);
  const incoming = new Set(data.stages.map((stage) => stage.id));
  if (incoming.size !== data.stages.length || current.length !== data.stages.length || current.some((stage) => !incoming.has(stage.id))) {
    throw new ApiError("invalid_stages", "La lista de etapas no coincide con las de este espacio", 400);
  }
  for (let index = 0; index < current.length; index += 1) {
    const stage = current[index];
    if (!stage) continue;
    await db
      .update(pipelineStages)
      .set({ position: 1000 + index })
      .where(and(eq(pipelineStages.id, stage.id), eq(pipelineStages.workspaceId, actor.workspaceId)));
  }
  for (let index = 0; index < data.stages.length; index += 1) {
    const stage = data.stages[index];
    if (!stage) continue;
    await db
      .update(pipelineStages)
      .set({ position: index, name: stage.name.trim(), kind: stage.kind })
      .where(and(eq(pipelineStages.id, stage.id), eq(pipelineStages.workspaceId, actor.workspaceId)));
  }
  return listStages(db, actor.workspaceId);
}

export async function deleteStage(db: Db, actor: CrmActor, stageId: string) {
  const stages = await listStages(db, actor.workspaceId);
  const stage = stages.find((item) => item.id === stageId);
  if (!stage) throw new ApiError("not_found", "No encontramos esa etapa", 404);
  if (stages.length < 2) throw new ApiError("last_stage", "Tiene que quedar al menos una etapa", 400);
  const [deal] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(and(eq(deals.stageId, stageId), eq(deals.workspaceId, actor.workspaceId), isNull(deals.deletedAt)))
    .limit(1);
  if (deal) throw new ApiError("stage_in_use", "Hay acuerdos en esta etapa. Movelos antes de borrarla.", 409);
  await db
    .update(pipelineStages)
    .set({ deletedAt: new Date() })
    .where(and(eq(pipelineStages.id, stageId), eq(pipelineStages.workspaceId, actor.workspaceId)));
  return { id: stageId };
}

async function resolveBrand(db: Db, actor: CrmActor, brandId: string | undefined, brandName: string | undefined) {
  if (brandId) {
    await requireBrand(db, actor, brandId);
    return { brandId, brandReused: false };
  }
  if (!brandName) throw new ApiError("brand_required", "Elegí una marca o cargá una nueva", 400);
  const normalized = normalizeName(brandName);
  const [existing] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.workspaceId, actor.workspaceId), eq(brands.nameNormalized, normalized), isNull(brands.deletedAt)))
    .limit(1);
  if (existing) return { brandId: existing.id, brandReused: true };
  const created = await createBrand(db, actor, { name: brandName });
  return { brandId: created.id, brandReused: false };
}

async function resolveProfile(db: Db, actor: CrmActor, requested?: string) {
  const profiles = await listProfiles(db, actor.workspaceId);
  const creatorProfileId = requested ?? (profiles.length === 1 ? profiles[0]?.id : undefined);
  if (!creatorProfileId || !profiles.some((profile) => profile.id === creatorProfileId)) {
    throw new ApiError("profile_required", "Elegí el perfil del creator", 400);
  }
  return creatorProfileId;
}

export async function createDeal(db: Db, actor: CrmActor, input: unknown) {
  const data = parseInput(createDealSchema, input);
  const { brandId, brandReused } = await resolveBrand(db, actor, data.brandId, data.brandName);
  const creatorProfileId = await resolveProfile(db, actor, data.creatorProfileId);
  const stages = await listStages(db, actor.workspaceId);
  const stage = data.stageId ? stages.find((item) => item.id === data.stageId) : stages[0];
  if (!stage) throw new ApiError("not_found", "No encontramos esa etapa", 404);
  if (stage.kind === "lost" && !data.lostReason) {
    throw new ApiError("lost_reason_required", "Contá por qué se perdió el acuerdo", 400);
  }
  if (data.primaryContactId) await requireContact(db, actor, brandId, data.primaryContactId);
  if (data.exclusivityUntil && !data.exclusivityCategory) {
    throw new ApiError("invalid_body", "La exclusividad necesita una categoría", 400);
  }
  const price = moneyPair(data.amount, data.currency);
  const barter = moneyPair(data.barterValue, data.barterCurrency);
  const [created] = await db
    .insert(deals)
    .values({
      workspaceId: actor.workspaceId,
      creatorProfileId,
      brandId,
      primaryContactId: data.primaryContactId ?? null,
      stageId: stage.id,
      title: data.title.trim(),
      compensationType: data.compensationType ?? "paid",
      amountMinor: price.amountMinor,
      currency: price.currency,
      barterValueMinor: barter.amountMinor,
      barterCurrency: barter.currency,
      source: data.source ?? null,
      expectedCloseDate: data.expectedCloseDate ?? null,
      lostReason: stage.kind === "lost" ? (data.lostReason ?? null) : null,
      exclusivityCategory: data.exclusivityCategory ?? null,
      exclusivityUntil: data.exclusivityUntil ?? null,
      notes: data.notes ?? null,
      createdBy: actor.userId,
    })
    .returning();
  if (!created) throw new ApiError("internal", "No se pudo crear el acuerdo", 500);

  await db.insert(activities).values({
    workspaceId: actor.workspaceId,
    dealId: created.id,
    actorUserId: actor.userId,
    type: "deal_created",
    payload: { title: created.title },
  });

  const user = await clock(db, actor.userId);
  const hasDeliverable = Boolean(data.draftDueAt || data.approvalDueAt || data.publishDueAt);
  if (hasDeliverable) {
    await insertDeliverable(db, actor, created.id, {
      platform: data.deliverablePlatform ?? "instagram",
      format: data.deliverableFormat ?? "reel",
      quantity: data.deliverableQuantity ?? 1,
      draftDueAt: data.draftDueAt ?? null,
      approvalDueAt: data.approvalDueAt ?? null,
      publishDueAt: data.publishDueAt ?? null,
      status: "pending",
      postUrl: null,
    }, user.timeZone);
  }
  if (price.amountMinor && price.currency) {
    await insertPayment(db, actor, created.id, {
      amountMinor: price.amountMinor,
      currency: price.currency,
      dueDate: data.paymentDueDate ?? data.expectedCloseDate ?? plusDays(user.todayISO, 30),
      note: null,
    });
  }

  const exclusivityWarning = await findExclusivityClash(db, actor.workspaceId, {
    brandId,
    category: created.exclusivityCategory,
    dealId: created.id,
    todayISO: user.todayISO,
  });
  return { id: created.id, brandId, brandReused, exclusivityWarning };
}

export async function updateDeal(db: Db, actor: CrmActor, dealId: string, input: unknown) {
  const current = await requireDeal(db, actor, dealId);
  const data = parseInput(updateDealSchema, input);
  const brandId = data.brandId ?? current.brandId;
  if (data.brandId) await requireBrand(db, actor, data.brandId);
  let primaryContactId = data.primaryContactId !== undefined ? data.primaryContactId : current.primaryContactId;
  if (primaryContactId) {
    const contact = await db
      .select({ id: brandContacts.id, brandId: brandContacts.brandId })
      .from(brandContacts)
      .where(and(eq(brandContacts.id, primaryContactId), eq(brandContacts.workspaceId, actor.workspaceId), isNull(brandContacts.deletedAt)))
      .limit(1);
    if (!contact[0] || contact[0].brandId !== brandId) primaryContactId = null;
  }
  if (data.creatorProfileId) await resolveProfile(db, actor, data.creatorProfileId);
  const category = data.exclusivityCategory !== undefined ? data.exclusivityCategory : current.exclusivityCategory;
  const until = data.exclusivityUntil !== undefined ? data.exclusivityUntil : current.exclusivityUntil;
  if (until && !category) throw new ApiError("invalid_body", "La exclusividad necesita una categoría", 400);
  let amountMinor = current.amountMinor;
  let currency = current.currency;
  if (data.amount === null) {
    amountMinor = null;
    currency = null;
  } else if (typeof data.amount === "string") {
    const parsed = moneyPair(data.amount, data.currency ?? current.currency);
    amountMinor = parsed.amountMinor;
    currency = parsed.currency;
  } else if (typeof data.currency === "string") {
    currency = data.currency;
  }
  if (amountMinor !== null && !currency) throw new ApiError("invalid_currency", "Elegí una moneda", 400);

  let barterValueMinor = current.barterValueMinor;
  let barterCurrency = current.barterCurrency;
  if (data.barterValue === null) {
    barterValueMinor = null;
    barterCurrency = null;
  } else if (typeof data.barterValue === "string") {
    const parsed = moneyPair(data.barterValue, data.barterCurrency ?? current.barterCurrency);
    barterValueMinor = parsed.amountMinor;
    barterCurrency = parsed.currency;
  } else if (typeof data.barterCurrency === "string") {
    barterCurrency = data.barterCurrency;
  }

  const [updated] = await db
    .update(deals)
    .set({
      title: data.title?.trim() ?? current.title,
      brandId,
      primaryContactId,
      creatorProfileId: data.creatorProfileId ?? current.creatorProfileId,
      compensationType: data.compensationType ?? current.compensationType,
      amountMinor,
      currency,
      barterValueMinor,
      barterCurrency,
      source: data.source !== undefined ? data.source : current.source,
      expectedCloseDate: data.expectedCloseDate !== undefined ? data.expectedCloseDate : current.expectedCloseDate,
      notes: data.notes !== undefined ? data.notes : current.notes,
      exclusivityCategory: category,
      exclusivityUntil: category ? until : null,
      lostReason: data.lostReason !== undefined ? data.lostReason : current.lostReason,
    })
    .where(and(eq(deals.id, dealId), eq(deals.workspaceId, actor.workspaceId), isNull(deals.deletedAt)))
    .returning();
  if (!updated) throw new ApiError("not_found", "No encontramos ese acuerdo", 404);
  const user = await clock(db, actor.userId);
  const exclusivityWarning = await findExclusivityClash(db, actor.workspaceId, {
    brandId: updated.brandId,
    category: updated.exclusivityCategory,
    dealId: updated.id,
    todayISO: user.todayISO,
  });
  return { id: updated.id, exclusivityWarning };
}

export async function moveDeal(db: Db, actor: CrmActor, dealId: string, input: unknown) {
  const data = parseInput(moveDealSchema, input);
  const current = await requireDeal(db, actor, dealId);
  const stages = await listStages(db, actor.workspaceId);
  const next = stages.find((stage) => stage.id === data.stageId);
  const previous = stages.find((stage) => stage.id === current.stageId);
  if (!next) throw new ApiError("not_found", "No encontramos esa etapa", 404);
  if (next.kind === "lost" && !data.lostReason?.trim()) {
    throw new ApiError("lost_reason_required", "Contá por qué se perdió el acuerdo", 400);
  }
  if (current.stageId === next.id && next.kind !== "lost") return { id: dealId, stageId: next.id };
  await db
    .update(deals)
    .set({
      stageId: next.id,
      lostReason: next.kind === "lost" ? data.lostReason?.trim() ?? current.lostReason : null,
    })
    .where(and(eq(deals.id, dealId), eq(deals.workspaceId, actor.workspaceId)));
  await logActivity(db, actor, dealId, "stage_changed", {
    fromStageId: current.stageId,
    toStageId: next.id,
    fromStageName: previous?.name ?? "",
    toStageName: next.name,
  });
  return { id: dealId, stageId: next.id };
}

export async function deleteDeal(db: Db, actor: CrmActor, dealId: string) {
  await requireDeal(db, actor, dealId);
  const now = new Date();
  const expectations = await db
    .select({ id: paymentExpectations.id })
    .from(paymentExpectations)
    .where(and(eq(paymentExpectations.dealId, dealId), eq(paymentExpectations.workspaceId, actor.workspaceId), isNull(paymentExpectations.deletedAt)));
  for (const expectation of expectations) {
    await db
      .update(paymentsReceived)
      .set({ deletedAt: now })
      .where(and(eq(paymentsReceived.paymentExpectationId, expectation.id), eq(paymentsReceived.workspaceId, actor.workspaceId), isNull(paymentsReceived.deletedAt)));
  }
  await db.update(paymentExpectations).set({ deletedAt: now }).where(and(eq(paymentExpectations.dealId, dealId), isNull(paymentExpectations.deletedAt)));
  await db.update(deliverables).set({ deletedAt: now }).where(and(eq(deliverables.dealId, dealId), isNull(deliverables.deletedAt)));
  await db.update(deals).set({ deletedAt: now }).where(and(eq(deals.id, dealId), eq(deals.workspaceId, actor.workspaceId)));
  return { id: dealId };
}

async function insertDeliverable(
  db: Db,
  actor: CrmActor,
  dealId: string,
  data: {
    platform: "instagram" | "tiktok" | "other";
    format: "reel" | "story" | "post" | "video" | "ugc";
    quantity: number;
    draftDueAt: string | null;
    approvalDueAt: string | null;
    publishDueAt: string | null;
    status: "pending" | "in_review" | "approved" | "published" | "cancelled";
    postUrl: string | null;
  },
  timeZone: string,
) {
  const [created] = await db
    .insert(deliverables)
    .values({
      dealId,
      workspaceId: actor.workspaceId,
      platform: data.platform,
      format: data.format,
      quantity: data.quantity,
      draftDueAt: data.draftDueAt ? parseUserDateTime(data.draftDueAt, timeZone) : null,
      approvalDueAt: data.approvalDueAt ? parseUserDateTime(data.approvalDueAt, timeZone) : null,
      publishDueAt: data.publishDueAt ? parseUserDateTime(data.publishDueAt, timeZone) : null,
      status: data.status,
      postUrl: linkOrNull(data.postUrl),
    })
    .returning();
  if (!created) throw new ApiError("internal", "No se pudo crear el entregable", 500);
  await logActivity(db, actor, dealId, "deliverable_added", { deliverableId: created.id, format: created.format });
  return created;
}

export async function createDeliverable(db: Db, actor: CrmActor, input: unknown, dealId?: string) {
  const data = parseInput(deliverableSchema, input);
  const id = dealId ?? data.dealId;
  if (!id) throw new ApiError("deal_required", "Falta el acuerdo", 400);
  await requireDeal(db, actor, id);
  const user = await clock(db, actor.userId);
  return insertDeliverable(db, actor, id, {
    platform: data.platform,
    format: data.format,
    quantity: data.quantity ?? 1,
    draftDueAt: data.draftDueAt ?? null,
    approvalDueAt: data.approvalDueAt ?? null,
    publishDueAt: data.publishDueAt ?? null,
    status: data.status ?? "pending",
    postUrl: data.postUrl ?? null,
  }, user.timeZone);
}

export async function updateDeliverable(db: Db, actor: CrmActor, deliverableId: string, input: unknown) {
  const data = parseInput(updateDeliverableSchema, input);
  const [current] = await db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.id, deliverableId), eq(deliverables.workspaceId, actor.workspaceId), isNull(deliverables.deletedAt)))
    .limit(1);
  if (!current) throw new ApiError("not_found", "No encontramos ese entregable", 404);
  const user = await clock(db, actor.userId);
  const when = (value: string | null | undefined, fallback: Date | null) => {
    if (value === undefined) return fallback;
    if (value === null) return null;
    return parseUserDateTime(value, user.timeZone);
  };
  const [updated] = await db
    .update(deliverables)
    .set({
      platform: data.platform ?? current.platform,
      format: data.format ?? current.format,
      quantity: data.quantity ?? current.quantity,
      status: data.status ?? current.status,
      postUrl: data.postUrl !== undefined ? linkOrNull(data.postUrl) : current.postUrl,
      draftDueAt: when(data.draftDueAt, current.draftDueAt),
      approvalDueAt: when(data.approvalDueAt, current.approvalDueAt),
      publishDueAt: when(data.publishDueAt, current.publishDueAt),
    })
    .where(and(eq(deliverables.id, deliverableId), eq(deliverables.workspaceId, actor.workspaceId)))
    .returning();
  if (!updated) throw new ApiError("not_found", "No encontramos ese entregable", 404);
  await logActivity(db, actor, current.dealId, "deliverable_updated", { deliverableId, status: updated.status });
  return updated;
}

export async function deleteDeliverable(db: Db, actor: CrmActor, deliverableId: string) {
  const [current] = await db
    .select()
    .from(deliverables)
    .where(and(eq(deliverables.id, deliverableId), eq(deliverables.workspaceId, actor.workspaceId), isNull(deliverables.deletedAt)))
    .limit(1);
  if (!current) throw new ApiError("not_found", "No encontramos ese entregable", 404);
  await db.update(deliverables).set({ deletedAt: new Date() }).where(eq(deliverables.id, deliverableId));
  return { id: deliverableId };
}

async function insertPayment(
  db: Db,
  actor: CrmActor,
  dealId: string,
  data: { amountMinor: bigint; currency: string; dueDate: string; note: string | null },
) {
  const user = await clock(db, actor.userId);
  const [created] = await db
    .insert(paymentExpectations)
    .values({
      dealId,
      workspaceId: actor.workspaceId,
      amountMinor: data.amountMinor,
      currency: data.currency,
      dueDate: data.dueDate,
      note: data.note,
      status: data.dueDate < user.todayISO ? "overdue" : "pending",
    })
    .returning();
  if (!created) throw new ApiError("internal", "No se pudo crear la cuota", 500);
  await logActivity(db, actor, dealId, "payment_expected", {
    expectationId: created.id,
    amountMinor: created.amountMinor.toString(),
    currency: created.currency,
  });
  return created;
}

export async function createPayment(db: Db, actor: CrmActor, dealId: string, input: unknown) {
  await requireDeal(db, actor, dealId);
  const data = parseInput(paymentSchema, input);
  const price = moneyPair(data.amount, data.currency);
  if (!price.amountMinor || !price.currency) throw new ApiError("invalid_amount", "La cuota necesita un monto", 400);
  return insertPayment(db, actor, dealId, {
    amountMinor: price.amountMinor,
    currency: price.currency,
    dueDate: data.dueDate,
    note: data.note ?? null,
  });
}

async function requireExpectation(db: Db, actor: CrmActor, expectationId: string) {
  const [row] = await db
    .select()
    .from(paymentExpectations)
    .where(
      and(
        eq(paymentExpectations.id, expectationId),
        eq(paymentExpectations.workspaceId, actor.workspaceId),
        isNull(paymentExpectations.deletedAt),
      ),
    )
    .limit(1);
  if (!row) throw new ApiError("not_found", "No encontramos ese cobro", 404);
  return row;
}

async function receivedSum(db: Db, actor: CrmActor, expectationId: string) {
  const rows = await db
    .select({ amountMinor: paymentsReceived.amountMinor })
    .from(paymentsReceived)
    .where(
      and(
        eq(paymentsReceived.paymentExpectationId, expectationId),
        eq(paymentsReceived.workspaceId, actor.workspaceId),
        isNull(paymentsReceived.deletedAt),
      ),
    );
  return rows.reduce((sum, row) => sum + row.amountMinor, 0n);
}

export async function updatePayment(db: Db, actor: CrmActor, expectationId: string, input: unknown) {
  const current = await requireExpectation(db, actor, expectationId);
  const data = parseInput(updatePaymentSchema, input);
  const user = await clock(db, actor.userId);
  const received = await receivedSum(db, actor, expectationId);
  const currency = data.currency ?? current.currency;
  if (data.currency && data.currency !== current.currency && received > 0n) {
    throw new ApiError("currency_locked", "Esta cuota ya tiene cobros en otra moneda", 409);
  }
  const amountMinor = data.amount ? moneyPair(data.amount, currency).amountMinor ?? current.amountMinor : current.amountMinor;
  const dueDate = data.dueDate ?? current.dueDate;
  const status = nextPaymentStatus({
    amountMinor,
    receivedMinor: received,
    dueDate,
    todayISO: user.todayISO,
    writtenOff: data.status === "written_off" || (data.status === undefined && current.status === "written_off"),
  });
  if (data.status === "pending" && current.status === "written_off") {
    // Reopen. nextPaymentStatus already ignores writtenOff when status is forced pending below.
  }
  const resolved = data.status === "pending"
    ? nextPaymentStatus({ amountMinor, receivedMinor: received, dueDate, todayISO: user.todayISO, writtenOff: false })
    : status;
  const [updated] = await db
    .update(paymentExpectations)
    .set({
      amountMinor,
      currency,
      dueDate,
      note: data.note !== undefined ? data.note : current.note,
      status: resolved,
    })
    .where(eq(paymentExpectations.id, expectationId))
    .returning();
  if (!updated) throw new ApiError("not_found", "No encontramos ese cobro", 404);
  return updated;
}

export async function recordReceipt(db: Db, actor: CrmActor, expectationId: string, input: unknown) {
  const current = await requireExpectation(db, actor, expectationId);
  const data = parseInput(receiptSchema, input);
  if (data.currency !== current.currency) {
    throw new ApiError("currency_mismatch", "El cobro tiene que estar en la misma moneda de la cuota", 400);
  }
  const price = moneyPair(data.amount, data.currency);
  if (!price.amountMinor) throw new ApiError("invalid_amount", "El monto recibido es obligatorio", 400);
  const user = await clock(db, actor.userId);
  const receivedAt = data.receivedAt ? parseUserDateTime(data.receivedAt, user.timeZone) : new Date();
  const [receipt] = await db
    .insert(paymentsReceived)
    .values({
      paymentExpectationId: expectationId,
      workspaceId: actor.workspaceId,
      amountMinor: price.amountMinor,
      currency: current.currency,
      receivedAt,
      method: data.method,
      note: data.note ?? null,
    })
    .returning();
  if (!receipt) throw new ApiError("internal", "No se pudo registrar el cobro", 500);
  const received = await receivedSum(db, actor, expectationId);
  const status = nextPaymentStatus({
    amountMinor: current.amountMinor,
    receivedMinor: received,
    dueDate: current.dueDate,
    todayISO: user.todayISO,
    writtenOff: false,
  });
  await db.update(paymentExpectations).set({ status }).where(eq(paymentExpectations.id, expectationId));
  await logActivity(db, actor, current.dealId, "payment_marked", {
    expectationId,
    amountMinor: price.amountMinor.toString(),
    currency: current.currency,
    method: data.method,
  });
  return { receipt, status };
}

export async function persistOverdue(db: Db, workspaceId: string, todayISO: string): Promise<number> {
  const rows = await db
    .update(paymentExpectations)
    .set({ status: "overdue" })
    .where(
      and(
        eq(paymentExpectations.workspaceId, workspaceId),
        isNull(paymentExpectations.deletedAt),
        eq(paymentExpectations.status, "pending"),
        lt(paymentExpectations.dueDate, todayISO),
      ),
    )
    .returning({ id: paymentExpectations.id });
  return rows.length;
}

export async function addNote(db: Db, actor: CrmActor, dealId: string, input: unknown) {
  await requireDeal(db, actor, dealId);
  const data = parseInput(noteSchema, input);
  await logActivity(db, actor, dealId, "note", { text: data.text });
  return { ok: true };
}

async function composeFollowUp(
  db: Db,
  actor: CrmActor,
  payment: {
    id: string;
    amountMinor: bigint;
    receivedMinor: bigint;
    currency: string;
    dueDate: string;
    dealTitle: string;
    brandName: string;
    contactName: string | null;
    contactWhatsapp: string | null;
    contactEmail: string | null;
  },
  channel: "whatsapp" | "email",
  templates?: FollowUpTemplates,
) {
  const user = await clock(db, actor.userId);
  const catalog = loadMessages(user.locale) as { crm?: { followUpText?: string; followUpSubject?: string } };
  const outstanding = outstandingMinor(payment.amountMinor, payment.receivedMinor);
  const amount = formatMoney(outstanding > 0n ? outstanding : payment.amountMinor, payment.currency, user.locale);
  return {
    paymentId: payment.id,
    ...buildFollowUp({
      who: payment.contactName || payment.brandName,
      title: payment.dealTitle,
      amount,
      due: formatCalendarDate(payment.dueDate, user.locale),
      creator: user.name,
      brand: payment.brandName,
      template: templates?.template ?? catalog.crm?.followUpText,
      subjectTemplate: templates?.subjectTemplate ?? catalog.crm?.followUpSubject,
      phoneE164: payment.contactWhatsapp,
      email: payment.contactEmail,
      channel,
    }),
  };
}

export async function followUpForDeal(db: Db, actor: CrmActor, dealId: string, channel: "whatsapp" | "email", templates?: FollowUpTemplates) {
  await requireDeal(db, actor, dealId);
  const user = await clock(db, actor.userId);
  const payments = await listPaymentExpectations(db, actor.workspaceId, { dealId });
  const open = payments
    .map((payment) => ({ ...payment, display: displayPaymentStatus(payment.status, payment.dueDate, user.todayISO) }))
    .filter((payment) => payment.display !== "paid" && payment.display !== "written_off" && outstandingMinor(payment.amountMinor, payment.receivedMinor) > 0n)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const chosen = open.find((payment) => payment.display === "overdue") ?? open[0];
  if (!chosen) throw new ApiError("nothing_pending", "Este acuerdo no tiene cobros pendientes", 404);
  return composeFollowUp(db, actor, chosen, channel, templates);
}

export async function listBrandContacts(db: Db, actor: CrmActor, brandId: string) {
  await requireBrand(db, actor, brandId);
  return listContacts(db, actor.workspaceId, brandId);
}
