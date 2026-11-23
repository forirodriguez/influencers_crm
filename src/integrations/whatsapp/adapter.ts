import type { InboundWhatsappMessage } from "./parse";

export type WhatsappTemplateMessage = {
  to: string;
  templateName: string;
  language: string;
  bodyParameters: string[];
};

export interface WhatsAppAdapter {
  verifySubscription(query: URLSearchParams): string | null;
  verifySignature(rawBody: string, header: string | null): boolean;
  parseInbound(payload: unknown): InboundWhatsappMessage[];
  sendTemplate(message: WhatsappTemplateMessage): Promise<{ providerMessageId: string }>;
  sendText(input: { to: string; body: string }): Promise<{ providerMessageId: string }>;
}
