import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { CURRENCIES } from "../../../../lib/constants";
import { withUser } from "../../../../db/client";
import { formatCalendarDate, formatDateTime, zonedDateISO } from "../../../../lib/dates";
import { formatMoney } from "../../../../lib/money";
import { findExclusivityClash, getDeal, listActivities, listDeliverables, listPaymentExpectations, listStages } from "../../../../modules/crm/queries";
import { users } from "../../../../modules/identity/schema";
import { DeleteResource } from "../../../../modules/crm/ui/brand-forms";
import { DeliverableForm, DeliverableQuickEdit, NoteForm, PaymentPanel, StageSelect } from "../../../../modules/crm/ui/deal-panels";
import { displayPaymentStatus, outstandingMinor } from "../../../../modules/crm/status";
import { requireAppContext } from "../../../../modules/identity/context";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nav = await getTranslations("nav");
  const t = await getTranslations("crm");
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const canEdit = context.workspace.role !== "viewer";
  const deal = await withUser(context.user.id, async (db) => {
    const [user] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, context.user.id)).limit(1);
    const todayISO = zonedDateISO(new Date(), user?.timezone ?? context.user.timezone);
    const found = await getDeal(db, context.workspace.workspaceId, id);
    if (!found) return null;
    const [deliverables, payments, activities, stages, exclusivityWarning] = await Promise.all([
      listDeliverables(db, context.workspace.workspaceId, { dealId: id }),
      listPaymentExpectations(db, context.workspace.workspaceId, { dealId: id }),
      listActivities(db, context.workspace.workspaceId, id),
      listStages(db, context.workspace.workspaceId),
      findExclusivityClash(db, context.workspace.workspaceId, {
        brandId: found.brandId,
        category: found.exclusivityCategory,
        dealId: id,
        todayISO,
      }),
    ]);
    return { found, deliverables, payments, activities, stages, exclusivityWarning, todayISO };
  });
  if (!deal) notFound();
  const compensation = deal.found.compensationType === "barter"
    ? t("compensationBarter")
    : deal.found.compensationType === "mixed"
      ? t("compensationMixed")
      : deal.found.compensationType === "affiliate"
        ? t("compensationAffiliate")
        : t("compensationPaid");
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">
          <Link href={`/marcas/${deal.found.brandId}`} className="underline">{deal.found.brandName}</Link>
          {" · "}{compensation}
        </p>
        <h1 className="font-display text-4xl">{deal.found.title}</h1>
        {deal.found.amountMinor !== null && deal.found.currency ? (
          <p className="mt-2">{formatMoney(deal.found.amountMinor, deal.found.currency, context.user.locale)}</p>
        ) : null}
        {deal.found.barterValueMinor !== null && deal.found.barterCurrency ? (
          <p className="text-sm text-muted">{t("barterValue")} {formatMoney(deal.found.barterValueMinor, deal.found.barterCurrency, context.user.locale)}</p>
        ) : null}
        {deal.found.lostReason ? <p className="mt-2 text-sm">{t("lostReason")}: {deal.found.lostReason}</p> : null}
        {deal.found.notes ? <p className="mt-3 max-w-2xl text-sm text-muted">{deal.found.notes}</p> : null}
        {deal.exclusivityWarning ? (
          <p className="mt-3 rounded-xl bg-sand px-3 py-2 text-sm">
            {t("exclusivityWarning", {
              brand: deal.exclusivityWarning.brandName,
              category: deal.exclusivityWarning.category,
              until: formatCalendarDate(deal.exclusivityWarning.until, context.user.locale),
            })}
          </p>
        ) : null}
      </div>
      {canEdit ? (
        <StageSelect
          dealId={id}
          stageId={deal.found.stageId}
          stages={deal.stages.map((stage) => ({ id: stage.id, name: stage.name, kind: stage.kind }))}
        />
      ) : (
        <p className="text-sm text-muted">{deal.found.stageName}</p>
      )}
      <section>
        <h2 className="font-display text-2xl">{nav("deliverables")}</h2>
        {deal.deliverables.length === 0 ? <p className="mt-2 text-sm text-muted">{t("noDeliverables")}</p> : (
          <ul className="mt-3 space-y-2">
            {deal.deliverables.map((item) => (
              <li key={item.id} className="rounded-xl border border-line bg-card px-3 py-3 text-sm">
                <p>
                  {item.quantity} {labels(item.quantity > 1 && item.format === "story" ? "stories" : item.format)} · {item.platform === "tiktok" ? t("platformTiktok") : item.platform === "other" ? t("platformOther") : t("platformInstagram")}
                </p>
                <p className="text-muted">
                  {t("publishDue")}: {formatDateTime(item.publishDueAt, context.user.locale, context.user.timezone)}
                  {item.draftDueAt ? ` · ${t("draftDue")}: ${formatDateTime(item.draftDueAt, context.user.locale, context.user.timezone)}` : ""}
                </p>
                {item.postUrl ? <a className="break-all text-clay" href={item.postUrl}>{item.postUrl}</a> : null}
                {canEdit ? <div className="mt-2 max-w-xs"><DeliverableQuickEdit dealId={id} deliverableId={item.id} status={item.status} /></div> : <p>{labels(item.status)}</p>}
              </li>
            ))}
          </ul>
        )}
        {canEdit ? <DeliverableForm dealId={id} /> : null}
      </section>
      <section>
        <h2 className="font-display text-2xl">{nav("payments")}</h2>
        {canEdit ? (
          <div className="mt-3">
            <PaymentPanel
              dealId={id}
              currencies={[...CURRENCIES]}
              defaultCurrency={deal.found.currency ?? context.workspace.currency}
              payments={deal.payments.map((payment) => {
                const outstanding = outstandingMinor(payment.amountMinor, payment.receivedMinor);
                const display = displayPaymentStatus(payment.status, payment.dueDate, deal.todayISO);
                const amountForText = outstanding > 0n ? outstanding : payment.amountMinor;
                return {
                  id: payment.id,
                  amountLabel: formatMoney(payment.amountMinor, payment.currency, context.user.locale),
                  outstandingLabel: outstanding > 0n && outstanding !== payment.amountMinor ? formatMoney(outstanding, payment.currency, context.user.locale) : "",
                  receivedLabel: payment.receivedMinor > 0n ? formatMoney(payment.receivedMinor, payment.currency, context.user.locale) : "",
                  currency: payment.currency,
                  dueDate: formatCalendarDate(payment.dueDate, context.user.locale),
                  displayStatus: display,
                  note: payment.note,
                  phone: payment.contactWhatsapp,
                  email: payment.contactEmail,
                  followUpText: t("followUpText", {
                    who: payment.contactName || payment.brandName,
                    title: payment.dealTitle,
                    amount: formatMoney(amountForText, payment.currency, context.user.locale),
                    due: formatCalendarDate(payment.dueDate, context.user.locale),
                    creator: context.user.name ?? "",
                  }),
                  followUpSubject: t("followUpSubject", { brand: payment.brandName }),
                };
              })}
            />
          </div>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {deal.payments.map((payment) => (
              <li key={payment.id} className="rounded-xl border border-line bg-card px-3 py-2">
                {formatMoney(payment.amountMinor, payment.currency, context.user.locale)} · {labels(displayPaymentStatus(payment.status, payment.dueDate, deal.todayISO))} · {formatCalendarDate(payment.dueDate, context.user.locale)}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">{t("history")}</h2>
        {canEdit ? <NoteForm dealId={id} /> : null}
        <ul className="space-y-2 text-sm">
          {deal.activities.map((activity) => (
            <li key={activity.id} className="rounded-xl border border-line bg-card px-3 py-2">
              <p>{activityText(activity.type, activity.payload, t, context.user.locale)}</p>
              <p className="text-xs text-muted">{formatDateTime(activity.createdAt, context.user.locale, context.user.timezone)}</p>
            </li>
          ))}
        </ul>
      </section>
      {canEdit ? <DeleteResource url={`/api/v1/deals/${id}`} redirectTo="/pipeline" /> : null}
    </div>
  );
}

function activityText(
  type: string,
  payload: Record<string, unknown>,
  t: (key: string, values?: Record<string, string>) => string,
  locale: string,
) {
  if (type === "stage_changed") return t("activityStage", { from: String(payload.fromStageName ?? ""), to: String(payload.toStageName ?? "") });
  if (type === "note") return String(payload.text ?? "");
  if (type === "payment_marked" || type === "payment_expected") {
    const amount = payload.amountMinor && payload.currency ? formatMoney(String(payload.amountMinor), String(payload.currency), locale) : "";
    return t(type === "payment_marked" ? "activityPayment" : "activityExpectation", { amount });
  }
  if (type === "deliverable_added") return t("activityDeliverable");
  if (type === "deliverable_updated") return t("activityUpdated");
  if (type === "deal_created") return t("activityCreated");
  if (type === "whatsapp_inbound") return t("activityWhatsapp");
  return type;
}
