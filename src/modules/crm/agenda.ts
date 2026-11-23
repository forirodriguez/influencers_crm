import { zonedDateISO } from "../../lib/dates";
import { displayPaymentStatus, type PaymentStatus } from "./status";

/** The date a creator has to act on: publish, then approval, then draft. */
export function deliverableAnchor(row: {
  publishDueAt: Date | null;
  approvalDueAt: Date | null;
  draftDueAt: Date | null;
}): Date | null {
  return row.publishDueAt ?? row.approvalDueAt ?? row.draftDueAt;
}

export function isOpenDeliverable(status: string): boolean {
  return status === "pending" || status === "in_review" || status === "approved";
}

export function isOverduePayment(status: PaymentStatus, dueDate: string, todayISO: string): boolean {
  return displayPaymentStatus(status, dueDate, todayISO) === "overdue";
}

export function isOpenPayment(status: PaymentStatus, dueDate: string, todayISO: string): boolean {
  const shown = displayPaymentStatus(status, dueDate, todayISO);
  return shown === "pending" || shown === "overdue" || shown === "partial";
}

export function inLocalWindow(anchor: Date, timeZone: string, fromISO: string, toISO: string): boolean {
  const local = zonedDateISO(anchor, timeZone);
  return local >= fromISO && local <= toISO;
}
