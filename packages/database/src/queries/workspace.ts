import { prisma } from "../client.js";

export function getWorkspaceForUser(workspaceSlug: string, userId: string) {
  return prisma.workspace.findFirst({
    where: { slug: workspaceSlug, memberships: { some: { userId } } },
    include: { memberships: { where: { userId }, select: { role: true } } }
  });
}
