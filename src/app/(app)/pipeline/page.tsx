import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { withUser } from "../../../db/client";
import { zonedDateISO } from "../../../lib/dates";
import { formatMoney } from "../../../lib/money";
import { listBrands, listDeals, listStages } from "../../../modules/crm/queries";
import { PipelineBoard } from "../../../modules/crm/ui/pipeline-board";
import { StageEditor } from "../../../modules/crm/ui/stage-editor";
import { requireAppContext } from "../../../modules/identity/context";
import { Button } from "../../../components/ui/button";
import { Input, Select } from "../../../components/ui/input";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("pipeline") };
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function monthBounds(month?: string) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return {};
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year ?? 2026, monthNumber ?? 1, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const t = await getTranslations("crm");
  const labels = (await getTranslations("labels")) as (key: string) => string;
  const context = await requireAppContext();
  const canEdit = context.workspace.role !== "viewer";
  const stage = one(query.stage) || undefined;
  const brand = one(query.brand) || undefined;
  const month = one(query.month) || undefined;
  const paymentStatus = one(query.paymentStatus) || undefined;
  const range = monthBounds(month);
  const data = await withUser(context.user.id, async (db) => ({
    stages: await listStages(db, context.workspace.workspaceId),
    brands: await listBrands(db, context.workspace.workspaceId),
    deals: await listDeals(db, context.workspace.workspaceId, {
      todayISO: zonedDateISO(new Date(), context.user.timezone),
      stageId: stage,
      brandId: brand,
      from: range.from,
      to: range.to,
      paymentStatus,
    }),
  }));
  const compensation = (value: string) => {
    if (value === "barter") return t("compensationBarter");
    if (value === "mixed") return t("compensationMixed");
    if (value === "affiliate") return t("compensationAffiliate");
    return t("compensationPaid");
  };
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl">{t("deals")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("pipelineIntro")}</p>
        </div>
        {canEdit ? (
          <Link href="/acuerdos/nuevo" className="inline-flex min-h-11 items-center rounded-full bg-clay px-4 py-2 text-sm font-medium text-white">
            {t("newDeal")}
          </Link>
        ) : null}
      </div>
      {!canEdit ? <p className="mt-3 text-sm text-muted">{t("readOnly")}</p> : null}
      <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" method="get">
        <Select name="stage" defaultValue={stage ?? ""} aria-label={t("stage")}>
          <option value="">{t("stage")}</option>
          {data.stages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select name="brand" defaultValue={brand ?? ""} aria-label={t("brand")}>
          <option value="">{t("brand")}</option>
          {data.brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Input name="month" type="month" defaultValue={month ?? ""} aria-label={t("month")} />
        <Select name="paymentStatus" defaultValue={paymentStatus ?? ""} aria-label={t("paymentStatus")}>
          <option value="">{t("paymentStatus")}</option>
          <option value="pending">{labels("pending")}</option>
          <option value="overdue">{labels("overdue")}</option>
          <option value="partial">{labels("partial")}</option>
          <option value="paid">{labels("paid")}</option>
          <option value="written_off">{labels("written_off")}</option>
          <option value="none">{t("nonePayment")}</option>
        </Select>
        <Button type="submit">{t("filter")}</Button>
      </form>
      {(stage || brand || month || paymentStatus) ? (
        <Link href="/pipeline" className="mt-2 inline-block text-sm text-clay">{t("clearFilters")}</Link>
      ) : null}
      <PipelineBoard
        canEdit={canEdit}
        stages={data.stages.map((item) => ({ id: item.id, name: item.name, kind: item.kind }))}
        deals={data.deals.map((deal) => ({
          id: deal.id,
          title: deal.title,
          brandName: deal.brandName,
          stageId: deal.stageId,
          amountLabel: deal.amountMinor !== null && deal.currency ? formatMoney(deal.amountMinor, deal.currency, context.user.locale) : null,
          compensationLabel: compensation(deal.compensationType),
          paymentLabel: deal.paymentStatus ? labels(deal.paymentStatus) : null,
        }))}
      />
      {canEdit ? <StageEditor stages={data.stages.map((item) => ({ id: item.id, name: item.name, kind: item.kind }))} /> : null}
    </div>
  );
}
