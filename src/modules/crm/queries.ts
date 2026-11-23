import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "../../db/types";
import { normalizeName } from "../../lib/names";
import { zonedDateISO } from "../../lib/dates";
import { creatorProfiles } from "../media-kit/schema";
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
import { deliverableAnchor, inLocalWindow, isOpenDeliverable } from "./agenda";
import { displayPaymentStatus, worstPaymentStatus, type PaymentStatus } from "./status";

export type DealFilters = {
  todayISO?: string;
  stageId?: string;
  brandId?: string;
  profileId?: string;
  from?: string;
  to?: string;
  paymentStatus?: string;
};

function workspaceAlive(workspaceId: string, table: { workspaceId: unknown; deletedAt: unknown }) {
  return and(eq(table.workspaceId as typeof brands.workspaceId, workspaceId), isNull(table.deletedAt as typeof brands.deletedAt));
}

export async function listStages(db: Db, workspaceId: string) {
  return db
    .select()
    .from(pipelineStages)
    .where(workspaceAlive(workspaceId, pipelineStages))
    .orderBy(asc(pipelineStages.position));
}

export async function listProfiles(db: Db, workspaceId: string) {
  return db
    .select({ id: creatorProfiles.id, displayName: creatorProfiles.displayName, userId: creatorProfiles.userId })
    .from(creatorProfiles)
    .where(and(eq(creatorProfiles.workspaceId, workspaceId), isNull(creatorProfiles.deletedAt)))
    .orderBy(asc(creatorProfiles.displayName));
}

export async function listBrands(db: Db, workspaceId: string, query?: string) {
  const needle = query ? normalizeName(query) : "";
  return db
    .select()
    .from(brands)
    .where(
      and(
        workspaceAlive(workspaceId, brands),
        needle ? sql`${brands.nameNormalized} ILIKE ${"%" + needle + "%"}` : undefined,
      ),
    )
    .orderBy(asc(brands.name))
    .limit(100);
}

export async function getBrand(db: Db, workspaceId: string, brandId: string) {
  const [brand] = await db.select().from(brands).where(and(eq(brands.id, brandId), workspaceAlive(workspaceId, brands))).limit(1);
  return brand ?? null;
}

export async function listContacts(db: Db, workspaceId: string, brandId: string) {
  return db
    .select()
    .from(brandContacts)
    .where(and(eq(brandContacts.brandId, brandId), workspaceAlive(workspaceId, brandContacts)))
    .orderBy(asc(brandContacts.name));
}

export async function listDeals(db: Db, workspaceId: string, filters: DealFilters = {}) {
  const todayISO = filters.todayISO ?? new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      id: deals.id,
      title: deals.title,
      stageId: deals.stageId,
      stageName: pipelineStages.name,
      stageKind: pipelineStages.kind,
      stagePosition: pipelineStages.position,
      brandId: brands.id,
      brandName: brands.name,
      amountMinor: deals.amountMinor,
      currency: deals.currency,
      barterValueMinor: deals.barterValueMinor,
      barterCurrency: deals.barterCurrency,
      compensationType: deals.compensationType,
      creatorProfileId: deals.creatorProfileId,
      creatorName: creatorProfiles.displayName,
      updatedAt: deals.updatedAt,
      createdAt: deals.createdAt,
      expectedCloseDate: deals.expectedCloseDate,
      lostReason: deals.lostReason,
      exclusivityCategory: deals.exclusivityCategory,
      exclusivityUntil: deals.exclusivityUntil,
      source: deals.source,
      notes: deals.notes,
      primaryContactId: deals.primaryContactId,
    })
    .from(deals)
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .innerJoin(creatorProfiles, eq(creatorProfiles.id, deals.creatorProfileId))
    .where(
      and(
        eq(deals.workspaceId, workspaceId),
        isNull(deals.deletedAt),
        isNull(brands.deletedAt),
        filters.stageId ? eq(deals.stageId, filters.stageId) : undefined,
        filters.brandId ? eq(deals.brandId, filters.brandId) : undefined,
        filters.profileId ? eq(deals.creatorProfileId, filters.profileId) : undefined,
      ),
    )
    .orderBy(asc(pipelineStages.position), desc(deals.updatedAt))
    .limit(200);

  const expectations = await db
    .select({
      dealId: paymentExpectations.dealId,
      status: paymentExpectations.status,
      dueDate: paymentExpectations.dueDate,
    })
    .from(paymentExpectations)
    .where(workspaceAlive(workspaceId, paymentExpectations));

  const byDeal = new Map<string, PaymentStatus[]>();
  for (const row of expectations) {
    const list = byDeal.get(row.dealId) ?? [];
    list.push(displayPaymentStatus(row.status, row.dueDate, todayISO));
    byDeal.set(row.dealId, list);
  }

  let result = rows.map((row) => ({
    ...row,
    paymentStatus: worstPaymentStatus(byDeal.get(row.id) ?? []),
  }));

  if (filters.from || filters.to) {
    result = result.filter((row) => {
      const key = row.expectedCloseDate ?? row.createdAt.toISOString().slice(0, 10);
      if (filters.from && key < filters.from) return false;
      if (filters.to && key > filters.to) return false;
      return true;
    });
  }
  if (filters.paymentStatus) {
    result = result.filter((row) => (row.paymentStatus ?? "none") === filters.paymentStatus);
  }
  return result;
}

export async function getDeal(db: Db, workspaceId: string, dealId: string) {
  const rows = await listDeals(db, workspaceId);
  return rows.find((row) => row.id === dealId) ?? null;
}

export async function listDeliverables(db: Db, workspaceId: string, filters: { dealId?: string } = {}) {
  return db
    .select({
      id: deliverables.id,
      dealId: deliverables.dealId,
      dealTitle: deals.title,
      brandId: brands.id,
      brandName: brands.name,
      platform: deliverables.platform,
      format: deliverables.format,
      quantity: deliverables.quantity,
      status: deliverables.status,
      draftDueAt: deliverables.draftDueAt,
      approvalDueAt: deliverables.approvalDueAt,
      publishDueAt: deliverables.publishDueAt,
      postUrl: deliverables.postUrl,
    })
    .from(deliverables)
    .innerJoin(deals, eq(deals.id, deliverables.dealId))
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .where(
      and(
        eq(deliverables.workspaceId, workspaceId),
        isNull(deliverables.deletedAt),
        isNull(deals.deletedAt),
        filters.dealId ? eq(deliverables.dealId, filters.dealId) : undefined,
      ),
    )
    .orderBy(asc(deliverables.publishDueAt))
    .limit(300);
}

export async function listDeliverablesInWindow(
  db: Db,
  workspaceId: string,
  timeZone: string,
  fromISO: string,
  toISO: string,
) {
  const rows = await listDeliverables(db, workspaceId);
  return rows.filter((row) => {
    if (!isOpenDeliverable(row.status)) return false;
    const due = deliverableAnchor(row);
    return due !== null && inLocalWindow(due, timeZone, fromISO, toISO);
  });
}

export async function listUpcomingDeliverables(db: Db, workspaceId: string, until: Date, timeZone = "UTC", now = new Date()) {
  return listDeliverablesInWindow(db, workspaceId, timeZone, zonedDateISO(now, timeZone), zonedDateISO(until, timeZone));
}

export async function listStaleDeals(db: Db, workspaceId: string, cutoff: Date) {
  return db
    .select({
      id: deals.id,
      title: deals.title,
      brandName: brands.name,
      updatedAt: deals.updatedAt,
      stageName: pipelineStages.name,
    })
    .from(deals)
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .where(
      and(
        eq(deals.workspaceId, workspaceId),
        isNull(deals.deletedAt),
        inArray(pipelineStages.kind, ["open"]),
        lte(deals.updatedAt, cutoff),
      ),
    )
    .orderBy(asc(deals.updatedAt))
    .limit(20);
}

async function receivedByExpectation(db: Db, workspaceId: string) {
  const receipts = await db
    .select({
      expectationId: paymentsReceived.paymentExpectationId,
      amountMinor: paymentsReceived.amountMinor,
    })
    .from(paymentsReceived)
    .where(workspaceAlive(workspaceId, paymentsReceived));
  const totals = new Map<string, bigint>();
  for (const receipt of receipts) {
    totals.set(receipt.expectationId, (totals.get(receipt.expectationId) ?? 0n) + receipt.amountMinor);
  }
  return totals;
}

export async function listPaymentExpectations(db: Db, workspaceId: string, filters: { dealId?: string } = {}) {
  const rows = await db
    .select({
      id: paymentExpectations.id,
      dealId: paymentExpectations.dealId,
      dealTitle: deals.title,
      brandId: brands.id,
      brandName: brands.name,
      amountMinor: paymentExpectations.amountMinor,
      currency: paymentExpectations.currency,
      dueDate: paymentExpectations.dueDate,
      status: paymentExpectations.status,
      note: paymentExpectations.note,
      contactName: brandContacts.name,
      contactWhatsapp: brandContacts.whatsappE164,
      contactEmail: brandContacts.email,
      contactDeletedAt: brandContacts.deletedAt,
    })
    .from(paymentExpectations)
    .innerJoin(deals, eq(deals.id, paymentExpectations.dealId))
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .leftJoin(brandContacts, eq(brandContacts.id, deals.primaryContactId))
    .where(
      and(
        eq(paymentExpectations.workspaceId, workspaceId),
        isNull(paymentExpectations.deletedAt),
        isNull(deals.deletedAt),
        filters.dealId ? eq(paymentExpectations.dealId, filters.dealId) : undefined,
      ),
    )
    .orderBy(asc(paymentExpectations.dueDate))
    .limit(300);

  const totals = await receivedByExpectation(db, workspaceId);
  return rows.map((row) => ({
    id: row.id,
    dealId: row.dealId,
    dealTitle: row.dealTitle,
    brandId: row.brandId,
    brandName: row.brandName,
    amountMinor: row.amountMinor,
    currency: row.currency,
    dueDate: row.dueDate,
    status: row.status,
    note: row.note,
    contactName: row.contactDeletedAt ? null : row.contactName,
    contactWhatsapp: row.contactDeletedAt ? null : row.contactWhatsapp,
    contactEmail: row.contactDeletedAt ? null : row.contactEmail,
    receivedMinor: totals.get(row.id) ?? 0n,
  }));
}

export async function listReceipts(db: Db, workspaceId: string, expectationId: string) {
  return db
    .select()
    .from(paymentsReceived)
    .where(and(eq(paymentsReceived.paymentExpectationId, expectationId), workspaceAlive(workspaceId, paymentsReceived)))
    .orderBy(desc(paymentsReceived.receivedAt));
}

export async function paymentSummary(db: Db, workspaceId: string, todayISO: string, timeZone = "UTC") {
  const month = todayISO.slice(0, 7);
  const rows = await listPaymentExpectations(db, workspaceId);
  const receipts = await db
    .select({
      currency: paymentsReceived.currency,
      amountMinor: paymentsReceived.amountMinor,
      receivedAt: paymentsReceived.receivedAt,
    })
    .from(paymentsReceived)
    .where(workspaceAlive(workspaceId, paymentsReceived));

  const summary = new Map<string, { pending: bigint; overdue: bigint; paid: bigint; paidThisMonth: bigint }>();
  const bucket = (currency: string) => {
    const current = summary.get(currency) ?? { pending: 0n, overdue: 0n, paid: 0n, paidThisMonth: 0n };
    summary.set(currency, current);
    return current;
  };

  for (const receipt of receipts) {
    const item = bucket(receipt.currency);
    item.paid += receipt.amountMinor;
    if (zonedDateISO(receipt.receivedAt, timeZone).slice(0, 7) === month) item.paidThisMonth += receipt.amountMinor;
  }

  for (const row of rows) {
    if (row.status === "paid" || row.status === "written_off") {
      bucket(row.currency);
      continue;
    }
    const item = bucket(row.currency);
    const outstanding = row.amountMinor > row.receivedMinor ? row.amountMinor - row.receivedMinor : 0n;
    const status = displayPaymentStatus(row.status, row.dueDate, todayISO);
    const late = row.dueDate < todayISO && status !== "paid" && status !== "written_off";
    if (status === "overdue" || late) item.overdue += outstanding;
    else item.pending += outstanding;
  }

  const order = ["UYU", "ARS", "MXN", "COP", "USD"];
  return [...summary.entries()]
    .map(([currency, amounts]) => ({ currency, ...amounts }))
    .sort((a, b) => {
      const left = order.indexOf(a.currency);
      const right = order.indexOf(b.currency);
      return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
    });
}

export async function listActivities(db: Db, workspaceId: string, dealId: string) {
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.dealId, dealId), workspaceAlive(workspaceId, activities)))
    .orderBy(desc(activities.createdAt))
    .limit(50);
}

export async function findExclusivityClash(
  db: Db,
  workspaceId: string,
  input: { brandId: string; category: string | null | undefined; dealId?: string; todayISO: string },
) {
  const category = input.category?.trim();
  if (!category) return null;
  const [row] = await db
    .select({
      title: deals.title,
      until: deals.exclusivityUntil,
      brandName: brands.name,
      category: deals.exclusivityCategory,
    })
    .from(deals)
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .where(
      and(
        eq(deals.workspaceId, workspaceId),
        isNull(deals.deletedAt),
        eq(deals.exclusivityCategory, category),
        ne(deals.brandId, input.brandId),
        gte(deals.exclusivityUntil, input.todayISO),
        input.dealId ? ne(deals.id, input.dealId) : undefined,
      ),
    )
    .limit(1);
  if (!row?.until || !row.category) return null;
  return { title: row.title, until: row.until, brandName: row.brandName, category: row.category };
}

export async function brandPaceDays(db: Db, workspaceId: string, brandId: string): Promise<number | null> {
  const published = await db
    .select({ dealId: deliverables.dealId, publishDueAt: deliverables.publishDueAt })
    .from(deliverables)
    .innerJoin(deals, eq(deals.id, deliverables.dealId))
    .where(
      and(
        eq(deliverables.workspaceId, workspaceId),
        eq(deals.brandId, brandId),
        isNull(deliverables.deletedAt),
        isNull(deals.deletedAt),
        eq(deliverables.status, "published"),
      ),
    );
  const receipts = await db
    .select({ dealId: paymentExpectations.dealId, receivedAt: paymentsReceived.receivedAt })
    .from(paymentsReceived)
    .innerJoin(paymentExpectations, eq(paymentExpectations.id, paymentsReceived.paymentExpectationId))
    .innerJoin(deals, eq(deals.id, paymentExpectations.dealId))
    .where(
      and(
        eq(paymentsReceived.workspaceId, workspaceId),
        eq(deals.brandId, brandId),
        isNull(paymentsReceived.deletedAt),
        isNull(paymentExpectations.deletedAt),
      ),
    );

  const publishByDeal = new Map<string, number>();
  for (const row of published) {
    if (!row.publishDueAt) continue;
    const current = publishByDeal.get(row.dealId);
    const time = row.publishDueAt.getTime();
    if (current === undefined || time < current) publishByDeal.set(row.dealId, time);
  }
  const paidByDeal = new Map<string, number>();
  for (const row of receipts) {
    const current = paidByDeal.get(row.dealId);
    const time = row.receivedAt.getTime();
    if (current === undefined || time < current) paidByDeal.set(row.dealId, time);
  }
  const samples: number[] = [];
  for (const [dealId, publishedAt] of publishByDeal) {
    const paidAt = paidByDeal.get(dealId);
    if (paidAt === undefined) continue;
    samples.push(Math.round((paidAt - publishedAt) / 86_400_000));
  }
  if (samples.length === 0) return null;
  return Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length);
}

export async function listOpenDealCount(db: Db, workspaceId: string) {
  const rows = await db
    .select({ id: deals.id })
    .from(deals)
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .where(
      and(
        eq(deals.workspaceId, workspaceId),
        isNull(deals.deletedAt),
        or(eq(pipelineStages.kind, "open"), eq(pipelineStages.kind, "won")),
      ),
    )
    .limit(200);
  return rows.length;
}
