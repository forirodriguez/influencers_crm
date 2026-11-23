# CRM

Dueño: marcas, contactos, etapas, acuerdos, entregables, cobros, actividades y adjuntos.

Podés editar `src/modules/crm/**` y estas rutas:

- `src/app/(app)/pipeline`
- `src/app/(app)/acuerdos`
- `src/app/(app)/entregables`
- `src/app/(app)/cobros`
- `src/app/(app)/marcas`
- `src/app/(app)/hoy` (tablero de lectura; se puede reemplazar)
- `src/app/api/v1/brands`
- `src/app/api/v1/deals`
- `src/app/api/v1/deliverables`
- `src/app/api/v1/payments`

No importes `@/db/admin`. Usá `withUser` y filtrá por `workspaceId`: RLS deja ver todos los workspaces del usuario, no uno solo.

Las escrituras viven en `service.ts`. Hoy, Entregables y el bot comparten la ventana de `agenda.ts` (hoy inclusive hasta seis días después, ancla publicación → aprobación → borrador).
