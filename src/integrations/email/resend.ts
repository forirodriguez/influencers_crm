import { IntegrationNotConfigured } from "../../lib/errors";
import type { EmailAdapter, EmailMessage } from "./adapter";

export class ResendEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<{ id: string }> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new IntegrationNotConfigured("email", "RESEND_API_KEY y EMAIL_FROM son obligatorios en modo live");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend respondió ${response.status}`);
    }
    const body = (await response.json()) as { id?: string };
    return { id: body.id ?? "resend" };
  }
}
