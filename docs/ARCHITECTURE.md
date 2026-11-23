# Arquitectura

`influencers_crm` es una app Next.js (App Router) con Postgres, Drizzle y acceso por workspace. La lógica de producto vive en `src/modules`. Las rutas de `src/app` son finas.

El spec (`docs/spec.md`) proponía `/app`, `/server`, `/db`, `/jobs`, `/lib`. El mapeo es:

| Spec | Acá |
|---|---|
| `/app` | `src/app` |
| `/server` | `src/modules/<modulo>` + `src/server` (HTTP compartido) |
| `/db` | `src/db` y el schema de cada módulo |
| `/jobs` | `src/jobs` |
| `/lib` | `src/lib` |
| integraciones | `src/integrations` |

## Módulos

| Módulo | Carpeta | Qué posee |
|---|---|---|
| Identity | `src/modules/identity` | Auth, usuarios, workspaces, roles, invitaciones |
| CRM | `src/modules/crm` | Marcas, acuerdos, entregables, cobros |
| Media kit | `src/modules/media-kit` | Perfiles, servicios, redes, página pública |
| Recordatorios | `src/modules/reminders` | Reglas, notificaciones, WhatsApp, comandos del bot |

Cada carpeta tiene un `MODULE.md` con las rutas que ese trabajo puede tocar.

## Para no pisarse

- No edites la carpeta de otro módulo.
- No edites `drizzle/0000_init.sql` ni `drizzle/0001_rls.sql`. Un cambio de schema es una migración nueva (`npm run db:generate` o un SQL custom).
- `src/db/client.ts`, `src/server/http.ts`, `src/lib/**` y `src/components/ui/**` son compartidos. Agregá, no reescribas.
- La navegación está en `src/components/shell/nav.ts`. Sumar una pantalla es una línea.
- Los textos van en JSON. El catálogo activo es `src/i18n/messages/es-UY/`. `load.ts` lo arma con `deepMerge` y no aplica otro overlay. Un locale nuevo es una carpeta y una línea en `load.ts`.
- Los jobs se agregan en `src/jobs/functions` y se reexportan en `index.ts`.
- CRM, media kit y recordatorios no pueden importar `@/db/admin`. ESLint lo rechaza. Usá `withUser(userId, db => …)` o `getJobsDb()`.
- Aunque RLS filtra por membresía, filtrá siempre `workspace_id`. Una persona puede estar en más de un espacio (Diego, en el seed, es viewer de la agencia).

## Datos y roles de Postgres

- `DATABASE_URL`: superusuario. Migraciones, seed y el arranque de una cuenta (todavía no hay membresía al insertar el primer workspace).
- `DATABASE_URL_APP`: rol `app_user`. Sujeto a RLS. Cada transacción de usuario setea `app.user_id`.
- `DATABASE_URL_JOBS`: rol `app_jobs`. Lee y escribe entre workspaces para los crons. Las políticas lo permiten por `current_user`.

Las contraseñas locales de esos roles (`app_user_local`, `app_jobs_local`) son de desarrollo. En un Postgres alojado hay que crear los roles con secretos propios antes de migrar. Quien tenga la URL de `app_user` puede setear `app.user_id`: RLS protege contra un query que se olvida el filtro, no contra una URL filtrada.

Tablas sin `workspace_id`, a propósito: `users`, `legal_acceptances`, `social_accounts`, `metric_snapshots`, `posts`, `services`, `whatsapp_consents`, `whatsapp_messages`, más `auth_credentials` y `magic_links`. El acceso sale del perfil, de la cuenta o del propio usuario.

## HTTP

- JSON `{ data }` o `{ error: { code, message } }`.
- Sesión por cookie. En la API, `X-Workspace-Id` o la cookie `icrm_workspace`.
- Las escrituras de CRM, media kit y recordatorios pasan por `withUser`. El bot de WhatsApp crea acuerdos y marca cobros con las mismas funciones del CRM.

## Integraciones

`getEmailAdapter`, `getWhatsAppAdapter`, `getInstagramAdapter`, `getTikTokAdapter` en `src/integrations`. Con `INTEGRATIONS_MODE=mock` no hay red. Los tokens de redes se guardan con `encryptString` (AES-256-GCM) y no vuelven al cliente.

## i18n y plata

- Locale por cookie `icrm_locale`. La voz activa es `es-UY`.
- `formatMoney` / `majorToMinor` en `src/lib/money.ts`. COP sin decimales en la UI. Sin tipo de cambio.
