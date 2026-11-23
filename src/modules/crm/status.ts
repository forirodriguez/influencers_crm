export type PaymentStatus = "pending" | "overdue" | "partial" | "paid" | "written_off";

/** Until payments.mark-overdue persists the status, the read model treats a past due date as overdue. */
export function displayPaymentStatus(status: PaymentStatus, dueDate: string, todayISO: string): PaymentStatus {
  if (status === "pending" && dueDate < todayISO) return "overdue";
  return status;
}
