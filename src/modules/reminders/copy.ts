import { loadMessages } from "../../i18n/load";

function lookup(source: unknown, path: string): unknown {
  let current = source;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function formatCopy(locale: string, path: string, vars: Record<string, string | number> = {}): string {
  const value = lookup(loadMessages(locale), path);
  const template = typeof value === "string" ? value : path;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return map[char] ?? char;
  });
}
