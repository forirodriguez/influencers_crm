"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";

type Copy = {
  exportTitle: string;
  exportHelp: string;
  exportJson: string;
  exportCsv: string;
  deleteTitle: string;
  deleteHelp: string;
  deleteConfirm: string;
  deleteButton: string;
};

function download(filename: string, contents: Blob) {
  const url = URL.createObjectURL(contents);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function PrivacyPanel({ copy }: { copy: Copy }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function exportData(format: "json" | "csv") {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/me/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "No se pudo exportar");
      }
      if (format === "csv") {
        download("cobros.csv", new Blob([await response.text()], { type: "text/csv" }));
        return;
      }
      const payload = (await response.json()) as { data: { export: unknown } };
      download("datos.json", new Blob([JSON.stringify(payload.data.export, null, 2)], { type: "application/json" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo exportar");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-2xl">{copy.exportTitle}</h2>
      <p className="mt-2 text-sm text-muted">{copy.exportHelp}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => exportData("json")}>
          {copy.exportJson}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => exportData("csv")}>
          {copy.exportCsv}
        </Button>
      </div>
      <h2 className="mt-6 font-display text-2xl">{copy.deleteTitle}</h2>
      <p className="mt-2 text-sm text-muted">{copy.deleteHelp}</p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          try {
            const response = await fetch("/api/v1/me", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ confirm }),
            });
            if (!response.ok) {
              const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
              throw new Error(payload.error?.message ?? "No se pudo borrar");
            }
            router.push("/login");
            router.refresh();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "No se pudo borrar");
            setPending(false);
          }
        }}
      >
        <label className="text-sm">
          {copy.deleteConfirm}
          <input
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="mt-1 block rounded-xl border border-line bg-paper px-3 py-2"
            autoComplete="off"
          />
        </label>
        <Button type="submit" variant="secondary" disabled={pending || confirm !== "BORRAR"}>
          {copy.deleteButton}
        </Button>
      </form>
      {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
    </section>
  );
}
