export const FOLLOW_UP_TEMPLATE =
  "Hola {who}, te escribo por «{title}». Quedó pendiente el pago de {amount}, con fecha {due}. ¿Me confirmás cuando lo pueden transferir? Gracias, {creator}.";

export const FOLLOW_UP_SUBJECT = "Pago pendiente · {brand}";

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

export function whatsappHref(phoneE164: string | null | undefined, text: string): string | null {
  if (!phoneE164) return null;
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function mailtoHref(email: string | null | undefined, subject: string, body: string): string | null {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function buildFollowUp(input: {
  who: string;
  title: string;
  amount: string;
  due: string;
  creator: string;
  brand: string;
  template?: string;
  subjectTemplate?: string;
  phoneE164?: string | null;
  email?: string | null;
  channel: "whatsapp" | "email";
}): { text: string; subject: string; href: string | null; channel: "whatsapp" | "email" } {
  const values = {
    who: input.who,
    title: input.title,
    amount: input.amount,
    due: input.due,
    creator: input.creator,
    brand: input.brand,
  };
  const text = fillTemplate(input.template ?? FOLLOW_UP_TEMPLATE, values);
  const subject = fillTemplate(input.subjectTemplate ?? FOLLOW_UP_SUBJECT, values);
  const href = input.channel === "email" ? mailtoHref(input.email, subject, text) : whatsappHref(input.phoneE164, text);
  return { text, subject, href, channel: input.channel };
}
