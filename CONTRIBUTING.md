# Contribuir

La fundación ya está en `main` de este branch. Los módulos se pueden construir en paralelo si cada uno se queda en su carpeta. Leé `docs/ARCHITECTURE.md` y el `MODULE.md` del módulo antes de editar.

## Entorno

Hace falta Node 22 y Postgres 16.

```bash
cp .env.example .env
npm install
npm run db:up          # Docker. Si no hay Docker, ver README.
npm run db:migrate
npm run db:seed
npm run dev
```

Entrá con `cami@demo.influencerscrm.test` / `demo1234`.

`npm test` crea la base `influencers_crm_test` y la vacía. No uses esa URL para el seed. `npm run db:seed` vacía la base de `DATABASE_URL` y carga el demo.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI corre lo mismo (`.github/workflows/ci.yml`) contra un Postgres de servicio. No hace falta ninguna clave real.

## Convenciones

- TypeScript estricto. Montos en `bigint` de unidades menores. Fechas de calendario como `YYYY-MM-DD` (no las pases por `new Date("2026-01-01")` para mostrarlas: en ART quedan en el día anterior).
- Textos de UI en los JSON de `src/i18n`, voseo en `es-AR`. El overlay `es-MX` solo lleva las claves que cambian.
- Errores de API: `{ error: { code, message } }`, mensaje en rioplatense.
- No edites migraciones ya aplicadas. Sumá `drizzle/0002_*.sql`.
- No commitees `.env`.
