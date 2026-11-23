# Deploy en Vercel + Supabase

Esta guía es para subir `influencers_crm` sin ser dev. El primer deploy funciona **sin** claves de Meta, TikTok, WhatsApp ni Resend. Esas se prenden después, en la sección 8.

La voz de la app es español uruguayo. La base puede vivir en São Paulo: es la región de Supabase más cercana a Uruguay.

## Checklist: qué hacés vos y qué hace solo

**Lo hacés vos, a mano**

1. Crear el proyecto de Supabase y guardar la contraseña de la base.
2. Inventar tres secretos (`AUTH_SECRET`, `APP_USER_PASSWORD`, `APP_JOBS_PASSWORD`) y la clave de cifrado.
3. Importar el repo en Vercel y pegar las variables de entorno.
4. Desde tu computadora, correr las migraciones (y, si querés, el seed de demo).
5. Instalar la integración de Inngest en Vercel y volver a desplegar.
6. Más adelante: Google, Resend, Meta, TikTok y WhatsApp (sección 8).

**Lo que queda automatizado**

- Vercel construye y publica la app en cada push de la rama de producción.
- `npm run db:migrate` crea los roles `app_user` y `app_jobs`, aplica las tablas y prende el RLS. No lo hace el build de Vercel, a propósito: migrar en cada preview puede borrar o mezclar datos.
- Con `INTEGRATIONS_MODE=mock` la app no llama a Meta, TikTok ni WhatsApp.
- Inngest, una vez conectado, dispara los crons (recordatorios, cobros vencidos, sync, borrado).

## 0. Antes de empezar

Necesitás:

- Una cuenta de GitHub con este repo.
- Una cuenta en [supabase.com](https://supabase.com).
- Una cuenta en [vercel.com](https://vercel.com) conectada a GitHub.
- Node 22 en tu computadora (`node -v`). Si no lo tenés, instalalo desde [nodejs.org](https://nodejs.org).

En tu computadora, una sola vez:

```bash
git clone <url-del-repo>
cd influencers_crm
git checkout cursor/phase-3-integration-8854
npm install
```

Cuando la PR esté mergeada a `main`, usá `main` en vez de esa rama.

Generá los secretos y guardalos en un lugar que no sea el chat (un gestor de contraseñas). Cada uno es distinto:

```bash
openssl rand -base64 32
```

Corré ese comando **cuatro** veces. Anotá cada resultado con su nombre:

| Nombre | Para qué | Regla |
|---|---|---|
| `AUTH_SECRET` | Firma la cookie de sesión | El texto que te dio el comando, tal cual |
| `TOKEN_ENCRYPTION_KEY` | Cifra tokens de Instagram y TikTok | El texto que te dio el comando, tal cual. Tiene que ser base64 de 32 bytes. El comando de arriba ya lo es |
| `APP_USER_PASSWORD` | Contraseña del rol `app_user` | Al menos 16 caracteres. No uses `app_user_local` |
| `APP_JOBS_PASSWORD` | Contraseña del rol `app_jobs` | Distinta de la anterior. No uses `app_jobs_local` |

Si la contraseña tiene símbolos (`@`, `#`, `/`, espacio), después hay que codificarla para pegarla dentro de una URL. En la sección 4 está el comando.

## 1. Crear el proyecto de Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard).
2. **New project**.
3. Nombre: `influencers-crm` (o el que quieras).
4. **Database password**: inventá una y guardala. Es la contraseña del usuario `postgres`. No es ninguna de las cuatro de arriba.
5. **Region**: `South America (São Paulo)`. Es la más cercana a Uruguay. No elijas Estados Unidos si podés evitarlo: la app va a hablar con esa base en cada click.
6. Esperá a que el proyecto diga que está listo (un par de minutos).

### Claves que vas a copiar

Abrí **Project Settings** (el engranaje).

**API** (Settings → API):

| Qué dice Supabase | Variable en Vercel |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` | `SUPABASE_SERVICE_ROLE_KEY` |

La `service_role` salta el login de Supabase. No la pongas en el frontend ni en un mensaje. En Vercel va como variable de servidor, sin el prefijo `NEXT_PUBLIC_`.

**Database** (Settings → Database → Connection string):

Vas a usar **dos** URLs distintas. No las mezcles.

1. **Para migrar, desde tu computadora.** Elegí **Session pooler** (host `pooler.supabase.com`, puerto **5432**) o **Direct connection** (host `db.<ref>.supabase.co`, puerto **5432**). El usuario es `postgres` o `postgres.<ref>`. Guardala como “URL de migración”. La conexión directa a veces es solo IPv6: si tu compu no entra, usá el session pooler.
2. **Para que Vercel atienda visitas.** Elegí **Transaction pooler** (el mismo host, puerto **6543**). Esa es la que aguanta muchas funciones chiquitas de Vercel. El usuario arranca como `postgres.<ref>`.

La base se llama `postgres`, no `influencers_crm`. Está bien.

## 2. Importar el repo en Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import** el repo de GitHub.
2. Framework: **Next.js** (lo detecta solo). El `vercel.json` del repo fija la región `gru1` (São Paulo), igual que la base.
3. Node.js: **22.x**. Si el menú no lo muestra, en el proyecto después: Settings → General → Node.js Version → 22.x.
4. **No** pongas un Build Command distinto. Dejá `npm run build`. El build no migra la base.
5. Si todavía no mergeaste a `main`: Settings → Git → Production Branch → `cursor/phase-3-integration-8854`. Cuando mergees, volvé a poner `main`.

Todavía no aprietes Deploy. Primero las variables.

## 3. Variables de entorno en Vercel

En el proyecto: Settings → Environment Variables. Marcalas para **Production** (y Preview si querés previews). Pegá el valor, no el nombre de la variable dos veces.

### Obligatorias para el primer deploy

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La URL del **transaction pooler** (puerto 6543), usuario `postgres.<ref>`, contraseña de la base |
| `DATABASE_URL_APP` | La misma URL, pero el usuario es `app_user.<ref>` y la contraseña es `APP_USER_PASSWORD` |
| `DATABASE_URL_JOBS` | La misma URL, usuario `app_jobs.<ref>`, contraseña `APP_JOBS_PASSWORD` |
| `AUTH_SECRET` | El secreto de la sección 0 |
| `AUTH_MODE` | `local` |
| `TOKEN_ENCRYPTION_KEY` | El secreto de la sección 0 |
| `NEXT_PUBLIC_APP_URL` | La dejás vacía por ahora. Después del primer deploy la cambiás por la URL real, por ejemplo `https://influencers-crm.vercel.app` (sin barra al final) |
| `INTEGRATIONS_MODE` | `mock` |
| `EMAIL_FROM` | `influencers_crm <noreply@localhost>` está bien mientras no haya Resend |

No crees `AUTH_DEV_EXPOSE_LINKS`, o ponela en `false`. En producción la app se niega a arrancar si está en `true`, porque mostraría links y códigos de WhatsApp en la pantalla.

Para armar `DATABASE_URL_APP`, copiá la URI del pooler y cambiá solo el usuario y la contraseña. Si la contraseña tiene símbolos:

```bash
node -e "console.log(encodeURIComponent(process.argv[1]))" 'pegá-la-contraseña-acá'
```

Ese texto codificado es el que va **dentro** de la URL, en el lugar de la contraseña. Un ejemplo (los datos son ficticios):

```text
postgresql://app_user.abcdefghijklmnop:CONTRASEÑA_CODIFICADA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

`DATABASE_URL_JOBS` es igual, con `app_jobs.<ref>` y la otra contraseña.

### Las que pueden quedar vacías en el primer deploy

No las borres si Vercel ya las creó vacías. Vacío significa “apagado”.

| Variable | Cuándo la llenás |
|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ya la tenés. Pegala igual, aunque Google se prenda después |
| `SUPABASE_SERVICE_ROLE_KEY` | Igual: pegala ahora, no se usa para las pantallas normales |
| `NEXT_PUBLIC_SUPABASE_URL` | Pegala ahora |
| `RESEND_API_KEY` | Sección 8 |
| `INNGEST_EVENT_KEY` | La pone la integración de Inngest (sección 6) |
| `INNGEST_SIGNING_KEY` | La pone la integración de Inngest |
| `SENTRY_DSN` | Si más adelante querés errores en Sentry |
| `NEXT_PUBLIC_POSTHOG_KEY` | Si más adelante querés métricas de producto |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` si usás PostHog |
| `WHATSAPP_TOKEN` | Sección 8 |
| `WHATSAPP_PHONE_NUMBER_ID` | Sección 8 |
| `WHATSAPP_APP_SECRET` | Sección 8. Podés inventar una ahora; el webhook la usa para firmar |
| `WHATSAPP_VERIFY_TOKEN` | Sección 8. Un texto que vos elegís y Meta te lo va a pedir |
| `WHATSAPP_GRAPH_VERSION` | Vacío usa `v21.0` |
| `INSTAGRAM_APP_ID` | Sección 8 |
| `INSTAGRAM_APP_SECRET` | Sección 8 |
| `INSTAGRAM_REDIRECT_URI` | Vacío usa `{NEXT_PUBLIC_APP_URL}/api/v1/social/instagram/callback` |
| `INSTAGRAM_GRAPH_VERSION` | Vacío usa `v22.0` |
| `TIKTOK_CLIENT_KEY` | Sección 8 |
| `TIKTOK_CLIENT_SECRET` | Sección 8 |
| `TIKTOK_REDIRECT_URI` | Vacío usa `{NEXT_PUBLIC_APP_URL}/api/v1/social/tiktok/callback` |
| `APP_USER_PASSWORD` | No hace falta en Vercel. Solo en tu computadora, al migrar |
| `APP_JOBS_PASSWORD` | Igual |

Ahora sí: **Deploy**.

Cuando termine, copiá la URL (algo como `https://influencers-crm.vercel.app`). Volvé a Environment Variables, poné esa URL en `NEXT_PUBLIC_APP_URL` y redeployá (Deployments → el último → Redeploy). Sin eso, los links de los mails y de WhatsApp apuntan a localhost.

## 4. Migrar la base (desde tu computadora)

Esto crea las tablas, el RLS y los roles `app_user` y `app_jobs`. Corrélo **una vez** contra Supabase, no en cada deploy.

En la carpeta del repo:

```bash
export DATABASE_URL='pegá-la-URL-de-sesión-o-directa-puerto-5432'
export APP_USER_PASSWORD='la de la sección 0'
export APP_JOBS_PASSWORD='la otra'
npm run db:migrate
```

Tiene que imprimir `Migraciones aplicadas`.

Qué hace el script, para que no lo corras en el lugar equivocado:

- Si la URL es de Supabase y las contraseñas faltan, son cortas o son las de desarrollo, **para** y no toca la base.
- Si el puerto es **6543**, **para**. Ese pooler no sirve para migrar.
- Crea `app_user` y `app_jobs` (o les actualiza la contraseña si ya existían) y les deja `search_path` en `public, app`.
- Aplica `drizzle/0000` … `drizzle/0006`, incluidas las políticas de RLS.

Si ves un error de IPv6 con el host `db.<ref>.supabase.co`, cambiá `DATABASE_URL` por el **session pooler** (puerto 5432, host `pooler.supabase.com`) y volvé a correr el mismo comando. Las migraciones que ya entraron no se repiten.

### Seed de demo (opcional)

El seed **borra todo** lo que haya en las tablas públicas y carga a Cami, Diego, Nati y Valen. Contraseña de las cuatro: `demo1234`. Usalo solo en una base vacía, nunca en una con gente real.

```bash
export DATABASE_URL='la misma URL de migración, puerto 5432'
export ALLOW_SEED=true
npm run db:seed
```

Sin `ALLOW_SEED=true` el script no corre contra Supabase.

## 5. Fijate que anda

1. Abrí `https://TU-URL.vercel.app/api/health`. Tiene que responder `{"data":{"ok":true,"service":"influencers_crm"}}`.
2. Abrí `/registro`. El país por defecto es Uruguay. Creá una cuenta con una contraseña de 8 caracteres o más.
3. Tendrías que caer en **Hoy**. Creá una marca y un acuerdo.
4. Si corriste el seed: entrá con `cami@demo.influencerscrm.test` / `demo1234`. El media kit público es `/cami-gomez`.
5. En Ajustes, el idioma tiene que decir **Español (Uruguay)** y no dejarte pasar a otro.

Si el health da 503, la `DATABASE_URL` de Vercel no llega a Supabase (casi siempre: puerto equivocado, contraseña sin codificar, o usaste la URL directa IPv6). Si el registro dice que no podés escribir, `DATABASE_URL_APP` no es el rol `app_user` o la contraseña no coincide con la que usaste al migrar.

Los recordatorios **no** salen solos hasta que conectes Inngest. El resto de la app sí.

## 6. Conectar Inngest

Inngest es el que corre los trabajos: recordatorios cada 15 minutos, cobros vencidos, resumen de las 9, sync de redes, renovación de tokens y borrado de cuentas a los 30 días.

1. En Vercel: el proyecto → Integrations → buscá **Inngest** → Add.
2. Aceptá que cree `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` en Production.
3. Redeploy. La integración sincroniza `https://TU-URL.vercel.app/api/inngest`.
4. En el dashboard de Inngest tendrías que ver la app `influencers-crm` y siete funciones (`reminders.dispatch`, `payments.mark-overdue`, `digest.weekly`, `social.sync-daily`, `social.refresh-tokens`, `account.hard-delete`, `reminders.schedule`).

El mismo endpoint también está en `/api/webhooks/inngest`, por si lo tenías apuntado a mano. Con la integración de Vercel no hace falta tocarlo: ella usa `/api/inngest`.

Sin esas dos claves, la pantalla sigue andando. Los crons no.

## 7. Auth de Supabase (podés dejarlo para después)

El primer deploy usa `AUTH_MODE=local`: email y contraseña los guarda la propia app. No hace falta Google.

Cuando quieras “Continuar con Google”:

1. En Vercel, `AUTH_MODE=supabase`. Redeploy.
2. Supabase → Authentication → URL configuration:
   - **Site URL**: `https://TU-URL.vercel.app`
   - **Redirect URLs**: `https://TU-URL.vercel.app/auth/callback`
3. Authentication → Providers → Google. Pegá el client id y el secret de Google Cloud. En Google Cloud, el redirect autorizado es el que te muestra Supabase (`https://<ref>.supabase.co/auth/v1/callback`), no el de Vercel.
4. Probá `/api/v1/auth/google`. Tiene que ir a Google y volver a `/auth/callback`.

La app no usa el JWT de Supabase para leer las tablas. Después del login crea su propia cookie. Las tres URLs de Postgres siguen siendo obligatorias.

## 8. Pasar a modo live (Meta, TikTok, WhatsApp, Resend)

Cuando el mock ya te cierra y tenés las apps aprobadas, en Vercel cambiá `INTEGRATIONS_MODE` a `live` y redeployá. Cada canal que no tenga su clave **sigue en mock**. Podés prender el mail y dejar WhatsApp apagado.

### Resend (mail)

1. [resend.com](https://resend.com) → API Keys → creá una.
2. Verificá un dominio y un remitente.
3. En Vercel: `RESEND_API_KEY` y `EMAIL_FROM` con la forma `influencers_crm <hola@tu-dominio>`.

Sin esto, los recordatorios que no entran por WhatsApp no salen por mail.

### WhatsApp (Cloud API)

En Meta Business, con la app y el número ya aprobados:

| Variable | Dónde está en Meta |
|---|---|
| `WHATSAPP_TOKEN` | Token del sistema, de la app de WhatsApp |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp → API Setup → Phone number ID |
| `WHATSAPP_APP_SECRET` | App settings → Basic → App secret |
| `WHATSAPP_VERIFY_TOKEN` | Un texto que inventás vos |
| `WHATSAPP_GRAPH_VERSION` | Vacío, o `v21.0` |

Webhook en Meta:

- URL: `https://TU-URL.vercel.app/api/webhooks/whatsapp`
- Verify token: el mismo `WHATSAPP_VERIFY_TOKEN`
- Suscribí el campo `messages`

Las plantillas (utilidad, salvo el código que es autenticación) están en `src/modules/reminders/templates.ts`. El idioma es `es`. Hasta que Meta las apruebe, el mock sigue siendo el que contesta.

### Instagram

App de Meta con Instagram Login. Permisos: `instagram_business_basic` y `instagram_business_manage_insights`.

| Variable | Valor |
|---|---|
| `INSTAGRAM_APP_ID` | App ID |
| `INSTAGRAM_APP_SECRET` | App secret |
| `INSTAGRAM_REDIRECT_URI` | Vacío, o exactamente `https://TU-URL.vercel.app/api/v1/social/instagram/callback` |
| `INSTAGRAM_GRAPH_VERSION` | Vacío usa `v22.0` |

En Meta, el redirect OAuth tiene que ser esa misma URL. Una cuenta personal no se conecta: la app le explica a la persona cómo pasarla a profesional.

### TikTok

Login Kit. Scopes: `user.info.basic`, `user.info.stats`, `video.list`.

| Variable | Valor |
|---|---|
| `TIKTOK_CLIENT_KEY` | Client key |
| `TIKTOK_CLIENT_SECRET` | Client secret |
| `TIKTOK_REDIRECT_URI` | Vacío, o exactamente `https://TU-URL.vercel.app/api/v1/social/tiktok/callback` |

En el portal de TikTok, el redirect tiene que coincidir. TikTok no manda la audiencia por esta API: eso se carga a mano y se muestra como declarado.

## 9. Si algo se rompe

| Síntoma | Qué mirar |
|---|---|
| El deploy de Vercel falla por `maxDuration` | Tu plan no llega a 60 segundos. En `vercel.json` bajá esos `60` a `10` y redeployá |
| `/api/health` en 503 | `DATABASE_URL` de Vercel. Puerto 6543, `sslmode=require`, contraseña codificada |
| Podés entrar pero no crear nada | `DATABASE_URL_APP` no es `app_user.<ref>` o la contraseña no es la del migrate |
| Los crons no corren | Falta la integración de Inngest o no redeployaste después de conectarla |
| Google vuelve a `/login?error=google` | `AUTH_MODE` no es `supabase`, o el redirect de Supabase no es `https://TU-URL/auth/callback` |
| El migrate dice que la contraseña es local | Estás apuntando a Supabase con `app_user_local`. Usá las contraseñas largas de la sección 0 |
