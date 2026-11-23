export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class IntegrationNotConfigured extends Error {
  constructor(public integration: string, message?: string) {
    super(message ?? `${integration} no está configurado. INTEGRATIONS_MODE=mock evita llamadas reales.`);
    this.name = "IntegrationNotConfigured";
  }
}

export function isUniqueViolation(error: unknown): boolean {
  const candidates = [error, error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined];
  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const code = (candidate as { code?: unknown }).code;
    return code === "23505";
  });
}
