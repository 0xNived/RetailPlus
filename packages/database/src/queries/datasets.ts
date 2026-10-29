import { prisma } from "../client.js";

export function listDatasets(workspaceId: string) {
  return prisma.dataset.findMany({
    where: { workspaceId },
    include: { profile: true, _count: { select: { qualityIssues: true } } },
    orderBy: { updatedAt: "desc" }
  });
}

export function getDatasetForReview(workspaceId: string, datasetId: string) {
  return prisma.dataset.findFirst({
    where: { id: datasetId, workspaceId },
    include: {
      profile: true,
      qualityIssues: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" } },
      cleaningRuns: { orderBy: { createdAt: "desc" }, take: 10 },
      transformations: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });
}
