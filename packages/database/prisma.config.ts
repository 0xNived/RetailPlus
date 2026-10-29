import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: new URL("../../.env", import.meta.url) });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    // Allows `prisma generate` before a developer has created a local .env file.
    // Commands that connect to PostgreSQL still need the real DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgresql://retailplus:change-me@localhost:5432/retailplus?schema=public",
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL
  }
});
