import { ConsoleEmailAdapter } from "./email/console";
import { ResendEmailAdapter } from "./email/resend";
import type { EmailAdapter } from "./email/adapter";
import { LiveInstagramAdapter, MockInstagramAdapter } from "./instagram/mock";
import type { InstagramAdapter } from "./instagram/adapter";
import { LiveTikTokAdapter, MockTikTokAdapter } from "./tiktok/mock";
import type { TikTokAdapter } from "./tiktok/adapter";
import { CloudWhatsAppAdapter } from "./whatsapp/cloud";
import { MockWhatsAppAdapter } from "./whatsapp/mock";
import type { WhatsAppAdapter } from "./whatsapp/adapter";
import { IntegrationNotConfigured } from "../lib/errors";

function live(): boolean {
  return process.env.INTEGRATIONS_MODE === "live";
}

export function getEmailAdapter(): EmailAdapter {
  if (!live()) return new ConsoleEmailAdapter();
  if (!process.env.RESEND_API_KEY) throw new IntegrationNotConfigured("email");
  return new ResendEmailAdapter();
}

export function getWhatsAppAdapter(): WhatsAppAdapter {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (live() && token && phoneNumberId) {
    return new CloudWhatsAppAdapter({ token, phoneNumberId });
  }
  return new MockWhatsAppAdapter();
}

export function getInstagramAdapter(): InstagramAdapter {
  return live() ? new LiveInstagramAdapter() : new MockInstagramAdapter();
}

export function getTikTokAdapter(): TikTokAdapter {
  return live() ? new LiveTikTokAdapter() : new MockTikTokAdapter();
}
