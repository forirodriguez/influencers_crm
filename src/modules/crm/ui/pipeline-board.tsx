"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "../../../lib/utils";
import { sendJson } from "./client";
import { Button, ErrorNote, Input } from "./fields";

export type BoardStage = { id: string; name: string; kind: string };
export type BoardDeal = {
  id: string;
  title: string;
  brandName: string;
  stageId: string;
  amountLabel: string | null;
  compensationLabel: string;
  paymentLabel: string | null;
};

export function PipelineBoard({
  stages,
  deals,
  canEdit,
}: {
  stages: BoardStage[];
  deals: BoardDeal[];
  canEdit: boolean;
}) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingLost, setPendingLost] = useState<{ dealId: string; stageId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(dealId: string, stageId: string, lostReason?: string) {
    const stage = stages.find((item) => item.id === stageId);
    if (stage?.kind === "lost" && !lostReason) {
      setPendingLost({ dealId, stageId });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendJson(`/api/v1/deals/${dealId}/move`, "POST", { stageId, lostReason });
      setPendingLost(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("save"));
    } finally {
      setBusy(false);
    }
  }

  const lostPanel = pendingLost ? (
    <form
      className="mt-4 space-y-2 rounded-2xl border border-line bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const reason = new FormData(event.currentTarget).get("reason");
        if (typeof reason === "string") void move(pendingLost.dealId, pendingLost.stageId, reason);
      }}
    >
      <p className="text-sm font-medium">{t("lostHelp")}</p>
      <Input name="reason" required aria-label={t("lostReason")} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{t("save")}</Button>
        <Button type="button" variant="secondary" onClick={() => setPendingLost(null)}>{t("clearFilters")}</Button>
      </div>
    </form>
  ) : null;

  return (
    <div>
      <ErrorNote message={error} />
      {lostPanel}
      <div className="mt-4 hidden gap-3 md:flex md:overflow-x-auto md:pb-4">
        {stages.map((stage) => {
          const cards = deals.filter((deal) => deal.stageId === stage.id);
          return (
            <section
              key={stage.id}
              className={cn("min-w-64 flex-1 rounded-2xl p-3", over === stage.id ? "bg-line" : "bg-sand")}
              onDragOver={(event) => {
                if (!canEdit) return;
                event.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver((current) => (current === stage.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                const dealId = event.dataTransfer.getData("text/plain");
                if (dealId) void move(dealId, stage.id);
              }}
            >
              <h2 className="text-sm font-medium">
                {stage.name} <span className="text-muted">{cards.length}</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {cards.length === 0 ? <li className="text-sm text-muted">{t("emptyColumn")}</li> : null}
                {cards.map((deal) => (
                  <li key={deal.id}>
                    <Link
                      href={`/acuerdos/${deal.id}`}
                      draggable={canEdit}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", deal.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className="block cursor-grab rounded-xl bg-card p-3 active:cursor-grabbing"
                    >
                      <DealBody deal={deal} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <ul className="mt-4 space-y-3 md:hidden">
        {deals.length === 0 ? <li className="text-sm text-muted">{t("noDeals")}</li> : null}
        {deals.map((deal) => (
          <li key={deal.id} className="rounded-2xl border border-line bg-card p-4">
            <Link href={`/acuerdos/${deal.id}`}>
              <DealBody deal={deal} />
            </Link>
            {canEdit ? (
              <label className="mt-3 block text-sm">
                <span className="text-muted">{t("stage")}</span>
                <select
                  className="mt-1 min-h-11 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm"
                  value={deal.stageId}
                  disabled={busy}
                  aria-label={t("stage")}
                  onChange={(event) => void move(deal.id, event.target.value)}
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DealBody({ deal }: { deal: BoardDeal }) {
  return (
    <>
      <p className="font-medium">{deal.title}</p>
      <p className="text-sm text-muted">{deal.brandName} · {deal.compensationLabel}</p>
      {deal.amountLabel ? <p className="mt-2 text-sm">{deal.amountLabel}</p> : null}
      {deal.paymentLabel ? <p className="text-xs text-clay">{deal.paymentLabel}</p> : null}
    </>
  );
}
