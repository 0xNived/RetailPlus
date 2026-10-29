# RetailPlus database

The core database uses PostgreSQL and Prisma. PostgreSQL is the system of record for identities, workspaces, imports, datasets, quality findings, cleaning/transformation history, dashboards, exports, and audit events. Flexible import and extraction payloads live in JSONB columns.

## Prerequisites

- Node.js 24+ (the workspace was checked with Node 24.16.0)
- PostgreSQL 15+

## Local setup

1. Copy the root `.env.example` to `.env` and set `DATABASE_URL`.
2. Install dependencies from the repository root: `npm install`.
3. Apply the initial migration: `npm run db:migrate`.
4. Set a local `ADMIN_PASSWORD` in `.env`, then run `npm run db:seed`.

The seed creates `admin@retailplus.local` and an `ADMIN` membership in the `retailplus` workspace. It refuses to run without `ADMIN_PASSWORD` and never contains a committed password.

## Query modules

Use the scoped query helpers under `src/queries/` for application reads. Every workspace-facing query must include `workspaceId` (or membership validation) so one tenant cannot read another tenant's data.

## Migration workflow

1. Update `prisma/schema.prisma`.
2. Create and review a named migration: `npm run db:migrate -- --name meaningful_change`.
3. Commit the generated migration under `prisma/migrations/`.
4. Apply reviewed migrations in deployment with `npm run db:deploy`.

Prisma ORM 7 is deliberately used here because its SQL migration workflow is stable; Prisma ORM 8 was still documented as a release candidate when this scaffold was created.
