# Media kit y métricas

Dueño: perfiles de creator, servicios, cuentas sociales, snapshots, posts y la página pública.

Podés editar `src/modules/media-kit/**`, `src/app/(app)/media-kit`, `src/app/[slug]` y `src/app/api/v1/creator-profiles`. Los OAuth de Instagram y TikTok todavía no tienen ruta: agregala bajo `src/app/api/v1/social/**` sin tocar las rutas de CRM.

Los adaptadores mock están en `src/integrations/instagram` y `src/integrations/tiktok`. Las constantes de endpoints están al lado de la interfaz. No implementes llamadas live incorrectas: reemplazá `LiveInstagramAdapter` / `LiveTikTokAdapter`.

`app.get_public_media_kit(slug)` es la única lectura pública. No uses el rol admin para armar esa página y no devuelvas tokens.
