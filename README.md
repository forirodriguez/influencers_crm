# influencers_crm

CRM para microinfluencers de Latam hispanohablante: acuerdos con marcas, entregas, cobros, media kit y recordatorios por WhatsApp. La interfaz, los mails y el bot están en español uruguayo (voseo).

El spec está en [`docs/spec.md`](docs/spec.md). Las decisiones están en [`docs/decisions.md`](docs/decisions.md). El mapa del repo está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Qué corre

- Next.js + TypeScript, Tailwind, Postgres, Drizzle, auth local (magic link y contraseña) y un adaptador de Supabase listo para Google.
- Workspaces multi-tenant con roles `owner`, `manager` y `viewer`, y RLS por membresía.
- CRM: marcas, pipeline, entregables, cobros por moneda y mensaje `wa.me` para reclamarle a la marca. Sin facturas.
- Media kit público en `/{slug}`, con métricas de Instagram y TikTok (mock o API real).
- Recordatorios in-app, email y WhatsApp, y un bot de comandos (`hoy`, `semana`, `nuevo`, `cobré`, `baja`).
- Exportar y borrar la cuenta.
- Copy en español uruguayo (`es-UY`) y formato de moneda. El país elige la moneda, no el tono.
- Jobs de Inngest con lógica. Sentry y PostHog no hacen nada si faltan las claves.

Las variables para el modo live están comentadas en [`.env.example`](.env.example).

## Setup local

Node 22 y Postgres 16.

```bash
cp .env.example .env
npm install
```

Con Docker:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

Sin Docker, creá la base y el usuario `postgres` con password `postgres` en `127.0.0.1:5432` (la base se llama `influencers_crm`). Las migraciones crean los roles `app_user` / `app_jobs`. Después los mismos tres comandos de migrate, seed y dev.

La app no necesita claves de Supabase, Meta, TikTok, Resend, Inngest, Sentry ni PostHog. Esos valores están vacíos en `.env.example`. `INTEGRATIONS_MODE=mock` y `AUTH_MODE=local`.

Abrí <http://localhost:3000>. Cuentas de demo, contraseña `demo1234`:

- `cami@demo.influencerscrm.test` (Buenos Aires, ARS, con opt-in de WhatsApp)
- `diego@demo.influencerscrm.test` (CDMX, MXN; también viewer de la agencia)
- `nati@demo.influencerscrm.test` (Bogotá, COP)
- `valen@demo.influencerscrm.test` (Montevideo, workspace agencia Estudio Rambla)

Media kits públicos: `/cami-gomez`, `/diego-ruiz`, `/nati-ospina`, `/luz-ferreira`, `/mateo-silva`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`test:e2e` necesita el build, la base migrada y Playwright (`npx playwright install chromium`). Levanta `next start` solo.

Los tests usan la base `influencers_crm_test` y la vacían. CI hace lo mismo con el Postgres de servicio de GitHub Actions.
