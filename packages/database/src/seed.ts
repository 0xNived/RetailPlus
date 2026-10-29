import bcrypt from "bcryptjs";
import { prisma } from "./client.js";

const adminEmail = process.env.ADMIN_EMAIL ?? "admin@retailplus.local";
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  throw new Error("Set ADMIN_PASSWORD before running the seed script. No password is stored in this repository.");
}

const passwordHash = await bcrypt.hash(adminPassword, 12);

const admin = await prisma.user.upsert({
  where: { email: adminEmail },
  update: { passwordHash, displayName: "RetailPlus Admin", isActive: true },
  create: { email: adminEmail, passwordHash, displayName: "RetailPlus Admin" }
});

const workspace = await prisma.workspace.upsert({
  where: { slug: "retailplus" },
  update: {},
  create: { name: "RetailPlus", slug: "retailplus" }
});

await prisma.membership.upsert({
  where: { workspaceId_userId: { workspaceId: workspace.id, userId: admin.id } },
  update: { role: "ADMIN" },
  create: { workspaceId: workspace.id, userId: admin.id, role: "ADMIN" }
});

console.log(`Admin ready: ${adminEmail}`);
await prisma.$disconnect();
