import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_URL_APP: z.string().min(1),
  DATABASE_URL_JOBS: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  AUTH_MODE: z.enum(["local", "supabase"]).default("local"),
  AUTH_DEV_EXPOSE_LINKS: z.enum(["true", "false"]).default("false"),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  INTEGRATIONS_MODE: z.enum(["mock", "live"]).default("mock"),
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().min(1).default("influencers_crm <noreply@localhost>"),
  SENTRY_DSN: optionalString,
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: optionalString,
  WHATSAPP_TOKEN: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_APP_SECRET: optionalString,
  WHATSAPP_VERIFY_TOKEN: optionalString,
  WHATSAPP_GRAPH_VERSION: optionalString,
  INSTAGRAM_APP_ID: optionalString,
  INSTAGRAM_APP_SECRET: optionalString,
  INSTAGRAM_REDIRECT_URI: optionalString,
  INSTAGRAM_GRAPH_VERSION: optionalString,
  TIKTOK_CLIENT_KEY: optionalString,
  TIKTOK_CLIENT_SECRET: optionalString,
  TIKTOK_REDIRECT_URI: optionalString,
  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,
});

export type Env = z.infer<typeof schema>;

export function getEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Faltan variables de entorno o son inválidas: ${details}`);
  }
  if (process.env.VERCEL_ENV === "production" && parsed.data.AUTH_DEV_EXPOSE_LINKS === "true") {
    throw new Error("AUTH_DEV_EXPOSE_LINKS no puede ser true en el deploy de producción");
  }
  return parsed.data;
}
