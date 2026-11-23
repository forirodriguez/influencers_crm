"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { sendJson, textValue } from "./client";
import { FollowUp } from "./follow-up";
import { Button, ErrorNote, Field, Input, Select, TextArea } from "./fields";

const platforms = ["instagram", "tiktok", "other"] as const;
const formats = ["reel", "story", "post", "video", "ugc"] as const;
const statuses = ["pending", "in_review", "approved", "published", "cancelled"] as const;
const methods = ["bank_transfer", "mercado_pago", "cash", "paypal", "other"] as const;

export function StageSelect({
  dealId,
  stageId,
  stages,
}: {
  dealId: string;
  stageId: string;
  stages: { id: string; name: string; kind: string }[];
}) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [lost, setLost] = useState<string | null>(null);

  async function move(nextStageId: string, lostReason?: string) {
    const stage = stages.find((item) => item.id === nextStageId);
    if (stage?.kind === "lost" && !lostReason) {
      setLost(nextStageId);
      return;
    }
    setError(null);
    try {
      await sendJson(`/api/v1/deals/${dealId}/move`, "POST", { stageId: nextStageId, lostReason });
      setLost(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("save"));
    }
  }

  return (
    <div className="space-y-2">
      <ErrorNote message={error} />
      <Field label={t("stage")}>
        <Select value={stageId} aria-label={t("stage")} onChange={(event) => void move(event.target.value)}>
          {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
        </Select>
      </Field>
      {lost ? (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = new FormData(event.currentTarget).get("reason");
            if (typeof reason === "string") void move(lost, reason);
          }}
        >
          <Field label={t("lostReason")} hint={t("lostHelp")}>
            <Input name="reason" required />
          </Field>
          <Button type="submit">{t("save")}</Button>
        </form>
      ) : null}
    </div>
  );
}

export function NoteForm({ dealId }: { dealId: string }) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const form = event.currentTarget;
        try {
          await sendJson(`/api/v1/deals/${dealId}/activities`, "POST", { text: textValue(new FormData(form), "text") });
          form.reset();
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : t("save"));
        }
      }}
    >
      <ErrorNote message={error} />
      <TextArea name="text" required placeholder={t("notePlaceholder")} aria-label={t("addNote")} />
      <Button type="submit" variant="secondary">{t("addNote")}</Button>
    </form>
  );
}

export function WorkspaceDeliverableForm({ deals }: { deals: { id: string; label: string }[] }) {
  const t = useTranslations("crm");
  const labels = useTranslations("labels");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  if (deals.length === 0) return null;
  return (
    <form
      className="mt-6 grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
          await sendJson("/api/v1/deliverables", "POST", {
            dealId: textValue(data, "dealId"),
            platform: textValue(data, "platform"),
            format: textValue(data, "format"),
            quantity: textValue(data, "quantity") || 1,
            publishDueAt: textValue(data, "publishDueAt") || null,
            draftDueAt: textValue(data, "draftDueAt") || null,
            status: "pending",
          });
          form.reset();
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : t("save"));
        }
      }}
    >
      <div className="sm:col-span-2"><ErrorNote message={error} /></div>
      <Field label={t("deals")}>
        <Select name="dealId" defaultValue={deals[0]?.id}>
          {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.label}</option>)}
        </Select>
      </Field>
      <Field label={t("format")}>
        <Select name="format" defaultValue="reel">
          {formats.map((item) => <option key={item} value={item}>{labels(item)}</option>)}
        </Select>
      </Field>
      <Field label={t("platform")}>
        <Select name="platform" defaultValue="instagram">
          {platforms.map((item) => <option key={item} value={item}>{platformLabel(item, t)}</option>)}
        </Select>
      </Field>
      <Field label={t("publishDue")}><Input name="publishDueAt" type="datetime-local" /></Field>
      <Field label={t("draftDue")}><Input name="draftDueAt" type="datetime-local" /></Field>
      <Field label={t("quantity")}><Input name="quantity" type="number" min={1} defaultValue={1} /></Field>
      <div className="sm:col-span-2"><Button type="submit">{t("add")}</Button></div>
    </form>
  );
}

export function DeliverableForm({ dealId }: { dealId: string }) {
  const t = useTranslations("crm");
  const labels = useTranslations("labels");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
          await sendJson(`/api/v1/deals/${dealId}/deliverables`, "POST", {
            platform: textValue(data, "platform"),
            format: textValue(data, "format"),
            quantity: textValue(data, "quantity") || 1,
            draftDueAt: textValue(data, "draftDueAt") || null,
            approvalDueAt: textValue(data, "approvalDueAt") || null,
            publishDueAt: textValue(data, "publishDueAt") || null,
            postUrl: textValue(data, "postUrl") || null,
            status: textValue(data, "status") || "pending",
          });
          form.reset();
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : t("save"));
        }
      }}
    >
      <div className="sm:col-span-2"><ErrorNote message={error} /></div>
      <Field label={t("platform")}>
        <Select name="platform" defaultValue="instagram">
          {platforms.map((item) => <option key={item} value={item}>{platformLabel(item, t)}</option>)}
        </Select>
      </Field>
      <Field label={t("format")}>
        <Select name="format" defaultValue="reel">
          {formats.map((item) => <option key={item} value={item}>{labels(item)}</option>)}
        </Select>
      </Field>
      <Field label={t("quantity")}><Input name="quantity" type="number" min={1} defaultValue={1} /></Field>
      <Field label={t("status")}>
        <Select name="status" defaultValue="pending">
          {statuses.map((item) => <option key={item} value={item}>{labels(item)}</option>)}
        </Select>
      </Field>
      <Field label={t("draftDue")}><Input name="draftDueAt" type="datetime-local" /></Field>
      <Field label={t("approvalDue")}><Input name="approvalDueAt" type="datetime-local" /></Field>
      <Field label={t("publishDue")}><Input name="publishDueAt" type="datetime-local" /></Field>
      <Field label={t("postUrl")}><Input name="postUrl" /></Field>
      <div className="sm:col-span-2">
        <Button type="submit">{t("add")}</Button>
      </div>
    </form>
  );
}

export function DeliverableQuickEdit({
  dealId,
  deliverableId,
  status,
}: {
  dealId: string;
  deliverableId: string;
  status: string;
}) {
  const labels = useTranslations("labels");
  const router = useRouter();
  return (
    <Select
      aria-label={labels(status)}
      defaultValue={status}
      onChange={async (event) => {
        await sendJson(`/api/v1/deals/${dealId}/deliverables/${deliverableId}`, "PATCH", { status: event.target.value });
        router.refresh();
      }}
    >
      {statuses.map((item) => <option key={item} value={item}>{labels(item)}</option>)}
    </Select>
  );
}

export type PaymentCard = {
  id: string;
  amountLabel: string;
  outstandingLabel: string;
  receivedLabel: string;
  currency: string;
  dueDate: string;
  displayStatus: string;
  note: string | null;
  followUpText: string;
  followUpSubject: string;
  phone: string | null;
  email: string | null;
};

export function PaymentPanel({ dealId, payments, currencies, defaultCurrency }: {
  dealId: string;
  payments: PaymentCard[];
  currencies: string[];
  defaultCurrency: string;
}) {
  const t = useTranslations("crm");
  const labels = useTranslations("labels");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <ErrorNote message={error} />
      {payments.length === 0 ? <p className="text-sm text-muted">{t("noPayments")}</p> : null}
      <ul className="space-y-3">
        {payments.map((payment) => (
          <li key={payment.id} className="space-y-3 rounded-2xl border border-line bg-card p-4">
            <div>
              <p className="font-medium">{payment.amountLabel}</p>
              <p className="text-sm text-muted">
                {labels(payment.displayStatus)} · {t("due")} {payment.dueDate}
                {payment.receivedLabel ? ` · ${t("received")} ${payment.receivedLabel}` : ""}
                {payment.outstandingLabel ? ` · ${t("outstanding")} ${payment.outstandingLabel}` : ""}
              </p>
              {payment.note ? <p className="mt-1 text-sm">{payment.note}</p> : null}
            </div>
            {payment.displayStatus !== "paid" && payment.displayStatus !== "written_off" ? (
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setError(null);
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  try {
                    await sendJson(`/api/v1/payments/${payment.id}/receipts`, "POST", {
                      amount: textValue(data, "amount"),
                      currency: payment.currency,
                      method: textValue(data, "method"),
                      receivedAt: textValue(data, "receivedAt") || null,
                      note: textValue(data, "note") || null,
                    });
                    form.reset();
                    router.refresh();
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : t("save"));
                  }
                }}
              >
                <Field label={t("receivedAmount")} hint={t("partialNote")}>
                  <Input name="amount" required inputMode="decimal" />
                </Field>
                <Field label={t("method")}>
                  <Select name="method" defaultValue="bank_transfer">
                    {methods.map((method) => <option key={method} value={method}>{methodLabel(method, t)}</option>)}
                  </Select>
                </Field>
                <Field label={t("receivedDate")}><Input name="receivedAt" type="date" /></Field>
                <Field label={t("notes")}><Input name="note" /></Field>
                <div className="sm:col-span-2">
                  <Button type="submit">{t("markPaid")}</Button>
                </div>
              </form>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {payment.displayStatus !== "written_off" && payment.displayStatus !== "paid" ? (
                <button
                  type="button"
                  className="text-sm text-clay"
                  onClick={async () => {
                    await sendJson(`/api/v1/payments/${payment.id}`, "PATCH", { status: "written_off" });
                    router.refresh();
                  }}
                >
                  {t("writtenOff")}
                </button>
              ) : null}
              {payment.displayStatus === "written_off" ? (
                <button
                  type="button"
                  className="text-sm text-clay"
                  onClick={async () => {
                    await sendJson(`/api/v1/payments/${payment.id}`, "PATCH", { status: "pending" });
                    router.refresh();
                  }}
                >
                  {t("reopen")}
                </button>
              ) : null}
            </div>
            {payment.displayStatus !== "paid" && payment.displayStatus !== "written_off" ? (
              <FollowUp text={payment.followUpText} subject={payment.followUpSubject} phone={payment.phone} email={payment.email} />
            ) : null}
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3 rounded-2xl bg-sand p-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          const form = event.currentTarget;
          const data = new FormData(form);
          try {
            await sendJson(`/api/v1/deals/${dealId}/payments`, "POST", {
              amount: textValue(data, "amount"),
              currency: textValue(data, "currency"),
              dueDate: textValue(data, "dueDate"),
              note: textValue(data, "note") || null,
            });
            form.reset();
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : t("save"));
          }
        }}
      >
        <p className="text-sm font-medium sm:col-span-2">{t("addInstallment")}</p>
        <Field label={t("amount")}><Input name="amount" required inputMode="decimal" /></Field>
        <Field label={t("currency")}>
          <Select name="currency" defaultValue={defaultCurrency}>
            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </Select>
        </Field>
        <Field label={t("paymentDue")}><Input name="dueDate" type="date" required /></Field>
        <Field label={t("notes")}><Input name="note" /></Field>
        <div className="sm:col-span-2"><Button type="submit">{t("add")}</Button></div>
      </form>
    </div>
  );
}

function platformLabel(item: string, t: (key: string) => string) {
  if (item === "tiktok") return t("platformTiktok");
  if (item === "other") return t("platformOther");
  return t("platformInstagram");
}

function methodLabel(method: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    bank_transfer: "methodTransfer",
    mercado_pago: "methodMp",
    cash: "methodCash",
    paypal: "methodPaypal",
    other: "methodOther",
  };
  return t(map[method] ?? "methodOther");
}
