export async function sendJson(url: string, method: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    data?: Record<string, unknown>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message ?? "No se pudo guardar");
  return payload.data ?? {};
}

export function textValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
