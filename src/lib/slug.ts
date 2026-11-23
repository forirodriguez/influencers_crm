export const RESERVED_SLUGS = new Set([
  "hoy",
  "pipeline",
  "entregables",
  "cobros",
  "marcas",
  "media-kit",
  "ajustes",
  "login",
  "registro",
  "onboarding",
  "api",
  "legales",
  "auth",
  "acuerdos",
  "icon",
  "manifest",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "creator";
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
