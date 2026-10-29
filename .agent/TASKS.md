# RetailPlus — Task Backlog

Last updated: 2026-10-29

## Working agreement

- Keep this backlog current as work is started, completed, deferred, or reprioritized.
- Update `.agent/PROGRESS.md` alongside any material status change.
- A format is accepted only after validation, safe size limits, clear errors, and automated tests are implemented.

## P0 — Essential input formats

- [x] CSV (`.csv`) — basic authenticated cleanup and export for customer records, products, and company datasets.
- [ ] Excel (`.xlsx`, `.xls`) — business spreadsheets.
- [ ] PDF (`.pdf`) — invoices, reports, and company documents.
- [ ] Word (`.docx`) — reports, descriptions, and business records.
- [ ] PNG images (`.png`) — image-based source material.
- [ ] JPEG images (`.jpg`, `.jpeg`) — image-based source material.

## P1 — Recommended input formats

- [ ] JSON Lines (`.jsonl`, `.ndjson`) — large datasets and AI pipelines.
- [ ] JSON (`.json`) — API and nested company data.
- [ ] Plain text (`.txt`) — unstructured lists and raw text.
- [ ] Paste input — directly submitted messy text.
- [ ] XML (`.xml`) — enterprise-system exports.
- [ ] HTML (`.html`) — website exports and scraped content.

## P2 — Later input sources

- [ ] Parquet (`.parquet`) — large analytical datasets.
- [ ] SQL (`.sql`) — database exports.
- [ ] Direct database imports — PostgreSQL, MySQL, and SQLite.

## Platform tasks

- [x] Add post-login workspace chooser, required first-workspace dialog, and workspace switching.
- [x] Add Dataset pipeline checkpoint UI for current and planned stages.
- [x] List saved datasets, create one by dropping or attaching CSV, and reopen its rows and processing results.
- [x] Show upload progress, collapse finished processing details, and edit saved dataset cells and rows in a spreadsheet-style grid.
- [x] Scroll through dataset rows continuously and add selected-cell value and formatting controls.
- [x] Group left navigation into Home, Data, Analyze, and AI and keep all sheet formatting tools visible at narrow widths.
- [x] Improve CSV ingestion for common Windows encodings and separators.
- [ ] Persist checkpoint status per dataset so long-running jobs can resume after navigation.
- [x] Add basic Phase 1 understanding: likely dataset purpose, field types, and missing-field suggestions.
- [x] Record automatic CSV value changes with original values, actions, and downloadable provenance.
- [ ] Add approval decisions and persist every version of the source and organized data.
- [ ] Build Phase 2 dataset-specific category and field suggestions with an approval workflow.
- [ ] Build Phase 3 validation gates and dataset-driven analytics.
- [ ] Build Phase 4 prediction eligibility, training, and evaluation gates.
- [ ] Build Phase 5 saved projects, reusable company rules, and provenance exports.
- [x] Persist CSV import jobs, source files, and dataset profiles; update dashboard activity.
- [ ] Persist versioned organized output and reviewer decisions for each saved dataset.
- [ ] Add reviewed cross-dataset field matching with Valentine.
- [ ] Add evaluated category discovery and approved LLM naming.
- [x] Implement the frontend foundation: landing page, login page, and admin dashboard shell.
- [ ] Build the initial source-file import experience for CSV, Excel, PDF, DOCX, PNG, and JPEG.
- [x] Define the PostgreSQL + Prisma schema, initial migration, seed scaffold, and scoped query modules in `packages/database/`.
- [x] Provision local PostgreSQL, apply migrations, and seed the local admin user.
- [x] Establish the first FastAPI contracts for health, login, and dashboard data.
- [ ] Build the ingestion service and upload lifecycle.
- [ ] Build the cleaning and normalization service.
- [ ] Build analytics and reporting services.
- [ ] Build the ML training and inference workflow.
- [ ] Build enterprise admin and customer dashboards.
- [ ] Add authentication, authorization, audit logs, observability, and automated tests.
