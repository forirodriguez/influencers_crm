"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { sendJson } from "./client";
import { Button, ErrorNote, Input, Select } from "./fields";

type Stage = { id: string; name: string; kind: string };

const kinds = ["open", "won", "done", "lost"] as const;

export function StageEditor({ stages }: { stages: Stage[] }) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [rows, setRows] = useState(stages);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof kinds)[number]>("open");

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= rows.length) return;
    const copy = [...rows];
    const current = copy[index];
    const target = copy[next];
    if (!current || !target) return;
    copy[index] = target;
    copy[next] = current;
    setRows(copy);
  }

  return (
    <details className="mt-8 rounded-2xl border border-line bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium">{t("stages")}</summary>
      <div className="mt-4 space-y-3">
        <ErrorNote message={error} />
        {rows.map((stage, index) => (
          <div key={stage.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_auto]">
            <Input
              aria-label={t("stageName")}
              value={stage.name}
              onChange={(event) => setRows(rows.map((item) => item.id === stage.id ? { ...item, name: event.target.value } : item))}
            />
            <Select
              aria-label={t("stage")}
              value={stage.kind}
              onChange={(event) => setRows(rows.map((item) => item.id === stage.id ? { ...item, kind: event.target.value } : item))}
            >
              {kinds.map((item) => <option key={item} value={item}>{kindLabel(item, t)}</option>)}
            </Select>
            <div className="col-span-2 flex gap-2 sm:col-span-1">
              <Button type="button" variant="secondary" onClick={() => move(index, -1)}>{t("moveUp")}</Button>
              <Button type="button" variant="secondary" onClick={() => move(index, 1)}>{t("moveDown")}</Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          onClick={async () => {
            setError(null);
            try {
              await sendJson("/api/v1/deals/stages", "PATCH", {
                stages: rows.map((stage) => ({ id: stage.id, name: stage.name, kind: stage.kind })),
              });
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : t("save"));
            }
          }}
        >
          {t("saveStages")}
        </Button>
        <form
          className="grid gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_9rem_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            try {
              await sendJson("/api/v1/deals/stages", "POST", { name, kind });
              setName("");
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : t("save"));
            }
          }}
        >
          <Input aria-label={t("addStage")} value={name} onChange={(event) => setName(event.target.value)} required />
          <Select aria-label={t("stage")} value={kind} onChange={(event) => setKind(event.target.value as (typeof kinds)[number])}>
            {kinds.map((item) => <option key={item} value={item}>{kindLabel(item, t)}</option>)}
          </Select>
          <Button type="submit">{t("addStage")}</Button>
        </form>
      </div>
    </details>
  );
}

function kindLabel(kind: string, t: (key: string) => string) {
  if (kind === "won") return t("kindWon");
  if (kind === "done") return t("kindDone");
  if (kind === "lost") return t("kindLost");
  return t("kindOpen");
}
