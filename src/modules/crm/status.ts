export type PaymentStatus = "pending" | "overdue" | "partial" | "paid" | "written_off";

/** Until payments.mark-overdue persists the status, the read model treats a past due date as overdue. */
export function displayPaymentStatus(status: PaymentStatus, dueDate: string, todayISO: string): PaymentStatus {
  if ((status === "pending" || status === "partial") && dueDate < todayISO) return status === "partial" ? "partial" : "overdue";
  return status;
}

const statusRank: Record<PaymentStatus, number> = {
  overdue: 5,
  pending: 4,
  partial: 3,
  written_off: 2,
  paid: 1,
};

export function worstPaymentStatus(statuses: PaymentStatus[]): PaymentStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((worst, status) => (statusRank[status] > statusRank[worst] ? status : worst));
}

export function outstandingMinor(amountMinor: bigint, receivedMinor: bigint): bigint {
  return amountMinor > receivedMinor ? amountMinor - receivedMinor : 0n;
}

export function nextPaymentStatus(input: {
  amountMinor: bigint;
  receivedMinor: bigint;
  dueDate: string;
  todayISO: string;
  writtenOff?: boolean;
}): PaymentStatus {
  if (input.receivedMinor >= input.amountMinor && input.amountMinor > 0n) return "paid";
  if (input.writtenOff) return "written_off";
  if (input.receivedMinor > 0n) return "partial";
  if (input.dueDate < input.todayISO) return "overdue";
  return "pending";
}
