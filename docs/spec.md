# Spec MVP — CRM para microinfluencers (Latam hispanohablante)

> Versión 0.1 · 23/11/2026 · Autor: Grok Bot para Fori
> Basado en el análisis de mercado [CRM para microinfluencers en Latam: ¿vale la pena?](https://cursor.com/canvas/store-96bec355-ed21-408c-b08b-5ea98687feba/a4d95bd2-ef77-46bf-b26d-fbaf605cbcb4).
>
> Convenciones de este documento:
> - **[DATO]** = hecho verificado con fuente (link al lado).
> - **[SUPUESTO]** = decisión o hipótesis nuestra, a validar.
> - **[ESTIMACIÓN]** = número aproximado nuestro, no es un dato de mercado.
> - "Nombre de trabajo" del producto: **Colab** (placeholder, cambiar).

---

## 0. Resumen en una pantalla

- **Qué es:** una web app (mobile-first, PWA) para que microinfluencers ordenen sus acuerdos con marcas: quién les escribió, qué negociaron, qué tienen que publicar y cuándo, y cuánto les deben. Recordatorios por WhatsApp.
- **Para quién:** microinfluencers (aprox. 10k–100k seguidores [SUPUESTO de rango]) en México, Argentina, Colombia y Uruguay. Segundo paso: agencias chicas que manejan varios creators.
- **Decisiones clave:**
  - Hecho con código desde el día 1 (sin no-code).
  - **Sin facturación** (ni Factura C, ni CFDI, ni factura electrónica DIAN/DGI). Solo **seguimiento** de lo que se debe y lo que se cobró.
  - WhatsApp-first **dentro de lo que permite la API oficial**: el producto tiene su propio número que manda recordatorios y recibe comandos/reenvíos. **No** lee los chats del creador con las marcas (la API no lo permite; ver §7.6).
  - Multi-tenant desde el modelo de datos (workspace → miembros → creators) para poder sumar agencias sin migrar.
  - Stack: Next.js + TypeScript + Postgres (Supabase) + jobs en background + WhatsApp Cloud API directa.
- **Plazo:** MVP en beta cerrada en **~12 semanas con 2 devs full-stack + diseño part-time** [ESTIMACIÓN], sin contar demoras de revisión de apps de Meta/TikTok.

---

## 1. Objetivo del MVP y métricas de éxito

### 1.1 Objetivo
Validar que microinfluencers hispanohablantes **usan semanalmente** una herramienta para gestionar acuerdos con marcas y que **una parte está dispuesta a pagar** por ella, antes de invertir en facturación, marketplace o IA.

### 1.2 Hipótesis a validar
1. H1: El dolor principal es **no perder deals y cobrar lo que se debe** (en Brasil, el plazo de pago fue el dolor nº1, con 45–180 días [DATO, Veeras](https://veeras.com.br/pesquisa/estado-influencer-marketing-brasil-2026); asumimos que se repite en el mundo hispano [SUPUESTO]).
2. H2: Los recordatorios por WhatsApp generan más retención que el email [SUPUESTO].
3. H3: Un media kit con métricas conectadas por API es razón suficiente para registrarse [SUPUESTO].
4. H4: Agencias chicas pagan más y se van menos que creators individuales [SUPUESTO].

### 1.3 Métricas de éxito (objetivos [SUPUESTO], a ajustar con Fori)
| Métrica | Definición | Objetivo beta (8 semanas después del lanzamiento) |
|---|---|---|
| Activación | % de registrados que crean ≥1 acuerdo y ≥1 entregable en 7 días | ≥ 50% |
| Retención W4 | % de activados que vuelven (web o WhatsApp) en la semana 4 | ≥ 35% |
| Uso de WhatsApp | % de activados que hacen opt-in a recordatorios por WhatsApp | ≥ 60% |
| Cobros registrados | Monto total marcado como "cobrado" en la plataforma | Crece semana a semana |
| Media kit | % de activados que publican su media kit | ≥ 40% |
| Intención de pago | % que acepta un plan pago (o preventa) al final de la beta | ≥ 5% de activos |
| Agencias | Agencias en piloto | ≥ 3 |

---

## 2. Usuarios / personas

| Persona | Descripción | Necesidad principal | Notas |
|---|---|---|---|
| **Cami, microinfluencer** (principal) | 25 años, Buenos Aires, 35k en Instagram + TikTok, nicho belleza. Cierra 2–6 colaboraciones por mes entre pagas y canjes. Negocia por DM y WhatsApp, anota en notas del celular. | No olvidarse de entregas y saber quién le debe plata. | Muchos micro/nano no tienen manager ni media kit formal [DATO, HypeAuditor](https://blog.hypeauditor.com/how-foreign-brands-can-enter-latin-america-through-influencer-marketing/). |
| **Diego, creator en crecimiento** | CDMX, 80k en TikTok, empieza a recibir propuestas que no sabe cotizar. | Media kit creíble y orden en el pipeline. | En México TikTok tiene más creadores activos que Instagram [DATO, HypeAuditor](https://blog.hypeauditor.com/es/donde-estan-los-creadores-mas-activos-de-america-latina/). |
| **Valen, agencia chica** (secundaria, post-MVP parcial) | Montevideo, agencia de 3 personas que maneja 25 micros para marcas locales. Hoy usa planillas + grupos de WhatsApp. | Ver todos los deals y cobros de sus creators en un lugar. | El MVP deja la base multi-tenant; la UI de agencia completa es v1.1. |
| **Marca / contacto de marca** (no es usuario) | La persona de la marca que negocia. | Recibir el media kit por link. | Solo ve la página pública del media kit. No tiene login en el MVP. |

---

## 3. Alcance

### 3.1 Dentro del MVP
1. Registro / login (email mágico + Google) y onboarding.
2. Perfil del creador + **media kit público** (link compartible).
3. Conexión de **Instagram** (cuentas profesionales) y **TikTok** para traer métricas.
4. **Contactos de marcas** (marcas y personas).
5. **Pipeline de acuerdos** (kanban + lista) con etapas configurables.
6. **Entregables y fechas** por acuerdo (borrador, aprobación, publicación).
7. **Seguimiento de cobros**: monto acordado, moneda, cuotas, fecha prometida, estado (pendiente / vencido / cobrado parcial / cobrado). **Sin emitir facturas.**
8. **Recordatorios** (in-app, email y WhatsApp) de entregas y cobros.
9. **Bot de WhatsApp** acotado: opt-in, recordatorios, resumen semanal, y comandos simples (ver §5.8).
10. Workspaces multi-tenant con roles (owner, manager, viewer), aunque en el MVP casi todos sean workspaces de una persona.
11. Monedas locales (MXN, ARS, COP, UYU) + USD.
12. Español neutro-latino con variantes (es-AR/es-UY con voseo, es-MX, es-CO) [SUPUESTO: arrancar con un solo español neutro y voseo opcional; ver preguntas abiertas].
13. Cobro de la suscripción propia: **fuera del MVP técnico** si la beta es gratis; preparado para Mercado Pago Suscripciones (ver §3.2).

### 3.2 Fuera de alcance (futuro)
| Tema | Por qué queda afuera | Cuándo revisarlo |
|---|---|---|
| **Facturación electrónica** (Factura C/E AR vía ARCA, CFDI MX, DIAN CO, DGI UY) | Pedido explícito de Fori; además es distinta en cada país. | v2, si las entrevistas lo piden. |
| Procesar pagos de marcas a creators (escrow, payouts) | Nos convierte en intermediario financiero. | v2+. |
| Cobro de nuestra suscripción | La beta es gratis [SUPUESTO]. Mercado Pago Suscripciones funciona en AR, BR, MX y UY [DATO, Mercado Pago](https://www.mercadopago.com.uy/developers/es/docs/subscriptions/overview); Colombia a verificar. | Al cerrar la beta. |
| Marketplace / búsqueda de marcas | Requiere masa crítica. | v2+. |
| Agente de IA que negocia | Complejo; además hay restricciones de Meta a chatbots de IA generalistas (§7.6). | Explorar luego. |
| Leer los chats de WhatsApp del creador con marcas | No lo permite la API (§7.6). | No previsto. |
| YouTube, X, Twitch | Foco en IG + TikTok. | v1.2. |
| Contratos con firma electrónica | Valioso pero no core. | v1.2. |
| Tarifas sugeridas con datos agregados | Necesita volumen de datos. | v1.2 (con datos propios anonimizados). |
| Portugués / Brasil | Mercado distinto y con competidor local (Veeras). | Más adelante. |
| App nativa iOS/Android | PWA alcanza para validar. | Post-beta. |
| UI completa de agencia (reportes multi-creator, permisos finos) | Base de datos sí, UI parcial. | v1.1. |

---

## 4. User stories con criterios de aceptación

Formato: *Como [persona], quiero [acción], para [beneficio].* Criterios en Given/When/Then simplificado. Prioridad: **P0** = imprescindible para la beta, **P1** = deseable.

### Onboarding y cuenta
**US-01 (P0) Registro.** Como creator quiero registrarme con mi email o Google para empezar rápido.
- Puedo registrarme con link mágico por email o con Google.
- Al registrarme se crea automáticamente un workspace personal donde soy `owner`.
- Elijo país (MX, AR, CO, UY, otro) y moneda por defecto se setea según el país (editable).
- Acepto términos y política de privacidad (checkbox obligatorio, con versión guardada).

**US-02 (P0) Opt-in de WhatsApp.** Como creator quiero recibir recordatorios por WhatsApp.
- Ingreso mi número en formato E.164; recibo un código de verificación (por WhatsApp, template de autenticación, o SMS como alternativa [SUPUESTO]).
- Se guarda el consentimiento explícito con fecha, texto aceptado y canal.
- Puedo desactivarlo desde la app o escribiendo "BAJA" al bot; queda registrado.

### Perfil y media kit
**US-03 (P0) Conectar Instagram.** Como creator quiero conectar mi Instagram para mostrar métricas reales.
- Si mi cuenta es personal (no profesional), la app me explica cómo pasarla a "creator" y no falla en silencio.
- Tras conectar, veo seguidores, alcance/vistas de los últimos 30 días y mis últimas publicaciones.
- Si tengo menos de 100 seguidores, las demografías no aparecen y la UI lo explica [DATO: Meta no las devuelve bajo 100 seguidores, ver §7.4].
- Puedo desconectar; los tokens se borran.

**US-04 (P0) Conectar TikTok.** Igual que US-03 con TikTok; se muestran seguidores, likes totales, cantidad de videos y métricas públicas de videos recientes.

**US-05 (P0) Media kit público.** Como creator quiero un link a mi media kit para mandarlo a marcas.
- Tengo una URL `/{slug}` editable, única.
- Incluye: foto, bio, nichos, redes, métricas conectadas (con fecha de "actualizado el"), servicios con precio de referencia opcional, colaboraciones pasadas destacadas, botón de contacto (email o WhatsApp).
- Las métricas conectadas por API llevan una marca "verificado vía API"; las cargadas a mano dicen "declarado".
- Puedo ocultar cualquier bloque y ocultar precios.
- La página carga en < 2 s en 4G [SUPUESTO de objetivo] y se ve bien en celular.

### Marcas y contactos
**US-06 (P0) Cargar marca.** Como creator quiero guardar marcas y sus contactos.
- Marca: nombre (obligatorio), web, Instagram, rubro, país, notas.
- Contacto: nombre, rol, email, WhatsApp, Instagram; puede haber varios por marca.
- Busco marcas por nombre; no se crean duplicados exactos (mismo nombre normalizado en el workspace → aviso).

### Pipeline de acuerdos
**US-07 (P0) Crear acuerdo.** Como creator quiero registrar una propuesta en segundos.
- Campos mínimos: marca (existente o nueva inline), título. Todo lo demás es opcional.
- Etapas por defecto: `Lead` → `Negociando` → `Confirmado` → `En producción` → `Publicado` → `Cobrado` · y `Perdido` (con motivo).
- Tipo de compensación: `pago`, `canje`, `mixto`, `afiliado/comisión`. Para canje se registra valor estimado del producto (opcional).
- Puedo crearlo desde la web o reenviando/escribiendo al bot de WhatsApp (US-14).

**US-08 (P0) Mover en el pipeline.** Vista kanban (drag & drop en desktop, selector de etapa en móvil) y vista lista con filtros (etapa, marca, mes, estado de cobro).
- Cada cambio de etapa queda en el historial del acuerdo (quién, cuándo).

**US-09 (P1) Exclusividad.** Puedo marcar una exclusividad (categoría + fecha fin); si creo un acuerdo en la misma categoría con otra marca dentro del período, la app me avisa (no bloquea).

### Entregables
**US-10 (P0) Entregables con fechas.** Como creator quiero listar qué tengo que publicar y cuándo.
- Entregable: plataforma (IG/TikTok/otra), formato (reel, story, post, video, UGC sin publicar), cantidad, fecha de borrador, fecha de aprobación, fecha de publicación, estado (`pendiente`, `en revisión`, `aprobado`, `publicado`), link al posteo.
- Vista "Esta semana": todo lo que vence en 7 días, ordenado por fecha.
- Al pegar el link de un posteo de una cuenta conectada, la app intenta traer sus métricas (P1).

### Cobros (sin facturación)
**US-11 (P0) Registrar lo que me deben.** Como creator quiero saber cuánto me deben y desde cuándo.
- Por acuerdo: monto total, moneda, y uno o más **cobros esperados** (cuotas) con fecha prometida.
- Estados de cada cobro: `pendiente`, `vencido` (automático al pasar la fecha), `cobrado parcial`, `cobrado`, `incobrable`.
- Al marcar cobrado: fecha y monto real (puede diferir), medio (transferencia, Mercado Pago, efectivo, PayPal, otro), nota. **No se genera ningún comprobante fiscal.**
- Panel "Cobros": total pendiente y vencido **por moneda** (no se suman monedas distintas), lista ordenada por antigüedad.

**US-12 (P1) Mensaje de seguimiento de cobro.** Como creator quiero un texto listo para reclamar un pago.
- Botón "Recordarle a la marca" que arma un texto editable y abre `wa.me/<numero>?text=...` o `mailto:` desde **mi** WhatsApp/email. La app **no** escribe a la marca en mi nombre.

### Recordatorios y WhatsApp
**US-13 (P0) Recordatorios.** Como creator quiero que me avisen antes de una entrega o un cobro vencido.
- Por defecto: entrega a 48 h y el día; cobro el día prometido y cada 7 días mientras esté vencido (configurable/silenciable por acuerdo).
- Canal: WhatsApp si hay opt-in, si no email; siempre in-app.
- Resumen semanal (lunes 9:00 hora local del usuario): entregas de la semana + cobros vencidos.
- Nunca más de N mensajes de WhatsApp por día por usuario (N=3 [SUPUESTO]) para controlar costo y molestia.

**US-14 (P1) Cargar por WhatsApp.** Como creator quiero escribirle al bot para registrar algo sin abrir la app.
- Comandos de texto simples: `nuevo <marca> <monto> <moneda>`, `cobré <marca>`, `semana`, `ayuda`, `baja`.
- Si reenvío un mensaje de una marca, el bot crea un **borrador de acuerdo** con el texto en notas y me manda un link para completarlo. (Extracción automática con IA de monto/fecha: P1, opcional, como función auxiliar del CRM, no como chatbot general; ver §7.6.)
- Respuestas del bot dentro de la ventana de 24 h de atención (gratis hasta el cupo mensual; ver §7.6).

### Agencias (base en MVP, UI completa en v1.1)
**US-15 (P1) Invitar miembros.** Como owner de un workspace quiero invitar a otra persona con rol `manager` o `viewer`.
- Invitación por email; al aceptar, la persona ve el workspace en un selector.
- `viewer` no edita; `manager` edita todo menos facturación/plan y miembros.

**US-16 (P1) Agencia con varios creators.** Como agencia quiero gestionar los acuerdos de varios creators.
- Un workspace tipo `agency` puede tener varios **perfiles de creator**; cada acuerdo pertenece a un perfil.
- Filtro por creator en pipeline, entregables y cobros.
- Un creator puede vincular su propia cuenta a su perfil dentro de la agencia (P2, v1.1).

### Datos y privacidad
**US-17 (P0) Exportar y borrar.** Como usuario quiero exportar mis datos (CSV/JSON) y borrar mi cuenta.
- Exportación descargable en < 1 min para cuentas normales.
- Borrado: soft-delete inmediato y hard-delete en ≤ 30 días [SUPUESTO], incluidos tokens de redes y número de WhatsApp.

---

## 5. Funcionalidades core (detalle)

### 5.1 Perfil del creador y media kit
- Perfil: nombre artístico, slug, foto, bio corta (≤ 280), país, ciudad, nichos (lista cerrada + libre), idiomas, email público, WhatsApp público (opcional), redes conectadas y manuales.
- Servicios: nombre ("Reel 30–60 s"), plataforma, precio de referencia opcional + moneda, "desde" sí/no.
- Media kit: página SSR/ISR, `noindex` por defecto con opción de indexar [SUPUESTO], OG image generada (foto + seguidores).
- Snapshot de métricas guardado en BD (no se consulta la API en cada visita).
- Plantillas: 1 diseño en el MVP, con color de acento elegible.

### 5.2 Pipeline de acuerdos
- Etapas configurables por workspace (renombrar, reordenar, agregar; las etapas tienen un `kind` fijo: `open`, `won`, `lost`, `done` para métricas).
- Campos: marca, contacto principal, título, perfil de creator, etapa, tipo de compensación, monto total, moneda, valor de canje estimado, fecha de cierre esperada, fuente (DM IG, DM TikTok, email, WhatsApp, referido, otro), exclusividad, notas, adjuntos (brief, PDF; máx. 10 MB c/u [SUPUESTO]).
- Historial (activity log) por acuerdo.

### 5.3 Contactos de marcas
- Marcas y contactos por workspace (una agencia comparte su base de marcas entre sus creators).
- Vista de marca: todos sus acuerdos, total acordado y total cobrado, tiempo promedio de pago (días entre fecha de publicación y cobro).

### 5.4 Entregables y fechas
- Ver US-10. Calendario mensual simple + lista "Esta semana".
- Exportar a calendario: feed iCal privado por usuario (P1).

### 5.5 Seguimiento de cobros (sin facturación)
- Modelo de "cobros esperados" (cuotas) y "cobros recibidos".
- Indicadores: pendiente, vencido, cobrado del mes, días promedio de cobro por marca.
- **Explícitamente no**: numeración de comprobantes, CAE, CFDI, impuestos, retenciones.
- Inflación/tipo de cambio (relevante en AR): cada monto guarda su moneda; no convertimos automáticamente en el MVP. Opción de registrar el acuerdo en USD aunque se cobre en moneda local [SUPUESTO].

### 5.6 Recordatorios
- Motor de reglas simple: `entidad` + `offset` + `canal` + `zona horaria del usuario`.
- Jobs programados (ver §8) que generan `Notification` y despachan por canal.
- Idempotencia: cada recordatorio tiene una clave única (`deliverable:{id}:due-48h`) para no duplicar.
- Respetar horario: no enviar WhatsApp entre 21:00 y 8:00 hora local [SUPUESTO].

### 5.7 Métricas de redes
Ver §7.4 y §7.5 para límites reales. En el MVP:
- Instagram: perfil (seguidores, cantidad de posts), insights de cuenta de 30 días (vistas/alcance, interacciones), demografía de seguidores (país, ciudad, edad, género) si ≥ 100 seguidores, y métricas de los últimos N posts.
- TikTok: seguidores, siguiendo, likes totales, cantidad de videos, y vistas/likes/comentarios/compartidos de los últimos videos.
- Refresco: diario por la noche (hora del usuario) + botón "actualizar" con límite de 1 cada hora [SUPUESTO].

### 5.8 WhatsApp (en la medida en que sea viable)
**Qué SÍ hace el MVP**
- Un número de WhatsApp Business **del producto** conectado a la **WhatsApp Cloud API** de Meta.
- Mensajes salientes con **templates aprobados de categoría "utility"** (recordatorio de entrega, cobro vencido, resumen semanal) y uno de "authentication" para verificar el número.
- Mensajes entrantes del usuario (comandos y reenvíos) → webhooks → acciones en la app → respuesta libre dentro de la ventana de 24 h.
- Botón "Recordarle a la marca" con `wa.me` desde el WhatsApp personal del creator (sin API).

**Qué NO hace (y por qué)** → ver §7.6.

---

## 6. Modelo de datos

Postgres. Todas las tablas de negocio llevan `id (uuid)`, `workspace_id`, `created_at`, `updated_at`, `deleted_at (nullable)`. Montos en **unidades menores** (`bigint`, centavos) + `currency` ISO 4217.

### 6.1 Entidades

| Entidad | Campos principales | Relaciones |
|---|---|---|
| `users` | id, email, name, avatar_url, locale (`es-AR`, `es-MX`…), timezone, country (ISO-3166), phone_e164 (nullable), phone_verified_at, created_at | N `memberships` |
| `workspaces` | id, name, type (`personal` \| `agency`), country, default_currency, plan (`beta`, `free`, `pro`, `agency`), settings (jsonb) | N `memberships`, N `creator_profiles` |
| `memberships` | id, workspace_id, user_id, role (`owner` \| `manager` \| `viewer`), invited_by, accepted_at | user ↔ workspace |
| `invitations` | id, workspace_id, email, role, token_hash, expires_at, accepted_at | |
| `creator_profiles` | id, workspace_id, user_id (nullable: en agencias puede no tener cuenta), display_name, slug (único global), bio, photo_url, country, city, niches (text[]), languages (text[]), public_email, public_whatsapp, media_kit_settings (jsonb: bloques visibles, color, indexable) | N `social_accounts`, N `services`, N `deals` |
| `social_accounts` | id, creator_profile_id, platform (`instagram` \| `tiktok` \| `youtube` \| `other`), handle, external_id, connection (`api` \| `manual`), access_token_enc, refresh_token_enc, token_expires_at, scopes (text[]), status (`active` \| `expired` \| `revoked` \| `error`), last_synced_at | N `metric_snapshots`, N `posts` |
| `metric_snapshots` | id, social_account_id, captured_at, followers, following, media_count, likes_total, reach_30d, views_30d, interactions_30d, demographics (jsonb), raw (jsonb) | |
| `posts` | id, social_account_id, external_id, url, type, published_at, thumbnail_url, metrics (jsonb: views, likes, comments, shares, saves), fetched_at | opcional link a `deliverables` |
| `services` | id, creator_profile_id, name, platform, price_minor (nullable), currency, is_from_price, visible | |
| `brands` | id, workspace_id, name, name_normalized, website, instagram, tiktok, industry, country, notes | N `brand_contacts`, N `deals` |
| `brand_contacts` | id, brand_id, workspace_id, name, role, email, whatsapp_e164, instagram, notes | N `deals` (como contacto principal) |
| `pipeline_stages` | id, workspace_id, name, position, kind (`open` \| `won` \| `done` \| `lost`) | N `deals` |
| `deals` | id, workspace_id, creator_profile_id, brand_id, primary_contact_id, stage_id, title, compensation_type (`paid` \| `barter` \| `mixed` \| `affiliate`), amount_minor, currency, barter_value_minor, barter_currency, source, expected_close_date, lost_reason, exclusivity_category, exclusivity_until, notes, created_by | N `deliverables`, N `payment_expectations`, N `activities`, N `attachments` |
| `deliverables` | id, deal_id, workspace_id, platform, format, quantity, draft_due_at, approval_due_at, publish_due_at, status (`pending` \| `in_review` \| `approved` \| `published` \| `cancelled`), post_url, post_id (nullable → `posts`) | |
| `payment_expectations` | id, deal_id, workspace_id, amount_minor, currency, due_date, status (`pending` \| `overdue` \| `partial` \| `paid` \| `written_off`), note | N `payments_received` |
| `payments_received` | id, payment_expectation_id, workspace_id, amount_minor, currency, received_at, method (`bank_transfer` \| `mercado_pago` \| `cash` \| `paypal` \| `other`), note | |
| `activities` | id, workspace_id, deal_id (nullable), actor_user_id, type (`stage_changed`, `note`, `payment_marked`, `whatsapp_inbound`…), payload (jsonb), created_at | |
| `attachments` | id, workspace_id, deal_id, storage_key, filename, mime, size_bytes | |
| `reminder_rules` | id, workspace_id, entity (`deliverable` \| `payment`), offset_minutes, channel (`whatsapp` \| `email` \| `in_app`), enabled | |
| `notifications` | id, workspace_id, user_id, idempotency_key (único), channel, template, payload, scheduled_for, sent_at, status, provider_message_id, error | |
| `whatsapp_consents` | id, user_id, phone_e164, granted_at, revoked_at, source (`web` \| `whatsapp`), consent_text_version | |
| `whatsapp_messages` | id, user_id, direction (`in` \| `out`), wa_message_id, type, template_name, category (`utility` \| `authentication` \| `service`), body (encriptado o truncado), billable (bool), pricing_category, status, created_at | |
| `audit_log` | id, workspace_id, actor_user_id, action, entity, entity_id, ip, created_at | |
| `legal_acceptances` | id, user_id, document (`terms` \| `privacy`), version, accepted_at, ip | |

### 6.2 Relaciones (resumen)
```
users ─< memberships >─ workspaces ─< creator_profiles ─< social_accounts ─< metric_snapshots
                                   │                    └─< services          └─< posts
                                   ├─< brands ─< brand_contacts
                                   ├─< pipeline_stages
                                   └─< deals (creator_profile, brand, contact, stage)
                                         ├─< deliverables (─ posts)
                                         ├─< payment_expectations ─< payments_received
                                         ├─< activities
                                         └─< attachments
users ─< whatsapp_consents, whatsapp_messages, notifications, legal_acceptances
```

### 6.3 Índices y reglas
- `creator_profiles.slug` único global; `brands (workspace_id, name_normalized)` índice.
- `deals (workspace_id, stage_id)`, `deliverables (workspace_id, publish_due_at)`, `payment_expectations (workspace_id, status, due_date)`.
- `notifications.idempotency_key` único.
- Row Level Security (RLS) por `workspace_id` vía membresía (ver §9).

---

## 7. Arquitectura y stack

### 7.1 Stack recomendado

| Capa | Elección | Justificación |
|---|---|---|
| Frontend + backend web | **Next.js (App Router) + TypeScript**, Tailwind + shadcn/ui | Un solo repo/lenguaje, SSR para el media kit (SEO y OG), PWA posible, enorme oferta de devs en Latam [SUPUESTO]. |
| Base de datos | **Postgres en Supabase** | Postgres + Auth + Storage + RLS en un solo servicio; plan gratuito para la beta; región en São Paulo disponible [SUPUESTO: verificar región al crear el proyecto]. |
| ORM / migraciones | **Drizzle ORM** (o Prisma) | Tipado, migraciones versionadas, convive bien con RLS. |
| Auth | **Supabase Auth** (magic link + Google OAuth) | Evita construir auth; JWT compatible con RLS. |
| Jobs y cron | **Inngest** o **Trigger.dev** (alternativa self-host: pg-boss) | Recordatorios programados, sync nocturno de métricas, reintentos e idempotencia sin montar colas propias. |
| WhatsApp | **WhatsApp Cloud API (Meta) directa** | Sin margen de un BSP (Twilio/360dialog cobran fee encima [SUPUESTO]); se puede migrar a BSP si soporte lo requiere. |
| Email | **Resend** (o Postmark) | Transaccional simple con plantillas React. |
| Archivos | Supabase Storage (bucket privado + URLs firmadas) | Adjuntos de acuerdos y fotos de perfil. |
| Hosting | **Vercel** (web) + Supabase (BD) | Deploy por PR, previews. |
| Observabilidad | Sentry (errores) + PostHog (producto/funnels) | Métricas de éxito del §1.3. |
| Secrets | Variables de entorno en Vercel; tokens de redes **encriptados en BD** (AES-256-GCM con clave en KMS/env) | Los tokens de IG/TikTok son datos sensibles. |
| Tests | Vitest (unit), Playwright (e2e de flujos P0) | |
| i18n | `next-intl` | Mensajes por locale, formateo de moneda/fecha con `Intl`. |

**Alternativa considerada:** backend separado (NestJS/Fastify) + SPA. Descartado para el MVP por costo de coordinación; se puede extraer la API más adelante porque la lógica vive en una capa `server/` sin dependencias de UI.

### 7.2 Diagrama lógico
```
[PWA Next.js] ──HTTP──> [Next.js Route Handlers / Server Actions] ──> [Postgres (Supabase, RLS)]
       │                         │        │                               ▲
       │                         │        └─> [Supabase Storage]          │
       │                         └─> [Inngest jobs] ──> recordatorios ─────┤
       │                                   ├─> sync IG (Graph API)         │
       │                                   ├─> sync TikTok (Display API)   │
       │                                   └─> envío WhatsApp / email      │
[Meta webhooks WhatsApp] ──> /api/webhooks/whatsapp ──> parse comando ─────┘
[Media kit público /{slug}] ── ISR (revalida al cambiar snapshot)
```

### 7.3 Estructura sugerida del repo
```
/app            (rutas: (app)/..., [slug]/ media kit, api/...)
/server         (casos de uso: deals, payments, reminders, social, whatsapp)
/db             (schema Drizzle, migraciones, políticas RLS en SQL)
/jobs           (funciones Inngest)
/lib            (i18n, money, dates, crypto)
/emails         (plantillas)
/tests
```

### 7.4 Instagram — límites reales
- La **Instagram Basic Display API dejó de funcionar el 4/12/2024**; para apps de terceros quedan la Instagram API con login de Instagram o con login de Facebook, pensadas para **cuentas profesionales (business o creator)** [DATO, Meta](https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/). → Cuentas personales **no** se pueden conectar; el onboarding tiene que guiar el cambio a cuenta creator.
- Usar **Instagram API with Instagram Login** (no requiere página de Facebook). Permisos: `instagram_business_basic` + `instagram_business_manage_insights`. Para que cualquier usuario (no solo testers) pueda conectarse hace falta **Advanced Access**, que pasa por **App Review** de Meta [DATO, Meta](https://developers.facebook.com/blog/post/2025/03/24/user-and-media-insights-on-instagram-api-with-instagram-login/). Requiere además verificación del negocio en Meta [SUPUESTO: verificar requisito vigente].
- Límite de llamadas: **4.800 × impresiones de la cuenta en las últimas 24 h**, por par app–usuario, ventana de 24 h [DATO, Meta](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/). Para un sync diario es holgado; igual: backoff y leer headers de uso.
- Demografía de seguidores y `follows_and_unfollows` **no se devuelven con menos de 100 seguidores**; demografías solo traen top 45; los datos pueden demorar **hasta 48 h** [DATO, Meta Insights](https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights).
- Métricas de cuentas de **otros** (ej. una marca o un creator que no se conectó) no se pueden leer con este flujo; Business Discovery existe pero tiene sus propios límites y no es parte del MVP.
- Meta deprecó varias métricas en 2025 (ej. v22) → encapsular nombres de métricas en un solo módulo y revisar el changelog en cada versión.

### 7.5 TikTok — límites reales
- **Display API** con scopes `user.info.basic`, `user.info.stats` (seguidores, siguiendo, likes, cantidad de videos) y `video.list` (videos públicos del usuario autorizado) [DATO, TikTok](https://developers.tiktok.com/docs/en/tiktok-api-scopes).
- `video.list`: máximo **20 videos por llamada** (paginado).
- Rate limit: **600 requests/minuto por endpoint**, ventana deslizante; al exceder devuelve 429 `rate_limit_exceeded` [DATO, TikTok](https://developers.tiktok.com/docs/en/tiktok-api-v2-rate-limit).
- Cada scope pasa por **app review con video demo**; TikTok indica de días a dos semanas [DATO, TikTok FAQ](https://developers.tiktok.com/docs/en/getting-started-faq).
- La Display API **no da demografía de audiencia ni alcance** [SUPUESTO basado en los scopes listados; verificar si la Business API/TikTok One sirve para cuentas business]. En el media kit, la audiencia de TikTok se carga a mano como "declarado".

### 7.6 WhatsApp — restricciones y costos (honesto)
- **Modelo de precios:** desde el 1/7/2025 Meta cobra **por mensaje de template entregado**, según categoría y país del destinatario. Los mensajes no-template (texto libre) solo se pueden mandar **dentro de la ventana de 24 h** desde el último mensaje del usuario. Los **templates utility enviados dentro de esa ventana son gratis** [DATO, Meta](https://developers.facebook.com/docs/whatsapp/pricing/).
- **Cambio desde el 1/10/2026:** según resúmenes de la tarifa de Meta, hay un cupo de **1.000 mensajes de servicio gratis por mes por número** y desde el 1.001 se cobran [DATO de segunda mano, Convertix](https://www.convertixapp.com/whatsapp-api) — verificar en la [página oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).
- **Tarifas de lista vigentes desde 1/10/2026 (USD por mensaje entregado)** [DATO de segunda mano, Convertix y aissist.io citando el tarifario de Meta](https://www.convertixapp.com/whatsapp-api):

| Destino | Utility / autenticación / servicio | Marketing |
|---|---|---|
| Argentina | 0,0260 | 0,0618 |
| México | 0,0085 | 0,0397 |
| Colombia | 0,0008 | 0,0125 |
| Resto de Latam (incluye Uruguay) | 0,0113 | 0,0740 |

- **Costo estimado por usuario activo** [ESTIMACIÓN]: ~6 recordatorios utility/mes fuera de ventana → Argentina ≈ US$0,16/mes, México ≈ US$0,05, Uruguay ≈ US$0,07, Colombia ≈ US$0,005. Bajo, pero Argentina es el país más caro → limitar frecuencia y agrupar en el resumen semanal.
- **No usar templates de marketing** en el MVP (más caros y con más fricción de aprobación).
- **Qué NO se puede:**
  1. Leer o enviar desde el **WhatsApp personal del creator** a las marcas: la Cloud API opera un número de empresa propio. (Existe la modalidad "coexistence" para usar un número de WhatsApp Business App también vía API, pero implicaría que cada creator conecte su número como empresa a nuestra app; complejo y fuera del MVP [SUPUESTO: evaluar en v2].)
  2. Mandar mensajes a un usuario sin **opt-in** ni fuera de ventana sin template aprobado.
  3. Ofrecer un **chatbot de IA de propósito general**: desde el 15/1/2026 los términos de WhatsApp Business prohíben a "AI Providers" ofrecer asistentes generalistas como funcionalidad principal; el uso de IA como función auxiliar de un negocio sigue permitido [DATO, TechCrunch](https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/), [Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers/). → El bot es un **asistente del CRM** con comandos acotados, nunca un chat abierto.
- **Requisitos operativos:** cuenta de Meta Business verificada, número dedicado, nombre visible aprobado, templates aprobados (pueden demorar o ser recategorizados por Meta → el negocio paga según la categoría asignada), método de pago en la cuenta de WhatsApp Business, webhook HTTPS con verificación de firma (`X-Hub-Signature-256`).
- **Plan B si Meta demora:** recordatorios por email + push web (PWA) mientras tanto.

---

## 8. API / endpoints principales

Next.js Route Handlers bajo `/api/v1`. JSON. Auth por sesión Supabase (cookie) en web; header `X-Workspace-Id` obligatorio en rutas de workspace (validado contra membresía). Errores con formato `{ error: { code, message } }`. Paginación por cursor.

### Cuenta y workspace
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | Usuario, workspaces y rol en cada uno |
| PATCH | `/me` | Locale, timezone, país |
| POST | `/me/phone/verify-start` | Envía código (WhatsApp auth template o SMS) |
| POST | `/me/phone/verify-confirm` | Confirma código y crea `whatsapp_consents` |
| DELETE | `/me/whatsapp-consent` | Revoca opt-in |
| GET/POST | `/workspaces` | Listar / crear (tipo `agency`) |
| GET/POST/DELETE | `/workspaces/:id/members` · `/invitations` | Miembros e invitaciones |
| POST | `/me/export` · DELETE `/me` | Exportación y borrado de cuenta |

### Perfiles y redes
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST/PATCH | `/creator-profiles[/:id]` | CRUD de perfiles |
| GET/POST/PATCH/DELETE | `/creator-profiles/:id/services[/:sid]` | Servicios |
| GET | `/social/instagram/connect?profileId=` | Redirige a OAuth de Instagram |
| GET | `/social/instagram/callback` | Intercambia code → token (long-lived), guarda encriptado |
| GET | `/social/tiktok/connect` · `/social/tiktok/callback` | Idem TikTok (con PKCE/state) |
| POST | `/social-accounts/:id/sync` | Encola sync (rate-limit 1/h) |
| DELETE | `/social-accounts/:id` | Desconecta y borra tokens |
| GET | `/public/media-kit/:slug` | Datos públicos del media kit (sin auth, cacheado) |

### CRM
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST/PATCH/DELETE | `/brands[/:id]` | Marcas (búsqueda `?q=`) |
| GET/POST/PATCH/DELETE | `/brands/:id/contacts[/:cid]` | Contactos |
| GET/POST/PATCH | `/pipeline-stages` | Etapas (reorden con `position`) |
| GET | `/deals?stage=&brand=&profile=&from=&to=&paymentStatus=` | Lista/kanban |
| POST/PATCH/DELETE | `/deals[/:id]` | CRUD |
| POST | `/deals/:id/move` | Cambia etapa (registra activity) |
| GET/POST | `/deals/:id/activities` | Historial y notas |
| POST | `/deals/:id/attachments` | URL firmada de subida |
| GET/POST/PATCH/DELETE | `/deals/:id/deliverables[/:did]` | Entregables |
| GET | `/deliverables?dueWithin=7d` | Vista "Esta semana" |
| GET/POST/PATCH | `/deals/:id/payments[/:pid]` | Cobros esperados |
| POST | `/payments/:pid/receipts` | Registrar cobro recibido |
| GET | `/payments/summary` | Pendiente/vencido/cobrado por moneda |
| GET | `/deals/:id/follow-up-message?channel=whatsapp|email` | Texto sugerido + link `wa.me`/`mailto` |

### Recordatorios y webhooks
| Método | Ruta | Descripción |
|---|---|---|
| GET/PATCH | `/reminder-rules` | Configuración |
| GET | `/notifications` | In-app |
| GET | `/webhooks/whatsapp` | Verificación (hub.challenge) |
| POST | `/webhooks/whatsapp` | Mensajes entrantes y estados (verifica firma) |
| POST | `/webhooks/inngest` | Endpoint de jobs |

### Jobs (Inngest)
- `reminders.schedule` (al crear/editar entregable o cobro) · `reminders.dispatch` (cada 15 min) · `payments.mark-overdue` (diario) · `digest.weekly` (lunes 9:00 local) · `social.sync-daily` · `social.refresh-tokens` (IG long-lived tokens antes de vencer) · `account.hard-delete` (diario).

---

## 9. Auth, multi-tenant y seguridad

- **Auth:** Supabase Auth (magic link + Google). Sesiones httpOnly. 2FA: fuera del MVP.
- **Multi-tenant:** modelo *shared database, shared schema* con `workspace_id` en todas las tablas + **RLS** en Postgres: un usuario solo lee/escribe filas de workspaces donde tiene `membership`. Los `viewer` solo SELECT. El backend nunca usa la service key para requests de usuario (solo jobs).
- **Camino a agencias:** ya en el MVP: `workspaces.type = agency`, varios `creator_profiles` por workspace, invitaciones y roles. v1.1: UI de agencia (filtros por creator, reportes, vinculación de la cuenta del creator a su perfil con permiso explícito del creator).
- **Tokens de redes:** encriptados a nivel de aplicación; nunca se devuelven al cliente; rotación de clave documentada.
- **Webhooks:** verificación de firma de Meta; idempotencia por `wa_message_id`.
- **Rate limiting** de API pública (media kit) y de endpoints de auth.
- **Backups:** PITR de Supabase según plan [SUPUESTO: confirmar plan].

---

## 10. Privacidad y marco legal (resumen, **no es asesoramiento legal**)

Tratamos datos personales del creator (contacto, teléfono, métricas) y **de terceros** (contactos de marcas cargados por el creator). Hay que tener política de privacidad, términos, consentimiento y derechos de acceso/rectificación/supresión en los cuatro países.

| País | Norma principal | Puntos a revisar con un abogado |
|---|---|---|
| Uruguay | Ley 18.331 de Protección de Datos Personales (autoridad: URCDP) | Registro de bases de datos ante la URCDP [SUPUESTO: confirmar alcance]; transferencias internacionales (servidores fuera de UY). |
| Argentina | Ley 25.326 de Protección de Datos Personales (autoridad: AAIP) | Inscripción en el Registro Nacional de Bases de Datos [SUPUESTO: confirmar]; transferencias internacionales. |
| México | Nueva **Ley Federal de Protección de Datos Personales en Posesión de los Particulares**, publicada en el DOF el 20/3/2025, vigente desde el 21/3/2025; la supervisión pasó del INAI a la Secretaría Anticorrupción y Buen Gobierno [DATO, Greenberg Traurig](https://www.gtlaw.com/es/insights/2025/3/nueva-ley-general-proteccion-de-datos) | **Aviso de privacidad** obligatorio; datos financieros/patrimoniales requieren **consentimiento expreso** (art. 7) [DATO, texto de la ley](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf) → los montos de acuerdos y cobros podrían caer ahí: pedir consentimiento expreso en el registro. |
| Colombia | Ley 1581 de 2012 (autoridad: SIC) | Política de tratamiento de datos, autorización previa; registro en el RNBD según tamaño de la empresa [SUPUESTO: confirmar umbral]. |

**Medidas de producto que cubren lo común:**
- Consentimiento explícito y versionado (términos, privacidad, WhatsApp).
- Exportación y borrado de cuenta self-service (US-17).
- Minimización: no guardamos el contenido completo de mensajes de WhatsApp más de 90 días [SUPUESTO]; métricas crudas (`raw`) con retención limitada.
- El creator es responsable de los datos de sus contactos de marcas que carga (cláusula en términos) y nosotros actuamos como encargado para esos datos [SUPUESTO: validar con abogado].
- Región de BD: São Paulo (más cercana) [SUPUESTO]; declararlo como transferencia internacional en la política.
- Meta y TikTok exigen además URL de política de privacidad, instrucciones de borrado de datos y cumplimiento de sus términos para aprobar las apps.

---

## 11. i18n y monedas

- **Idioma:** español. Locales `es-AR`, `es-UY` (voseo: "conectá", "tenés"), `es-MX`, `es-CO` (tuteo/usted neutro). [SUPUESTO: MVP con dos variantes de copy: rioplatense y neutro; Fori decide.] Todos los textos en archivos de mensajes (`next-intl`), nada hardcodeado; preparado para `pt-BR` a futuro.
- **Fechas y horas:** guardar en UTC, mostrar en `users.timezone` (default según país; México tiene varias zonas → preguntar en onboarding).
- **Monedas:** `MXN`, `ARS`, `COP`, `UYU`, `USD` (y extensible). Formateo con `Intl.NumberFormat(locale, { style: 'currency', currency })`. COP sin decimales en la UI [SUPUESTO de convención]. Montos en unidades menores (`bigint`).
- **Sin conversión automática** en el MVP: los totales se muestran agrupados por moneda. (v1.1: tipo de cambio de referencia opcional, relevante para ARS.)
- **Teléfonos:** E.164 con `libphonenumber-js`; prefijos +52, +54, +57, +598 por defecto.

---

## 12. Pantallas y flujos

### 12.1 Pantallas
1. **Landing** (pública): propuesta, lista de espera/registro.
2. **Registro / login**.
3. **Onboarding** (3 pasos): país y moneda → conectar Instagram/TikTok (saltable) → activar WhatsApp (saltable).
4. **Inicio / "Hoy"**: entregas de la semana, cobros vencidos, acuerdos sin movimiento hace 14 días.
5. **Pipeline**: kanban (desktop) / lista con selector de etapa (móvil) + botón "Nuevo acuerdo".
6. **Detalle de acuerdo**: datos, entregables, cobros, historial, adjuntos, "Recordarle a la marca".
7. **Entregables / calendario**.
8. **Cobros**: resumen por moneda + lista.
9. **Marcas**: lista y detalle (acuerdos, contactos, días promedio de pago).
10. **Perfil y media kit**: editor con vista previa + link para copiar/compartir.
11. **Media kit público** `/{slug}`.
12. **Ajustes**: cuenta, recordatorios, WhatsApp, redes conectadas, miembros (si agencia), exportar/borrar.

### 12.2 Flujos clave
**A. Primer valor en < 5 minutos**
Registro → país → (opcional) conectar IG → "Cargá tu primer acuerdo" (marca + monto + fecha de publicación) → la app crea entregable y cobro esperado por defecto → propone activar WhatsApp → primer recordatorio programado.

**B. Propuesta que llega por DM**
La marca escribe por DM → creator reenvía el texto al bot de WhatsApp o lo pega en "Nuevo acuerdo" → se crea borrador en `Lead` → creator completa monto y fechas → comparte link del media kit con la marca.

**C. Cobro vencido**
Llega la fecha prometida → job marca `overdue` → WhatsApp utility template "Tenés un cobro vencido de <Marca> por <monto>" con link → creator toca "Recordarle a la marca" → se abre su WhatsApp con el texto → cuando cobra, responde `cobré <marca>` al bot o lo marca en la app.

**D. Agencia (v1.1)**
Owner crea workspace `agency` → crea perfiles de sus creators → invita a su equipo → filtra pipeline y cobros por creator.

---

## 13. Plan de releases e hitos [ESTIMACIÓN]

Equipo supuesto: **2 devs full-stack** + **1 diseñador/a part-time** + Fori como PM. Semanas de calendario.

| Hito | Semanas | Contenido | Criterio de salida |
|---|---|---|---|
| **M0 — Fundaciones** | 1–2 | Repo, CI/CD, Supabase, esquema base + RLS, auth, workspaces, i18n, diseño de sistema. **Arrancar en paralelo:** verificación de negocio en Meta, alta de app IG y TikTok, número de WhatsApp, borradores de términos/privacidad. | Login funcionando en staging; trámites de Meta/TikTok iniciados. |
| **M1 — CRM núcleo** | 3–5 | Marcas y contactos, pipeline, acuerdos, entregables, cobros y resumen por moneda, vista "Hoy", recordatorios por email e in-app. | Un usuario puede gestionar un mes de acuerdos sin planilla. |
| **M2 — Perfil y media kit + redes** | 6–7 | Editor de perfil, servicios, media kit público, OAuth IG y TikTok, sync diario, snapshots. | Media kit con métricas reales de cuentas de prueba (modo desarrollo/testers). |
| **M3 — WhatsApp** | 8–9 | Opt-in, verificación de número, templates utility, webhooks, comandos, resumen semanal, límites de frecuencia. | Recordatorios llegando por WhatsApp a testers. |
| **M4 — Beta cerrada** | 10–12 | Exportar/borrar, analytics (PostHog), pulido móvil, onboarding, correcciones; **app reviews de Meta/TikTok aprobadas** (bloqueante para abrir a usuarios externos con IG/TikTok). 20–50 creators de MX/AR/CO/UY. | Métricas del §1.3 midiéndose. |
| **v1.1 — Agencias** | 13–16 | UI de agencia, filtros por creator, reportes simples, vinculación creator↔perfil, exclusividades, iCal. | 3 agencias en piloto. |
| **v1.2+** | — | Tarifas de referencia, contratos, YouTube, cobro de suscripción (Mercado Pago), y recién después evaluar facturación. | |

**Riesgo de plazo principal:** la aprobación de Meta (verificación de negocio, Advanced Access de Instagram, templates de WhatsApp) y de TikTok no depende del equipo. Si se demora, la beta sale con métricas cargadas a mano y recordatorios por email.

---

## 14. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Meta/TikTok rechazan o demoran las app reviews | Sin métricas verificadas ni WhatsApp | Iniciar trámites en semana 1; modo "métricas declaradas"; email/push como respaldo. |
| Cuentas personales de IG no se pueden conectar | Fricción en onboarding | Guía paso a paso para pasar a cuenta creator; permitir carga manual. |
| Baja disposición a pagar de microinfluencers (más de la mitad cobra menos de R$500 por entrega en Brasil [DATO, Creator POV 2025](https://blog.weecom.com.br/principais-tendencias-e-dados-do-relatorio-creator-pov-2025/)) | Negocio no viable solo con creators | Validar precio en beta; agencias como cliente pagador. |
| Churn: el creator con pocos deals vuelve a notas/planilla | Retención baja | WhatsApp + resumen semanal; captura de deals en segundos. |
| Costos de WhatsApp en Argentina (tarifa utility más alta de los 4 países) | Margen | Tope de mensajes, agrupar en resumen, priorizar mensajes dentro de ventana. |
| Recategorización de templates por Meta (utility → marketing) | Costo mayor | Redactar templates estrictamente transaccionales; monitorear `pricing.category` en webhooks. |
| Cambios de políticas (IA en WhatsApp, deprecación de métricas IG) | Funciones rotas | Bot sin IA generalista; capa de integración aislada; revisar changelogs. |
| Competencia gratis (Notion, Beacons, Passionfroot) y Veeras si entra a hispano | Diferenciación | Foco en cobros + WhatsApp + español local; velocidad. |
| Cumplimiento legal en 4 países | Multas/reputación | Revisión legal antes de la beta abierta; consentimiento y borrado desde M0. |
| Datos de terceros (contactos de marcas) | Responsabilidad | Términos claros; no usar esos datos para nada fuera del workspace. |

---

## 15. Preguntas abiertas para Fori

1. **Nombre y dominio** del producto (necesario para Meta Business, apps de IG/TikTok y número de WhatsApp).
2. **Entidad legal**: ¿desde qué país/empresa se opera (UY?)? Afecta verificación de Meta, términos, registro de bases y cómo se cobra después.
3. **País de arranque de la beta**: ¿Argentina/Uruguay (más cerca, voseo, WhatsApp más caro) o México (mercado más grande, más TikTok)?
4. **Tono**: ¿copy con voseo para AR/UY y neutro para MX/CO, o neutro para todos al principio?
5. **Beta gratis o con preventa**: ¿se cobra algo durante la beta? Si sí, hay que adelantar Mercado Pago Suscripciones (y resolver Colombia).
6. **Rango de "micro"**: ¿10k–100k seguidores, o incluimos nano (1k–10k)?
7. **Agencias**: ¿hay 2–3 agencias concretas para piloto? Si sí, conviene adelantar parte de v1.1.
8. **Equipo**: ¿2 devs full-stack es realista, o es 1 dev + agente de código? (cambia el plazo; con 1 dev, duplicar aprox. [ESTIMACIÓN]).
9. **IA**: ¿querés extracción automática de datos de mensajes reenviados en el MVP (P1) o lo dejamos para después?
10. **Presupuesto mensual de infraestructura y WhatsApp** aceptable para la beta.

---

## 16. Fuentes
- Meta — Fin de Instagram Basic Display API: https://developers.facebook.com/blog/post/2024/09/04/update-on-instagram-basic-display-api/
- Meta — Insights con Instagram Login: https://developers.facebook.com/blog/post/2025/03/24/user-and-media-insights-on-instagram-api-with-instagram-login/
- Meta — Instagram account insights (límites): https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
- Meta — Rate limits: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
- Meta — Precios WhatsApp Business Platform: https://developers.facebook.com/docs/whatsapp/pricing/ y https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Meta — Política para AI Providers en WhatsApp: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers/
- TechCrunch — Prohibición de chatbots generalistas en WhatsApp: https://techcrunch.com/2025/10/18/whatssapp-changes-its-terms-to-bar-general-purpose-chatbots-from-its-platform/
- Convertix — Tarifas WhatsApp Latam oct/2026: https://www.convertixapp.com/whatsapp-api
- aissist.io — Tarifas WhatsApp 2026: https://aissist.io/insights/whatsapp-business-api-pricing
- TikTok — Scopes: https://developers.tiktok.com/docs/en/tiktok-api-scopes
- TikTok — Rate limits: https://developers.tiktok.com/docs/en/tiktok-api-v2-rate-limit
- TikTok — App review FAQ: https://developers.tiktok.com/docs/en/getting-started-faq
- Mercado Pago — Suscripciones: https://www.mercadopago.com.uy/developers/es/docs/subscriptions/overview
- México — LFPDPPP (texto vigente): https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
- Greenberg Traurig — Nueva LFPDPPP: https://www.gtlaw.com/es/insights/2025/3/nueva-ley-general-proteccion-de-datos
- HypeAuditor — Creadores activos Latam 2026: https://blog.hypeauditor.com/es/donde-estan-los-creadores-mas-activos-de-america-latina/
- HypeAuditor — Mercado latino (WhatsApp, profesionalización): https://blog.hypeauditor.com/how-foreign-brands-can-enter-latin-america-through-influencer-marketing/
- Veeras — Estado del influencer marketing en Brasil 2026: https://veeras.com.br/pesquisa/estado-influencer-marketing-brasil-2026
- Weecom — Creator POV 2025 (BrandLovers): https://blog.weecom.com.br/principais-tendencias-e-dados-do-relatorio-creator-pov-2025/
