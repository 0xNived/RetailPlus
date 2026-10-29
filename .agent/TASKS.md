# RetailPlus — Task Backlog

Latest prediction/data-management delivery (2026-10-29):

- [x] Business-facing Predictions with Product planning, Customer retention and Model evaluation.
- [x] Search all products/SKUs and drill into demand, revenue, ABC priority, momentum, order quality and monthly history.
- [x] Same-horizon rolling MAE/WAPE/bias checks; baseline choice needs >=3 checks; honest history/coverage limits.
- [x] User-input replenishment calculator; no invented stock, margin or accuracy figures.
- [x] Confirmed dataset deletion from list/sheet, scoped DB cascade and UUID file cleanup, rollback staging/recovery manifest and running-job protection.
- [x] Clear deleted selections and refresh dataset lists; preserve other user data.
- [x] Verify 42 tests, targeted final checks, production build, desktop/mobile planning and disposable-fixture deletion. No commit/push.


Last updated: 2026-10-29

## Working agreement

- Keep this backlog current as work is started, completed, deferred, or reprioritized.
- Update `.agent/PROGRESS.md` alongside any material status change.
- A format is accepted only after validation, safe size limits, clear errors, and automated tests are implemented.

## RetailPulse requirements intake (2026-10-29)

- [x] Review handoff against current code and record requested retail analytics, processing, ML, insights, simulation, customers, learning/viva, and system capabilities in [RETAILPULSE_SCOPE.md](RETAILPULSE_SCOPE.md).
- [x] Reconcile delivery priorities: attached college-submission task takes priority; keep existing UI and generic CSV editor, add retail mapping/features, use PostgreSQL JSONB instead of MongoDB/fallback. Educational concepts stay labeled honestly.

## RetailPulse delivery (2026-10-29)

Latest UI direction supersedes the earlier navigation requirement: **no More group**. Analytics and Customers are the priority; use the supplied quality-card/chart reference with RetailPlus branding and genuine data.

Latest customer/data refinement (2026-10-29):

- [x] Replace washed-out customer/menu surfaces with readable neutral text, stronger hierarchy and dark sidebar-aligned switcher.
- [x] Local deterministic profile illustrations with initials fallback, lazy loading and license notes.
- [x] Reusable Indian retail CSV generator: fictional names, explicit Male/Female, current IST orders, realistic long titles/SKUs, locations, INR and stable profiles.
- [x] Import and train fresh 50K dataset while retaining existing data; implement gender filtering and currency display.
- [x] Validate 32 tests + targeted profile check, production build, desktop/mobile UI, avatar loading, gender filter and drawer scroll restoration.

Latest refinement:

- [x] Replace repeated Customers breadcrumb/title with a single Customer health heading and direct model-based return-risk counts/outlook labels.
- [x] Add searchable next-month product demand baseline with recent monthly units, direction and clear sufficiency/model limitations.
- [x] Add different product/category icons and a generated transparent cart-plus RetailPlus mark; record prompt and provenance.
- [x] Redesign landing page to match dashboard quality with an honest, fixture-calculated interactive sample tour.
- [x] Replace sidebar workspace navigation-away action with in-place switch/create dropdown, preserving scoped access and clearing prior dataset state on switch.
- [x] Verify 28 tests, production build, dropdown switch round-trip, labeled landing tour and 390px landing layout. No commit/push.

- [x] Remove More sidebar navigation.
- [x] Rebuild Analytics with reusable coordinated chart cards, interactive tooltips, click-to-filter categories/locations, and compact filter/report controls.
- [x] Rebuild Customers with overview metrics, sortable/filterable directory, segment summaries and a focus-managed profile drawer with purchase history.
- [x] Add and test real first/repeat-order aggregates, customer overview totals and safe server sorting.
- [x] Finish desktop/mobile visual and interaction QA for the redesigned views; fix overflow, contrast, hierarchy and empty-filter chart state. 24 tests and frontend build pass.

- [x] Inspect/reuse the React + FastAPI + PostgreSQL app; preserve Home/workspace/sheet/preferences.
- [x] Seeded 10K/50K/100K generator, retail cleaning, missing-value strategies, invalid-row retention and before/after quality.
- [x] Immutable raw/clean/Parquet files, version catalogs, changes and saved mapping with type detection.
- [x] Real background pipeline stage states, timings, errors and navigation recovery; restart interruption is failed/retry, not automatic durable resumption.
- [x] Filtered Analytics dashboard, insight rules, simulated inventory/restock scenarios, CSV/PDF reports.
- [x] Leakage-bounded churn features/labels, measured logistic regression and forest metrics, confusion matrices, feature importance, current risk probabilities and RFM clusters.
- [x] PostgreSQL JSONB customer search/profiles/history/combined filters, segment view and high-risk export.
- [x] Architecture, syllabus mapping, technology Status and actual PySpark DataFrame/RDD/SQL demo; all three outputs verified equal.
- [x] Labeled simulated stream with start/stop, adjustable rate, charts, counters and feed.
- [x] Monthly moving-average baseline, tests, README/setup/architecture/limitations, VIVA_NOTES.md and local browser screenshots.
- [ ] Optional Assistant tool planner/reviewed operations (explicitly planned in UI).
- [ ] Optional dark mode and 500K-row support (not claimed).

The earlier broad platform roadmap below is historical/partial; completed retail delivery does not imply production-ready ingestion, reviewer workflows, or all future formats.

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
- [x] Persist retail job checkpoint status so running jobs can be observed after navigation. Interrupted API jobs require retry.
- [x] Add basic Phase 1 understanding: likely dataset purpose, field types, and missing-field suggestions.
- [x] Record automatic CSV value changes with original values, actions, and downloadable provenance.
- [ ] Add approval decisions and persist every version of the source and organized data.
- [ ] Build Phase 2 dataset-specific category and field suggestions with an approval workflow.
- [ ] Build Phase 3 validation gates and dataset-driven analytics.
- [ ] Build Phase 4 prediction eligibility, training, and evaluation gates.
- [ ] Build Phase 5 saved projects, reusable company rules, and provenance exports.
- [x] Persist CSV import jobs, source files, and dataset profiles; update dashboard activity.
- [x] Persist immutable organized CSV/Parquet versions and edit provenance for saved datasets.
- [ ] Persist reviewer accept/reject decisions (separate from automatic/edit provenance).
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
