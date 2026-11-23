import type { MediaKitSettings } from "./schema";

export type PublicPost = {
  url: string | null;
  type: string | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  metrics: Record<string, number>;
};

export type PublicAccount = {
  platform: string;
  handle: string;
  connection: string;
  followers: number | null;
  following: number | null;
  mediaCount: number | null;
  likesTotal: string | null;
  reach30d: string | null;
  views30d: string | null;
  interactions30d: string | null;
  demographics: unknown;
  capturedAt: string | null;
  posts: PublicPost[];
};

export type PublicService = {
  name: string;
  platform: string | null;
  priceMinor: string | null;
  currency: string | null;
  isFromPrice: boolean;
};

export type PublicMediaKit = {
  slug: string;
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
  country: string | null;
  city: string | null;
  niches: string[];
  languages: string[];
  publicEmail: string | null;
  publicWhatsapp: string | null;
  settings: MediaKitSettings;
  services: PublicService[];
  accounts: PublicAccount[];
};

export type EditorService = PublicService & { id: string; visible: boolean };

export type EditorAccount = {
  id: string;
  platform: string;
  handle: string;
  connection: "api" | "manual";
  status: string;
  lastSyncedAt: string | null;
  followers: number | null;
  following: number | null;
  mediaCount: number | null;
  likesTotal: string | null;
  reach30d: string | null;
  views30d: string | null;
  interactions30d: string | null;
  demographics: unknown;
  demographicsHidden: boolean;
};

export type EditorProfile = {
  id: string;
  displayName: string;
  slug: string;
  bio: string | null;
  photoUrl: string | null;
  country: string | null;
  city: string | null;
  niches: string[];
  languages: string[];
  publicEmail: string | null;
  publicWhatsapp: string | null;
  settings: MediaKitSettings;
  services: EditorService[];
  accounts: EditorAccount[];
};
