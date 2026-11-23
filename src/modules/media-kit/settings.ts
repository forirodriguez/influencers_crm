import type { AudienceSlice, DeclaredAudience, FeaturedCollaboration, MediaKitBlocks, MediaKitSettings } from "./schema";
import { defaultMediaKitSettings } from "./schema";

export const NICHE_OPTIONS = [
  { id: "belleza", key: "belleza" },
  { id: "moda", key: "moda" },
  { id: "lifestyle", key: "lifestyle" },
  { id: "fitness", key: "fitness" },
  { id: "comida", key: "comida" },
  { id: "viajes", key: "viajes" },
  { id: "tecnología", key: "tecnologia" },
  { id: "gaming", key: "gaming" },
  { id: "maternidad", key: "maternidad" },
  { id: "finanzas", key: "finanzas" },
  { id: "humor", key: "humor" },
  { id: "música", key: "musica" },
  { id: "educación", key: "educacion" },
  { id: "hogar", key: "hogar" },
  { id: "mascotas", key: "mascotas" },
  { id: "café", key: "cafe" },
  { id: "dirección creativa", key: "direccionCreativa" },
] as const;

export const ACCENT_PRESETS = ["#b8432f", "#2c6b4a", "#241c18", "#1d4e89", "#c4a35a"] as const;

const BLOCK_KEYS: Array<keyof MediaKitBlocks> = [
  "photo",
  "bio",
  "niches",
  "metrics",
  "audience",
  "services",
  "featured",
  "posts",
  "contact",
];

export function normalizeSettings(value: unknown): MediaKitSettings {
  const source = value && typeof value === "object" ? (value as Partial<MediaKitSettings>) : {};
  const rawBlocks = source.blocks && typeof source.blocks === "object" ? (source.blocks as Partial<MediaKitBlocks>) : {};
  const blocks = { ...defaultMediaKitSettings.blocks };
  for (const key of BLOCK_KEYS) {
    if (typeof rawBlocks[key] === "boolean") blocks[key] = rawBlocks[key];
  }
  return {
    blocks,
    accent: isHexColor(source.accent) ? source.accent : defaultMediaKitSettings.accent,
    indexable: source.indexable === true,
    showPrices: source.showPrices === true,
    featured: Array.isArray(source.featured) ? source.featured.map(readFeatured).filter((item) => item.brand.length > 0).slice(0, 8) : [],
    declaredAudience: readAudience(source.declaredAudience),
  };
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function httpUrlOrEmpty(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid_url");
  return url.toString();
}

function readFeatured(value: unknown): FeaturedCollaboration {
  const record = value && typeof value === "object" ? (value as Partial<FeaturedCollaboration>) : {};
  return {
    id: typeof record.id === "string" && record.id ? record.id.slice(0, 80) : crypto.randomUUID(),
    brand: typeof record.brand === "string" ? record.brand.trim().slice(0, 80) : "",
    logoUrl: typeof record.logoUrl === "string" ? record.logoUrl.trim().slice(0, 500) : "",
    detail: typeof record.detail === "string" ? record.detail.trim().slice(0, 160) : "",
  };
}

function readAudience(value: unknown): DeclaredAudience | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<DeclaredAudience>;
  const audience: DeclaredAudience = {
    summary: typeof record.summary === "string" ? record.summary.trim().slice(0, 280) : "",
    countries: readSlices(record.countries),
    ages: readSlices(record.ages),
    genders: readSlices(record.genders),
  };
  if (!audience.summary && audience.countries.length + audience.ages.length + audience.genders.length === 0) return null;
  return audience;
}

function readSlices(value: unknown): AudienceSlice[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as { label?: unknown; share?: unknown };
      const label = typeof record.label === "string" ? record.label.trim().slice(0, 40) : "";
      const share = typeof record.share === "number" && Number.isFinite(record.share) ? record.share : null;
      if (!label || share === null || share < 0 || share > 1) return null;
      return { label, share };
    })
    .filter((item): item is AudienceSlice => item !== null)
    .slice(0, 6);
}

export function demographicGroups(source: unknown, keys: string[]): AudienceSlice[] {
  if (!source || typeof source !== "object") return [];
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    const slices = value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { label?: unknown; name?: unknown; code?: unknown; share?: unknown };
        const label = [row.label, row.name, row.code].find((entry) => typeof entry === "string" && entry.length > 0);
        if (typeof label !== "string" || typeof row.share !== "number" || !Number.isFinite(row.share)) return null;
        const share = row.share > 1 ? row.share / 100 : row.share;
        if (share < 0) return null;
        return { label, share };
      })
      .filter((item): item is AudienceSlice => item !== null)
      .slice(0, 8);
    if (slices.length > 0) return slices;
  }
  return [];
}
