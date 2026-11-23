import type { WhatsAppAdapter, WhatsappTemplateMessage } from "./adapter";
import { MockWhatsAppAdapter } from "./mock";

const DEFAULT_GRAPH_VERSION = "v21.0";

type FetchImpl = typeof fetch;

function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function templateBody(message: WhatsappTemplateMessage): Record<string, unknown> {
  const components: Record<string, unknown>[] = [
    {
      type: "body",
      parameters: message.bodyParameters.map((text) => ({ type: "text", text })),
    },
  ];
  if (message.buttonParameters && message.buttonParameters.length > 0) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: message.buttonParameters.map((text) => ({ type: "text", text })),
    });
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: digits(message.to),
    type: "template",
    template: {
      name: message.templateName,
      language: { code: message.language },
      components,
    },
  };
}

export class CloudWhatsAppAdapter extends MockWhatsAppAdapter implements WhatsAppAdapter {
  constructor(
    private readonly config: {
      token: string;
      phoneNumberId: string;
      graphVersion?: string;
      fetchImpl?: FetchImpl;
    },
  ) {
    super();
  }

  private endpoint(): string {
    const version = this.config.graphVersion || process.env.WHATSAPP_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
    return `https://graph.facebook.com/${version}/${this.config.phoneNumberId}/messages`;
  }

  private async post(body: Record<string, unknown>): Promise<{ providerMessageId: string }> {
    const response = await (this.config.fetchImpl ?? fetch)(this.endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`WhatsApp Cloud API respondió ${response.status}: ${raw.slice(0, 300)}`);
    }
    let parsed: { messages?: { id?: string }[] } = {};
    try {
      parsed = raw ? (JSON.parse(raw) as { messages?: { id?: string }[] }) : {};
    } catch {
      parsed = {};
    }
    const id = parsed.messages?.[0]?.id;
    if (!id) throw new Error("WhatsApp Cloud API no devolvió un id de mensaje");
    return { providerMessageId: id };
  }

  override async sendTemplate(message: WhatsappTemplateMessage): Promise<{ providerMessageId: string }> {
    return this.post(templateBody(message));
  }

  override async sendText(input: { to: string; body: string }): Promise<{ providerMessageId: string }> {
    return this.post({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: digits(input.to),
      type: "text",
      text: { preview_url: false, body: input.body },
    });
  }
}
