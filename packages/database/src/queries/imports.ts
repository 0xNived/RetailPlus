import { prisma } from "../client.js";

export function listRecentImports(workspaceId: string) {
  return prisma.importJob.findMany({
    where: { workspaceId },
    include: { sourceFiles: true, _count: { select: { datasets: true } } },
    orderBy: { createdAt: "desc" },
    take: 25
  });
}

export function getImportDetail(workspaceId: string, importJobId: string) {
  return prisma.importJob.findFirst({
    where: { id: importJobId, workspaceId },
    include: { sourceFiles: true, datasets: { include: { profile: true } } }
  });
}
