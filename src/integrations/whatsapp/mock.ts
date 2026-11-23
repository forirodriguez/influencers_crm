import type { WhatsAppAdapter, WhatsappTemplateMessage } from "./adapter";
import { parseWhatsappPayload } from "./parse";
import { verifyWhatsappSignature } from "./signature";

export class MockWhatsAppAdapter implements WhatsAppAdapter {
  verifySubscription(query: URLSearchParams): string | null {
    const mode = query.get("hub.mode");
    const token = query.get("hub.verify_token");
    const challenge = query.get("hub.challenge");
    const expected = process.env.WHATSAPP_VERIFY_TOKEN || "dev-verify-token";
    if (mode === "subscribe" && token === expected && challenge) return challenge;
    return null;
  }

  verifySignature(rawBody: string, header: string | null): boolean {
    if (process.env.INTEGRATIONS_MODE !== "live" && header === "sha256=mock") return true;
    const secret = process.env.WHATSAPP_APP_SECRET;
    if (!secret) return false;
    return verifyWhatsappSignature(secret, rawBody, header);
  }

  parseInbound(payload: unknown) {
    return parseWhatsappPayload(payload);
  }

  async sendTemplate(message: WhatsappTemplateMessage): Promise<{ providerMessageId: string }> {
    return { providerMessageId: `mock-wa-${message.templateName}-${message.to}` };
  }

  async sendText(input: { to: string; body: string }): Promise<{ providerMessageId: string }> {
    const to = input.to.replace(/\D/g, "");
    return { providerMessageId: `mock-wa-text-${to}-${Date.now()}-${Math.random().toString(16).slice(2)}` };
  }
}

