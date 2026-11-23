import { and, asc, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import type { Db } from "../../db/types";
import { brands, deals, deliverables, paymentExpectations, paymentsReceived, pipelineStages } from "./schema";

export async function listStages(db: Db, workspaceId: string) {
  return db
    .select()
    .from(pipelineStages)
    .where(and(eq(pipelineStages.workspaceId, workspaceId), isNull(pipelineStages.deletedAt)))
    .orderBy(asc(pipelineStages.position));
}

export async function listBrands(db: Db, workspaceId: string) {
  return db
    .select()
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId), isNull(brands.deletedAt)))
    .orderBy(asc(brands.name))
    .limit(100);
}

export async function listDeals(db: Db, workspaceId: string) {
  return db
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
      compensationType: deals.compensationType,
      creatorProfileId: deals.creatorProfileId,
      updatedAt: deals.updatedAt,
      lostReason: deals.lostReason,
    })
    .from(deals)
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .where(and(eq(deals.workspaceId, workspaceId), isNull(deals.deletedAt)))
    .orderBy(asc(pipelineStages.position), desc(deals.updatedAt))
    .limit(100);
}

export async function getDeal(db: Db, workspaceId: string, dealId: string) {
  const rows = await listDeals(db, workspaceId);
  return rows.find((row) => row.id === dealId) ?? null;
}

export async function listDeliverables(db: Db, workspaceId: string) {
  return db
    .select({
      id: deliverables.id,
      dealId: deliverables.dealId,
      dealTitle: deals.title,
      brandName: brands.name,
      platform: deliverables.platform,
      format: deliverables.format,
      quantity: deliverables.quantity,
      status: deliverables.status,
      draftDueAt: deliverables.draftDueAt,
      approvalDueAt: deliverables.approvalDueAt,
      publishDueAt: deliverables.publishDueAt,
    })
    .from(deliverables)
    .innerJoin(deals, eq(deals.id, deliverables.dealId))
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .where(and(eq(deliverables.workspaceId, workspaceId), isNull(deliverables.deletedAt)))
    .orderBy(asc(deliverables.publishDueAt))
    .limit(100);
}

export async function listUpcomingDeliverables(db: Db, workspaceId: string, until: Date) {
  const rows = await listDeliverables(db, workspaceId);
  return rows.filter((row) => {
    if (row.status === "published" || row.status === "cancelled") return false;
    const due = row.publishDueAt ?? row.draftDueAt ?? row.approvalDueAt;
    return due !== null && due.getTime() <= until.getTime();
  });
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

export async function listPaymentExpectations(db: Db, workspaceId: string) {
  return db
    .select({
      id: paymentExpectations.id,
      dealId: paymentExpectations.dealId,
      dealTitle: deals.title,
      brandName: brands.name,
      amountMinor: paymentExpectations.amountMinor,
      currency: paymentExpectations.currency,
      dueDate: paymentExpectations.dueDate,
      status: paymentExpectations.status,
      note: paymentExpectations.note,
    })
    .from(paymentExpectations)
    .innerJoin(deals, eq(deals.id, paymentExpectations.dealId))
    .innerJoin(brands, eq(brands.id, deals.brandId))
    .where(and(eq(paymentExpectations.workspaceId, workspaceId), isNull(paymentExpectations.deletedAt)))
    .orderBy(asc(paymentExpectations.dueDate))
    .limit(100);
}

export async function paymentSummary(db: Db, workspaceId: string, todayISO: string) {
  const rows = await listPaymentExpectations(db, workspaceId);
  const receipts = await db
    .select({
      expectationId: paymentsReceived.paymentExpectationId,
      currency: paymentsReceived.currency,
      amountMinor: paymentsReceived.amountMinor,
    })
    .from(paymentsReceived)
    .where(and(eq(paymentsReceived.workspaceId, workspaceId), isNull(paymentsReceived.deletedAt)));

  const receivedByExpectation = new Map<string, bigint>();
  for (const receipt of receipts) {
    receivedByExpectation.set(
      receipt.expectationId,
      (receivedByExpectation.get(receipt.expectationId) ?? 0n) + receipt.amountMinor,
    );
  }

  const summary = new Map<string, { pending: bigint; overdue: bigint; paid: bigint }>();
  const bucket = (currency: string) => {
    const current = summary.get(currency) ?? { pending: 0n, overdue: 0n, paid: 0n };
    summary.set(currency, current);
    return current;
  };

  for (const row of rows) {
    const item = bucket(row.currency);
    const received = receivedByExpectation.get(row.id) ?? 0n;
    item.paid += received;
    if (row.status === "paid" || row.status === "written_off") continue;
    const outstanding = row.amountMinor > received ? row.amountMinor - received : 0n;
    const status = row.status === "pending" && row.dueDate < todayISO ? "overdue" : row.status;
    if (status === "overdue") item.overdue += outstanding;
    else item.pending += outstanding;
  }

  return [...summary.entries()].map(([currency, amounts]) => ({ currency, ...amounts }));
}

export async function listOpenDealCount(db: Db, workspaceId: string) {
  const rows = await db
    .select({ id: deals.id })
    .from(deals)
    .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
    .where(and(eq(deals.workspaceId, workspaceId), isNull(deals.deletedAt), or(eq(pipelineStages.kind, "open"), eq(pipelineStages.kind, "won"))))
    .limit(200);
  return rows.length;
}
