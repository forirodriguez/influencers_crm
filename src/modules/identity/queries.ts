import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/types";
import { invitations, memberships, users, workspaces } from "./schema";

export async function listMemberships(db: Db, userId: string) {
  return db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceType: workspaces.type,
      currency: workspaces.defaultCurrency,
      country: workspaces.country,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, userId), isNull(memberships.deletedAt), isNull(workspaces.deletedAt)));
}

export async function listMembers(db: Db, workspaceId: string) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      acceptedAt: memberships.acceptedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), isNull(memberships.deletedAt)));
}

export async function listInvitations(db: Db, workspaceId: string) {
  return db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      acceptedAt: invitations.acceptedAt,
    })
    .from(invitations)
    .where(and(eq(invitations.workspaceId, workspaceId), isNull(invitations.deletedAt)));
}
