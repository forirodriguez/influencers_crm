/**
 * Stub de Sentry. Si SENTRY_DSN está definido, el error se loguea con esa marca.
 * El módulo que conecte el SDK puede reemplazar este archivo por @sentry/nextjs
 * sin cambiar los call sites: captureException(error).
 */
export async function captureException(error: unknown): Promise<void> {
  if (process.env.SENTRY_DSN) {
    console.error("[sentry]", error);
    return;
  }
  console.error(error);
}
