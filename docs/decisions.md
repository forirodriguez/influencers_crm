# Decisiones de la fase 1

El spec deja abiertas las preguntas de la sección 15. Estas son las respuestas con las que se construyó la fundación. Se pueden cambiar sin migrar datos, salvo que se indique.

1. **Nombre.** El producto se llama `influencers_crm` (reemplaza el placeholder "Colab" del spec). No hay dominio. Las apps de Meta y TikTok esperan un dominio real; mientras tanto los adaptadores corren en modo mock.
2. **Entidad legal.** No está modelada en el software. El borrador de privacidad asume operación a definir antes de la beta abierta y región de base en São Paulo, a declarar como transferencia internacional. Los textos legales son borradores con versión `2026-11-23`, no asesoramiento.
3. **País de arranque.** El producto soporta AR, MX, CO y UY desde el día uno. No hay bloqueo geográfico. El registro arranca en Uruguay (UYU, `America/Montevideo`). El seed sigue teniendo los cuatro países y USD.
4. **Tono.** La voz activa es español uruguayo, voseo rioplatense, en `src/i18n/messages/es-UY/`. Es el único catálogo que carga `load.ts`. `es-MX` y `es-CO` no se ofrecen ni se mezclan: el overlay de tuteo quedó en el repo, fuera de la interfaz. La estructura (`deepMerge`, una carpeta por locale) queda para sumar otro idioma más adelante. Los ejemplos de plata usan UYU y el formato `es-UY` (`UYU 15.000`).
5. **Precio de la beta.** Gratis. `workspaces.plan` nace en `beta`. No hay Mercado Pago.
6. **Rango de seguidores.** No hay compuerta. La persona objetivo sigue siendo 10k–100k, y una cuenta nano puede registrarse. Las demografías de Instagram no se muestran bajo 100 seguidores cuando el módulo de redes las lea.
7. **Agencias.** El modelo, los roles `owner` / `manager` / `viewer` y las invitaciones están. La UI de agencia no. En el encargo, "member" corresponde a `manager` (edita) o `viewer` (solo lee). El seed incluye el workspace `Estudio Rambla`.
8. **Equipo.** La fundación está partida para que CRM, media kit y recordatorios avancen en paralelo. Ver `docs/ARCHITECTURE.md`.
9. **IA.** Fuera de esta fase y del default del MVP. El bot solo entiende comandos explícitos. No hay llamada a un modelo.
10. **Presupuesto.** Local y CI usan Postgres y mocks. No hace falta una clave real para desarrollar. El tope de WhatsApp queda en 3 mensajes de utilidad por usuario por día, fuera de las 21:00–08:00 hora local.

## Decisiones técnicas que no estaban en las preguntas

- **Auth local por defecto.** Cookie httpOnly firmada con HMAC (`icrm_session`). Magic link y contraseña. Google solo si `AUTH_MODE=supabase` y hay claves. `auth_credentials` y `magic_links` son tablas de infraestructura: `app_user` no puede leerlas.
- **RLS.** El request de la app usa el rol `app_user` y hace `set_config('app.user_id', …, true)` dentro de la transacción. Los jobs usan `app_jobs`. El superusuario solo migra, seedea y arranca cuentas (no existe membresía todavía al insertar el primer workspace). Aunque el rol de base filtre por membresía, cada query filtra `workspace_id` porque una persona puede pertenecer a varios espacios.
- **Montos.** `bigint` en unidades menores (centavos) para ARS, MXN, COP, UYU y USD. COP se muestra sin decimales. El código de moneda va explícito (`ARS 450.000`) para no confundir el signo `$`. No hay conversión.
- **Media kit público.** `/{slug}` lee `app.get_public_media_kit`, función `SECURITY DEFINER` que no devuelve tokens. `noindex` salvo que el perfil marque `indexable`.
- **Recordatorios.** Ver `src/modules/reminders/MODULE.md`.
- **Integraciones.** `INTEGRATIONS_MODE=mock` por defecto y no sale a la red. En `live`, Instagram, TikTok, WhatsApp y Resend llaman a su API solo si están las claves de ese canal; si faltan, ese canal sigue en mock.
- **Sentry y PostHog.** Stubs. Sin DSN o sin clave no hacen nada. PostHog solo se inicializa en el cliente si `NEXT_PUBLIC_POSTHOG_KEY` existe.
- **Inngest.** Las siete funciones del spec están registradas en `src/jobs/functions/index.ts` y ejecutan recordatorios, cobros vencidos, resumen, sync de redes, renovación de tokens y borrado de cuentas. El endpoint es `/api/webhooks/inngest`.

## Decisiones de la integración

- **Migraciones.** `0000` y `0001` no se tocan. Después, en este orden: `0002_reminders_identity`, `0003_media_kit_public`, `0004_crm_soft_delete`, `0005_crm_select_retired`. Los tres módulos habían numerado su SQL como `0002`.
- **Bot y CRM.** `nuevo` crea marca (o reutiliza el nombre normalizado), acuerdo, cuota a 30 días y actividad. `cobré` registra el saldo con `recordReceipt`. Hoy, Entregables, el comando `semana` y el resumen cuentan la misma ventana: desde hoy hasta seis días después, en la zona del usuario.
- **Avisos.** El resumen y los recordatorios dejan una notificación `in_app`. Hoy muestra esas notificaciones, no una lista paralela.
- **Voz.** Decisión de producto posterior a la fundación: la interfaz, los mails, el bot y las plantillas de WhatsApp hablan en español uruguayo. El país del creator sigue definiendo la moneda y la zona horaria, no el tono.
