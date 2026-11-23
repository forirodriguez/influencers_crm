import { z } from "zod";
import { isCurrency } from "../../lib/constants";
import { ApiError } from "../../lib/errors";

function emptyToNull(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}

const optionalText = (max: number) => z.preprocess(emptyToNull, z.string().min(1).max(max).nullable().optional());

const optionalDate = z.preprocess(
  emptyToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha tiene que ser AAAA-MM-DD").nullable().optional(),
);

const optionalWhen = z.preprocess(emptyToNull, z.string().min(4).max(40).nullable().optional());

const optionalInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().int().min(1).max(99).optional());

export const compensationSchema = z.enum(["paid", "barter", "mixed", "affiliate"]);
export const sourceSchema = z.enum(["ig_dm", "tiktok_dm", "email", "whatsapp", "referral", "other"]);
export const platformSchema = z.enum(["instagram", "tiktok", "other"]);
export const formatSchema = z.enum(["reel", "story", "post", "video", "ugc"]);
export const deliverableStatusSchema = z.enum(["pending", "in_review", "approved", "published", "cancelled"]);
export const paymentMethodSchema = z.enum(["bank_transfer", "mercado_pago", "cash", "paypal", "other"]);
export const stageKindSchema = z.enum(["open", "won", "done", "lost"]);

const currencySchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .refine((value) => isCurrency(value), "Esa moneda no está habilitada")
    .nullable()
    .optional(),
);

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la marca es obligatorio").max(120),
  website: optionalText(300),
  instagram: optionalText(80),
  tiktok: optionalText(80),
  industry: optionalText(80),
  country: optionalText(80),
  notes: optionalText(4000),
});

export const updateBrandSchema = createBrandSchema.partial();

export const contactSchema = z.object({
  name: z.string().trim().min(1, "El nombre del contacto es obligatorio").max(120),
  role: optionalText(80),
  email: optionalText(180),
  whatsapp: optionalText(40),
  instagram: optionalText(80),
  notes: optionalText(2000),
});

export const updateContactSchema = contactSchema.partial();

export const createStageSchema = z.object({
  name: z.string().trim().min(1, "La etapa necesita un nombre").max(40),
  kind: stageKindSchema.default("open"),
});

export const reorderStagesSchema = z.object({
  stages: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(40),
        kind: stageKindSchema,
      }),
    )
    .min(1),
});

export const createDealSchema = z.object({
  title: z.string().trim().min(1, "El acuerdo necesita un título").max(160),
  brandId: z.string().uuid().optional(),
  brandName: z.string().trim().min(1).max(120).optional(),
  creatorProfileId: z.string().uuid().optional(),
  primaryContactId: z.string().uuid().nullable().optional(),
  stageId: z.string().uuid().optional(),
  compensationType: compensationSchema.optional(),
  amount: optionalText(32),
  currency: currencySchema,
  barterValue: optionalText(32),
  barterCurrency: currencySchema,
  source: sourceSchema.nullable().optional(),
  expectedCloseDate: optionalDate,
  notes: optionalText(4000),
  exclusivityCategory: optionalText(80),
  exclusivityUntil: optionalDate,
  lostReason: optionalText(500),
  deliverablePlatform: platformSchema.optional(),
  deliverableFormat: formatSchema.optional(),
  deliverableQuantity: optionalInt,
  draftDueAt: optionalWhen,
  approvalDueAt: optionalWhen,
  publishDueAt: optionalWhen,
  paymentDueDate: optionalDate,
});

export const updateDealSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  brandId: z.string().uuid().optional(),
  primaryContactId: z.string().uuid().nullable().optional(),
  creatorProfileId: z.string().uuid().optional(),
  compensationType: compensationSchema.optional(),
  amount: optionalText(32),
  currency: currencySchema,
  barterValue: optionalText(32),
  barterCurrency: currencySchema,
  source: sourceSchema.nullable().optional(),
  expectedCloseDate: optionalDate,
  notes: optionalText(4000),
  exclusivityCategory: optionalText(80),
  exclusivityUntil: optionalDate,
  lostReason: optionalText(500),
});

export const moveDealSchema = z.object({
  stageId: z.string().uuid(),
  lostReason: z.string().trim().min(1).max(500).optional(),
});

export const deliverableSchema = z.object({
  dealId: z.string().uuid().optional(),
  platform: platformSchema,
  format: formatSchema,
  quantity: optionalInt,
  draftDueAt: optionalWhen,
  approvalDueAt: optionalWhen,
  publishDueAt: optionalWhen,
  status: deliverableStatusSchema.optional(),
  postUrl: optionalText(500),
});

export const updateDeliverableSchema = deliverableSchema.partial();

export const paymentSchema = z.object({
  amount: z.string().trim().min(1, "La cuota necesita un monto"),
  currency: z.string().refine((value) => isCurrency(value), "Esa moneda no está habilitada"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha tiene que ser AAAA-MM-DD"),
  note: optionalText(1000),
});

export const updatePaymentSchema = z.object({
  amount: z.string().trim().min(1).optional(),
  currency: z.string().refine((value) => isCurrency(value), "Esa moneda no está habilitada").optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: optionalText(1000),
  status: z.enum(["written_off", "pending"]).optional(),
});

export const receiptSchema = z.object({
  amount: z.string().trim().min(1, "El monto recibido es obligatorio"),
  currency: z.string().refine((value) => isCurrency(value), "Esa moneda no está habilitada"),
  receivedAt: optionalWhen,
  method: paymentMethodSchema,
  note: optionalText(1000),
});

export const noteSchema = z.object({
  text: z.string().trim().min(1, "La nota está vacía").max(2000),
});

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError("invalid_body", result.error.issues[0]?.message ?? "Revisá los datos", 400);
  }
  return result.data;
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("invalid_json", "El cuerpo no es JSON", 400);
  }
}
