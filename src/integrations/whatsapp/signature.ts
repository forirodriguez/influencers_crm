import { createHmac, timingSafeEqual } from "node:crypto";

export function signWhatsappBody(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

export function verifyWhatsappSignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const expected = signWhatsappBody(secret, rawBody);
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
