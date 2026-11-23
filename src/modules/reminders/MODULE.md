# Recordatorios y WhatsApp

Dueño: reglas, notificaciones, consentimientos, mensajes de WhatsApp y el bot.

Podés editar `src/modules/reminders/**`, `src/app/api/webhooks/whatsapp`, `src/app/api/v1/reminder-rules`, `src/app/api/v1/notifications` y los jobs en `src/jobs/functions/stubs.ts` (o archivos nuevos exportados desde `src/jobs/functions/index.ts`).

Contrato del dispatcher:

- Por cada vencimiento se manda un solo canal externo: WhatsApp si hay consentimiento y `canSendWhatsApp` lo permite; si no, email.
- Siempre se crea además una notificación `in_app`.
- La clave de idempotencia incluye canal, instante y usuario, por ejemplo `deliverable:{id}:due-48h:{iso}:whatsapp:{userId}`.
- Horario silencioso 21:00–08:00 hora local. Tope `MAX_WHATSAPP_PER_USER_PER_DAY` (3).
- El resumen sale a las 9:00 hora local: diario de martes a domingo y semanal los lunes (`digest.weekly`, cron horario).
- Los comandos (`hoy`, `semana`, `cobros`, `pendientes`, `nuevo`, `cobré`, `ayuda`, `baja`) se parsean en `commands.ts`. El webhook verifica la firma y los ejecuta.
- No hay chatbot de IA. Un mensaje que no matchea queda como `unparsed` y el bot responde con la ayuda. No crea un acuerdo.

Las reglas sembradas son solo canal `whatsapp`. El fallback a email es código, no otra fila. Las plantillas para Meta están en `templates.ts`.
