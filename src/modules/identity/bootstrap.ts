import { creatorProfiles, type MediaKitSettings, defaultMediaKitSettings } from "../media-kit/schema";
import { pipelineStages } from "../crm/schema";
import { reminderRules } from "../reminders/schema";
import { memberships, workspaces } from "./schema";
import type { Db } from "../../db/types";

export const DEFAULT_STAGES = [
  { name: "Lead", position: 0, kind: "open" },
  { name: "Negociando", position: 1, kind: "open" },
  { name: "Confirmado", position: 2, kind: "won" },
  { name: "En producción", position: 3, kind: "won" },
  { name: "Publicado", position: 4, kind: "done" },
  { name: "Cobrado", position: 5, kind: "done" },
  { name: "Perdido", position: 6, kind: "lost" },
] as const;

export const DEFAULT_REMINDER_RULES = [
  { entity: "deliverable", offsetMinutes: -2880, channel: "whatsapp" },
  { entity: "deliverable", offsetMinutes: 0, channel: "whatsapp" },
  { entity: "payment", offsetMinutes: 0, channel: "whatsapp" },
  { entity: "payment", offsetMinutes: 10080, channel: "whatsapp" },
] as const;

export async function createWorkspaceWithOwner(
  db: Db,
  input: {
    ownerId: string;
    name: string;
    type: "personal" | "agency";
    country: string | null;
    currency: string;
    profile?: {
      displayName: string;
      slug: string;
      country: string | null;
      city?: string | null;
      niches?: string[];
      languages?: string[];
      bio?: string | null;
      publicEmail?: string | null;
      linkUser?: boolean;
      settings?: MediaKitSettings;
    };
  },
): Promise<{ workspaceId: string; profileId: string | null }> {
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: input.name,
      type: input.type,
      country: input.country,
      defaultCurrency: input.currency,
      plan: "beta",
    })
    .returning({ id: workspaces.id });
  if (!workspace) throw new Error("No se pudo crear el workspace");

  await db.insert(memberships).values({
    workspaceId: workspace.id,
    userId: input.ownerId,
    role: "owner",
    acceptedAt: new Date(),
  });

  await db.insert(pipelineStages).values(
    DEFAULT_STAGES.map((stage) => ({
      workspaceId: workspace.id,
      name: stage.name,
      position: stage.position,
      kind: stage.kind,
    })),
  );

  await db.insert(reminderRules).values(
    DEFAULT_REMINDER_RULES.map((rule) => ({
      workspaceId: workspace.id,
      entity: rule.entity,
      offsetMinutes: rule.offsetMinutes,
      channel: rule.channel,
      enabled: true,
    })),
  );

  if (!input.profile) return { workspaceId: workspace.id, profileId: null };

  const [profile] = await db
    .insert(creatorProfiles)
    .values({
      workspaceId: workspace.id,
      userId: input.profile.linkUser === false ? null : input.ownerId,
      displayName: input.profile.displayName,
      slug: input.profile.slug,
      country: input.profile.country,
      city: input.profile.city ?? null,
      niches: input.profile.niches ?? [],
      languages: input.profile.languages ?? ["es"],
      bio: input.profile.bio ?? null,
      publicEmail: input.profile.publicEmail ?? null,
      mediaKitSettings: input.profile.settings ?? defaultMediaKitSettings,
    })
    .returning({ id: creatorProfiles.id });

  return { workspaceId: workspace.id, profileId: profile?.id ?? null };
}
