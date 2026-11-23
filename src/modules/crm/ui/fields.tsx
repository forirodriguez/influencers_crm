"use client";

import { Button } from "../../../components/ui/button";
import { Input, Label, Select } from "../../../components/ui/input";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextArea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-24 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none ${className ?? ""}`}
      {...props}
    />
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-xl bg-sand px-3 py-2 text-sm text-clay">{message}</p>;
}

export { Button, Input, Select };
