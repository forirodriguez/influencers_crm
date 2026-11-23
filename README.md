# influencers_crm

CRM para microinfluencers de Latam hispanohablante: acuerdos con marcas, entregas, cobros y un media kit. Esta rama es la **fase 1**, la fundación. El producto en la UI sigue en español (voseo rioplatense por defecto).

El spec está en [`docs/spec.md`](docs/spec.md). Las decisiones de las preguntas abiertas están en [`docs/decisions.md`](docs/decisions.md). Cómo está partido el repo para trabajar en paralelo está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Qué ya corre

- Next.js + TypeScript, Tailwind, Postgres, Drizzle, auth local (magic link y contraseña) y un adaptador de Supabase listo para Google.
- Workspaces multi-tenant con roles `owner`, `manager` y `viewer`, y RLS por membresía.
- El modelo de datos completo del spec, con migraciones, y un seed en español (ARS, MXN, COP, UYU, USD).
- Shell mobile-first con pantallas de cada módulo. Varias ya leen datos de verdad.
- i18n (`es-AR` / `es-UY` voseo, `es-MX` / `es-CO` overlay neutro) y formato de moneda.
- Adaptadores de Instagram, TikTok, WhatsApp y email, en modo mock.
- Jobs de Inngest registrados (todavía sin lógica) y stubs de Sentry y PostHog.
- Lint, typecheck, tests y CI.

## Qué toma cada módulo

| Módulo | Listo para seguir en |
|---|---|
| CRM (marcas, acuerdos, entregables, cobros) | `src/modules/crm` |
| Media kit y métricas | `src/modules/media-kit` |
| Recordatorios y bot de WhatsApp | `src/modules/reminders` |
| Cuenta, invitaciones, exportar/borrar | `src/modules/identity` |

Los GET de marcas, acuerdos, entregables, resumen de cobros, perfiles, reglas y notificaciones ya responden. Los POST de escritura del CRM responden `501` a propósito.

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
```

Los tests usan la base `influencers_crm_test` y la vacían. CI hace lo mismo con el Postgres de servicio de GitHub Actions.
