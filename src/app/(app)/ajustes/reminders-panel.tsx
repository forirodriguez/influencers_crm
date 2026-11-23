"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";

type Rule = { id: string; label: string; enabled: boolean };
type Note = { id: string; title: string; meta: string };

type Copy = {
  phone: string;
  phoneHelp: string;
  consent: string;
  sendCode: string;
  code: string;
  confirmCode: string;
  revoke: string;
  activePhone: string;
  whatsappOn: string;
  whatsappOff: string;
  quiet: string;
  preferences: string;
  emailToggle: string;
  digestToggle: string;
  rules: string;
  rulesHelp: string;
  saved: string;
  notifications: string;
  emptyNotes: string;
  devCode: string;
};

async function send(url: string, method: string, body?: unknown, workspaceId?: string) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { data?: { devCode?: string }; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "No se pudo guardar");
  return payload.data;
}

export function RemindersPanel({
  copy,
  workspaceId,
  canEdit,
  optedIn,
  phone,
  emailReminders,
  dailySummary,
  rules,
  notes,
}: {
  copy: Copy;
  workspaceId: string;
  canEdit: boolean;
  optedIn: boolean;
  phone: string | null;
  emailReminders: boolean;
  dailySummary: boolean;
  rules: Rule[];
  notes: Note[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setMessageError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [number, setNumber] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setMessage(null);
    setMessageError(null);
    try {
      await action();
      router.refresh();
    } catch (caught) {
      setMessageError(caught instanceof Error ? caught.message : "No se pudo guardar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">{copy.phone}</h2>
        <p className="mt-2 text-sm">{optedIn ? copy.whatsappOn : copy.whatsappOff}</p>
        <p className="mt-1 text-sm text-muted">{copy.quiet}</p>
        {optedIn ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">{copy.activePhone.replace("{phone}", phone ?? "")}</p>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => run(async () => {
              await send("/api/v1/me/whatsapp-consent", "DELETE");
              setMessage(copy.saved);
            })}>
              {copy.revoke}
            </Button>
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                if (devCode) {
                  await send("/api/v1/me/phone/verify-confirm", "POST", { code });
                  setDevCode(null);
                  setMessage(copy.saved);
                  return;
                }
                const data = await send("/api/v1/me/phone/verify-start", "POST", { phone: number, acceptConsent: accepted });
                setDevCode(data?.devCode ?? null);
              });
            }}
          >
            <p className="text-sm text-muted">{copy.phoneHelp}</p>
            <label className="block text-sm">
              {copy.phone}
              <input
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="+54 9 11 1234-5678"
                className="mt-1 block w-full rounded-xl border border-line bg-paper px-3 py-2"
                required
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" required />
              <span>{copy.consent}</span>
            </label>
            {devCode ? (
              <label className="block text-sm">
                {copy.code}
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="mt-1 block w-full rounded-xl border border-line bg-paper px-3 py-2"
                  required
                />
              </label>
            ) : null}
            {devCode ? <p className="text-sm text-muted">{copy.devCode.replace("{code}", devCode)}</p> : null}
            <Button type="submit" disabled={pending}>
              {devCode ? copy.confirmCode : copy.sendCode}
            </Button>
          </form>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-2xl">{copy.preferences}</h2>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailReminders}
              onChange={(event) => run(async () => {
                await send("/api/v1/me", "PATCH", { emailReminders: event.target.checked });
                setMessage(copy.saved);
              })}
            />
            {copy.emailToggle}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dailySummary}
              onChange={(event) => run(async () => {
                await send("/api/v1/me", "PATCH", { dailySummary: event.target.checked });
                setMessage(copy.saved);
              })}
            />
            {copy.digestToggle}
          </label>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl">{copy.rules}</h2>
        <p className="mt-2 text-sm text-muted">{copy.rulesHelp}</p>
        <ul className="mt-3 space-y-2 text-sm">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 rounded-xl bg-sand px-3 py-2">
              <span>{rule.label}</span>
              {canEdit ? (
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  aria-label={rule.label}
                  onChange={(event) => run(async () => {
                    await send("/api/v1/reminder-rules", "PATCH", { rules: [{ id: rule.id, enabled: event.target.checked }] }, workspaceId);
                    setMessage(copy.saved);
                  })}
                />
              ) : (
                <span className="text-muted">{rule.enabled ? "●" : "○"}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl">{copy.notifications}</h2>
        {notes.length === 0 ? <p className="mt-2 text-sm text-muted">{copy.emptyNotes}</p> : null}
        <ul className="mt-3 space-y-2 text-sm">
          {notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-line bg-card px-3 py-2">
              <p>{note.title}</p>
              <p className="text-muted">{note.meta}</p>
            </li>
          ))}
        </ul>
      </section>
      {message ? <p className="text-sm text-moss">{message}</p> : null}
      {error ? <p className="text-sm text-clay">{error}</p> : null}
    </div>
  );
}
