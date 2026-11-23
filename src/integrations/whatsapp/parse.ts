export type InboundWhatsappMessage = {
  id: string;
  from: string;
  body: string;
  type: string;
};

export function parseWhatsappPayload(payload: unknown): InboundWhatsappMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const entries = (payload as { entry?: unknown }).entry;
  if (!Array.isArray(entries)) return [];
  const messages: InboundWhatsappMessage[] = [];
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown }).changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = (change as { value?: { messages?: unknown } }).value;
      if (!value || !Array.isArray(value.messages)) continue;
      for (const message of value.messages) {
        const item = message as { id?: string; from?: string; type?: string; text?: { body?: string } };
        if (!item.id || !item.from) continue;
        messages.push({
          id: item.id,
          from: item.from,
          type: item.type ?? "text",
          body: item.text?.body ?? "",
        });
      }
    }
  }
  return messages;
}
