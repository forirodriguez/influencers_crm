# Identity

Dueño: auth, usuarios, workspaces, membresías, invitaciones, aceptaciones legales.

Podés editar `src/modules/identity/**`, `src/app/(public)/login`, `src/app/(public)/registro`, `src/app/onboarding`, `src/app/api/v1/auth/**`, `src/app/api/v1/me/**` y `src/app/api/v1/workspaces/**`.

El alta de un workspace personal (etapas, reglas de recordatorio y perfil) vive en `bootstrap.ts`. Si agregás una columna obligatoria a esas tablas, actualizá ese insert.

`privacy.ts` exporta la cuenta (JSON y CSV) y hace el borrado: baja lógica al instante y borrado físico a los 30 días, con tokens de redes y número de WhatsApp. El job `account.hard-delete` llama a `hardDeleteExpiredAccounts`.

Este módulo es el único que puede usar `withAdmin` para credenciales y para crear el primer workspace. El resto de las lecturas de una request van por `withUser`.
