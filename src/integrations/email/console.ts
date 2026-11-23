import type { EmailAdapter, EmailMessage } from "./adapter";

let lastEmail: EmailMessage | null = null;

export function getLastEmail(): EmailMessage | null {
  return lastEmail;
}

export class ConsoleEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<{ id: string }> {
    lastEmail = message;
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email:mock] to=${message.to} subject=${message.subject}`);
    }
    return { id: `mock-email-${Date.now()}` };
  }
}
