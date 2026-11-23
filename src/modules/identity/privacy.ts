import { and, eq, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import { withAdmin, withUser } from "../../db/client";
import type { Db } from "../../db/types";
import { ApiError } from "../../lib/errors";
import {
  activities,
  attachments,
  brandContacts,
  brands,
  deals,
  deliverables,
  paymentExpectations,
  paymentsReceived,
  pipelineStages,
} from "../crm/schema";
import { listDeliverables, listDeals, listPaymentExpectations, listBrands } from "../crm/queries";
import { creatorProfiles, metricSnapshots, posts, services, socialAccounts } from "../media-kit/schema";
import { notifications, reminderMutes, reminderRules, whatsappConsents } from "../reminders/schema";
import { listMemberships } from "./queries";
import { auditLog, invitations, legalAcceptances, magicLinks, memberships, users, workspaces } from "./schema";

const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function minorDecimal(amount: bigint, currency: string): string {
  if (currency === "COP") return (amount / 100n).toString();
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  return `${negative ? "-" : ""}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, "0")}`;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export async function exportAccount(userId: string) {
  return withUser(userId, async (db) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.deletedAt) throw new ApiError("unauthorized", "Tenés que iniciar sesión", 401);
    const membershipList = await listMemberships(db, userId);
    const owned = membershipList.filter((membership) => membership.role === "owner");
    const spaces = [];
    for (const membership of owned) {
      const profiles = await db
        .select({
          id: creatorProfiles.id,
          displayName: creatorProfiles.displayName,
          slug: creatorProfiles.slug,
          country: creatorProfiles.country,
          city: creatorProfiles.city,
          niches: creatorProfiles.niches,
          publicEmail: creatorProfiles.publicEmail,
        })
        .from(creatorProfiles)
        .where(and(eq(creatorProfiles.workspaceId, membership.workspaceId), isNull(creatorProfiles.deletedAt)));
      spaces.push({
        workspaceId: membership.workspaceId,
        name: membership.workspaceName,
        currency: membership.currency,
        brands: await listBrands(db, membership.workspaceId),
        deals: await listDeals(db, membership.workspaceId),
        deliverables: await listDeliverables(db, membership.workspaceId),
        payments: await listPaymentExpectations(db, membership.workspaceId),
        profiles,
      });
    }
    const consents = await db.select().from(whatsappConsents).where(eq(whatsappConsents.userId, userId));
    const legal = await db.select().from(legalAcceptances).where(eq(legalAcceptances.userId, userId));
    const notes = await db
      .select({
        id: notifications.id,
        workspaceId: notifications.workspaceId,
        channel: notifications.channel,
        template: notifications.template,
        status: notifications.status,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.deletedAt)))
      .limit(200);
    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        timezone: user.timezone,
        country: user.country,
        phoneE164: user.phoneE164,
        phoneVerifiedAt: user.phoneVerifiedAt,
        createdAt: user.createdAt,
      },
      legalAcceptances: legal,
      whatsappConsents: consents.map((consent) => ({
        phoneE164: consent.phoneE164,
        grantedAt: consent.grantedAt,
        revokedAt: consent.revokedAt,
        source: consent.source,
        consentTextVersion: consent.consentTextVersion,
      })),
      memberships: membershipList,
      workspaces: spaces,
      notifications: notes,
    };
  });
}

export function exportCsv(data: Awaited<ReturnType<typeof exportAccount>>): string {
  const header = ["espacio", "marca", "titulo", "moneda", "monto", "estado", "vencimiento"];
  const lines = [header.join(",")];
  for (const space of data.workspaces) {
    for (const payment of space.payments) {
      lines.push(
        [
          space.name,
          payment.brandName,
          payment.dealTitle,
          payment.currency,
          minorDecimal(payment.amountMinor, payment.currency),
          payment.status,
          payment.dueDate,
        ]
          .map((value) => csvCell(String(value)))
          .join(","),
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export async function softDeleteAccount(userId: string, confirm: string, ip?: string): Promise<void> {
  if (confirm !== "BORRAR") {
    throw new ApiError("confirm_required", "Escribí BORRAR para confirmar el borrado", 400);
  }
  await withUser(userId, async (db) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user || user.deletedAt) throw new ApiError("unauthorized", "Tenés que iniciar sesión", 401);
    const membershipList = await listMemberships(db, userId);
    await db
      .update(whatsappConsents)
      .set({ revokedAt: new Date() })
      .where(and(eq(whatsappConsents.userId, userId), isNull(whatsappConsents.revokedAt)));
    await db.update(users).set({ deletedAt: new Date(), phoneE164: null, phoneVerifiedAt: null }).where(eq(users.id, userId));
    for (const membership of membershipList.filter((item) => item.role === "owner")) {
      await db.insert(auditLog).values({
        workspaceId: membership.workspaceId,
        actorUserId: userId,
        action: "account_soft_delete",
        entity: "user",
        entityId: userId,
        ip: ip ?? null,
      });
    }
  });
}

async function purgeWorkspace(db: Db, workspaceId: string): Promise<void> {
  const profiles = await db.select({ id: creatorProfiles.id }).from(creatorProfiles).where(eq(creatorProfiles.workspaceId, workspaceId));
  const profileIds = profiles.map((profile) => profile.id);
  if (profileIds.length > 0) {
    const accounts = await db.select({ id: socialAccounts.id }).from(socialAccounts).where(inArray(socialAccounts.creatorProfileId, profileIds));
    const accountIds = accounts.map((account) => account.id);
    if (accountIds.length > 0) {
      await db.delete(metricSnapshots).where(inArray(metricSnapshots.socialAccountId, accountIds));
      await db.delete(posts).where(inArray(posts.socialAccountId, accountIds));
      await db.delete(socialAccounts).where(inArray(socialAccounts.id, accountIds));
    }
    await db.delete(services).where(inArray(services.creatorProfileId, profileIds));
  }
  await db.delete(paymentsReceived).where(eq(paymentsReceived.workspaceId, workspaceId));
  await db.delete(paymentExpectations).where(eq(paymentExpectations.workspaceId, workspaceId));
  await db.delete(activities).where(eq(activities.workspaceId, workspaceId));
  await db.delete(attachments).where(eq(attachments.workspaceId, workspaceId));
  await db.delete(deliverables).where(eq(deliverables.workspaceId, workspaceId));
  await db.delete(reminderMutes).where(eq(reminderMutes.workspaceId, workspaceId));
  await db.delete(deals).where(eq(deals.workspaceId, workspaceId));
  await db.delete(brandContacts).where(eq(brandContacts.workspaceId, workspaceId));
  await db.delete(brands).where(eq(brands.workspaceId, workspaceId));
  await db.delete(notifications).where(eq(notifications.workspaceId, workspaceId));
  await db.delete(reminderRules).where(eq(reminderRules.workspaceId, workspaceId));
  await db.delete(pipelineStages).where(eq(pipelineStages.workspaceId, workspaceId));
  if (profileIds.length > 0) await db.delete(creatorProfiles).where(inArray(creatorProfiles.id, profileIds));
  await db.delete(auditLog).where(eq(auditLog.workspaceId, workspaceId));
  await db.delete(invitations).where(eq(invitations.workspaceId, workspaceId));
  await db.delete(memberships).where(eq(memberships.workspaceId, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

async function purgeUser(db: Db, userId: string): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return;
  const memberRows = await db.select().from(memberships).where(eq(memberships.userId, userId));
  for (const membership of memberRows) {
    const others = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.workspaceId, membership.workspaceId), ne(memberships.userId, userId), isNull(memberships.deletedAt)));
    if (others.length === 0) await purgeWorkspace(db, membership.workspaceId);
  }
  const profiles = await db.select({ id: creatorProfiles.id }).from(creatorProfiles).where(eq(creatorProfiles.userId, userId));
  if (profiles.length > 0) {
    await db
      .update(socialAccounts)
      .set({ accessTokenEnc: null, refreshTokenEnc: null, status: "revoked" })
      .where(inArray(socialAccounts.creatorProfileId, profiles.map((profile) => profile.id)));
  }
  await db.delete(magicLinks).where(eq(magicLinks.email, user.email));
  await db.delete(invitations).where(eq(invitations.email, user.email));
  await db.delete(users).where(eq(users.id, userId));
}

export async function hardDeleteExpiredAccounts(now = new Date()): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_MS);
  return withAdmin(async (db) => {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(isNotNull(users.deletedAt), lte(users.deletedAt, cutoff)));
    for (const row of rows) await purgeUser(db, row.id);
    return { deleted: rows.length };
  });
}
