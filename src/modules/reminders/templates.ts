export const WHATSAPP_TEMPLATE_LANGUAGE = "es";

export type WhatsappTemplateDefinition = {
  name: string;
  category: "UTILITY" | "AUTHENTICATION";
  language: string;
  body: string;
  parameterCount: number;
  example: string[];
  note: string;
};

/**
 * Textos para cargar en el administrador de WhatsApp de Meta.
 * Categoría utility, salvo el código de verificación (authentication).
 * Los parámetros van en el orden del body {{1}}… y no pueden ir vacíos.
 */
export const WHATSAPP_TEMPLATES: readonly WhatsappTemplateDefinition[] = [
  {
    name: "recordatorio_entrega",
    category: "UTILITY",
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    body: "Hola {{1}}, te recordamos que \"{{2}}\" para {{3}} vence el {{4}}. El detalle está en {{5}}.",
    parameterCount: 5,
    example: ["Cami", "Reel serum", "Bruma Belleza", "25/11/2026", "https://example.com/entregables"],
    note: "Recordatorio de un entregable. Utility.",
  },
  {
    name: "cobro_por_vencer",
    category: "UTILITY",
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    body: "Hola {{1}}, hoy vence el cobro de {{2}} por {{3}}. El detalle está en {{4}}.",
    parameterCount: 4,
    example: ["Cami", "Bruma Belleza", "ARS 450.000", "https://example.com/cobros"],
    note: "El día de la fecha prometida. Utility.",
  },
  {
    name: "cobro_vencido",
    category: "UTILITY",
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    body: "Hola {{1}}, {{2}} tiene un cobro vencido de {{3}} (prometido el {{4}}). Revisalo en {{5}}.",
    parameterCount: 5,
    example: ["Cami", "Andes Outdoor", "USD 400", "01/11/2026", "https://example.com/cobros"],
    note: "Cobro vencido y repetición cada 7 días. Utility.",
  },
  {
    name: "resumen_diario",
    category: "UTILITY",
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    body: "Hola {{1}}. Resumen de hoy: {{2}} entregas para hoy y {{3}} cobros vencidos. Mirá el detalle en {{4}}.",
    parameterCount: 4,
    example: ["Cami", "2", "1", "https://example.com/hoy"],
    note: "Resumen diario a las 9:00 hora local, de martes a domingo. Utility.",
  },
  {
    name: "resumen_semanal",
    category: "UTILITY",
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    body: "Hola {{1}}. Esta semana: {{2}} entregas y {{3}} cobros vencidos. El resumen está en {{4}}.",
    parameterCount: 4,
    example: ["Cami", "4", "1", "https://example.com/hoy"],
    note: "Los lunes a las 9:00 reemplaza al resumen diario. Utility.",
  },
  {
    name: "verificacion_numero",
    category: "AUTHENTICATION",
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    body: "{{1}} es tu código de verificación. Por tu seguridad, no lo compartas.",
    parameterCount: 1,
    example: ["123456"],
    note: "Plantilla de autenticación con botón de copiar código. Al enviarla hay que incluir el componente button (sub_type url, index 0) además del body.",
  },
];

export function sanitizeTemplateParam(value: string): string {
  const cleaned = value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return cleaned.slice(0, 200) || "-";
}

export function deliverableTemplateParams(input: {
  name: string;
  title: string;
  brand: string;
  date: string;
  url: string;
}): string[] {
  return [input.name, input.title, input.brand, input.date, input.url].map(sanitizeTemplateParam);
}

export function paymentDueTemplateParams(input: { name: string; brand: string; amount: string; url: string }): string[] {
  return [input.name, input.brand, input.amount, input.url].map(sanitizeTemplateParam);
}

export function paymentOverdueTemplateParams(input: {
  name: string;
  brand: string;
  amount: string;
  date: string;
  url: string;
}): string[] {
  return [input.name, input.brand, input.amount, input.date, input.url].map(sanitizeTemplateParam);
}

export function digestTemplateParams(input: { name: string; deliverables: number; overdue: number; url: string }): string[] {
  return [input.name, String(input.deliverables), String(input.overdue), input.url].map(sanitizeTemplateParam);
}
