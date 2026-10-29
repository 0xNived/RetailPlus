# RetailPlus — Progress

Environment setup in progress (2026-10-29): created root `.venv` with CPython 3.11.15, added `.venv/` to Git ignore and root `requirements.txt` including the service manifest. README uses virtual-environment activation and root install. Core dependency installation/verification in progress; optional Spark remains separate. No commit/push.


Latest delivery (2026-10-29): rebuilt Predictions around Product planning / Customer retention / Model evaluation. New `retail/PredictionsWorkspace.tsx`, `PredictionEvaluation.tsx`, `predictions.css`; new API/domain `app/product_planning.py` and `/retail/product-planning`. Server-side name/SKU search, category filter and pagination cover all products (tested >200); per-SKU drill-down includes monthly units/revenue, realized selling price, recent order cancellation/return rates, actual month-on-month momentum, revenue-based ABC classes, and demand/revenue plans. SKU identity survives title changes.

Planning compares trailing-three-month vs last-complete-month baselines. Excludes both boundary observation months, conservatively per product. Rolling two-month-horizon checks (up to six historical targets) provide MAE/WAPE/bias; choose lower MAE with >=3 checks, otherwise default to moving average. Selection/reporting use the same checks, not independent validation. New products require enough history; no stock, margin, seasonality or promotion effects are invented. The user-input purchase calculator uses max(0, ceil(demand/30*(lead+buffer)) - on hand - incoming); quantities/days are non-negative integers, combined days <=365. Buffer is an assumption. Inputs are session-only. Customer retention reuses the full named directory; evaluation retains measured LR/RF results with business-readable explanations. Older Analytics Products tab remains a simpler baseline.

Saved dataset deletion is implemented from list and open sheet via `DeleteDatasetDialog.tsx` (named confirmation, Keep dataset default focus). `DELETE /datasets/{id}` in main calls `dataset_deletion.py`: scope/membership check, workspace+dataset locks, running-job protection, cascade PostgreSQL records, remove UUID-owned source/cache/CSV/Parquet files and unreferenced import/source metadata. Files stage before DB commit and roll back on ordinary failure; ignored .deleting manifest supports manual process-crash recovery (not an automatic worker). External source/generator CSVs are preserved. Pipeline creation shares the workspace lock. App clears deleted active IDs, RetailPages repairs stale selections, Datasets refreshes on re-entry. No migration needed.

Verification: 42 API/domain tests pass; product math (6) and deletion (3) rerun after final refinements pass. Production build passes. Browser checked SKU search/drill-down, 22-unit plan with 3 on-hand/2 incoming -> 6-unit purchase at 14 days, long title wrapping, retention/evaluation views, desktop and 390px no page overflow. Fresh browser run has no console errors/warnings. Verified cancel and actual deletion on disposable fixtures from both list/detail, confirmed source/version cleanup and 404 afterward, and confirmed 50K demo retained and automatically selected. Temporary fixtures removed. 50K planning request ~1.67s locally. New ignored screenshots: product-planning.png, product-detail-planning.png, product-detail-mobile.png, dataset-delete-confirmation.png, dataset-delete-mobile.png. README and VIVA_NOTES explain business definitions and lifecycle limits. No commit/push.


2026-10-29 follow-up verification: new 50K CSV has zero question-mark names, Male/Female Indian name samples, latest date 2026-10-29 and 73 orders that day. PostgreSQL confirms zero numbered/question-mark names in the 4,148 new profiles. The older Retail demo 10,000 still has 833 Customer 00xxx names and is intentionally preserved; choose India retail 50000 orders 2026-10-29 for the new data. No data/code changes were necessary.


Latest refinement completed (2026-10-29): stronger neutral text and status contrast in Customers/profile/history, dark sidebar-aligned workspace menu, stable locally generated DiceBear Notionists Neutral SVG avatars with initials fallback, and INR currency-aware displays across analytics/customers/landing. Avatars are lazy loaded; provenance/license in docs/brand-assets.md. Mobile drawer now fixes the body while open and restores scroll on close.

New `app/retail_demo.py` powers both the in-app generator and `scripts/generate_retail_demo.py`. CLI defaults to 50K clean fictional Indian orders through today's IST date; supports seed/end date/output/messy flags, refuses overwrite, 100 to 100K rows. In-app presets still 10K/50K/100K with intentional mess. Includes Indian names, explicit Male/Female (not churn features), reserved example.test emails, stable locations/avatar seeds, INR, 102 SKUs/long marketplace titles and guaranteed valid recent purchases. New mapped profile gender/currency/avatar fields and server gender filter; history includes category and quantity for accurate icons and context. No migration or MongoDB needed.

Actual new CSV: ignored `data/raw/indian-retail-2026-10-29-50000.csv`. Imported into RetailPlus as `aa116c6d-ddf5-4550-88da-b4420ef74774`; all six pipeline stages Done in ~17.6s. 50,000 valid orders, 102 SKUs, 4,153 transaction customer IDs / 4,148 modeled customers with completed purchases. Risk totals: 1,509 Low, 1,047 Medium, 1,592 High. Female filter returns 2,057 modeled customers. Prior datasets preserved. Latest dataset is selected automatically on fresh navigation.

Verification: 32 API/domain tests pass, targeted profile persistence test passes after adding category/quantity; production build passes (initial JS ~353KB, avatar chunk ~210KB lazy). Browser verified current dates/names, INR grouping, 25 loaded and 25 distinct avatars, gender filter, dark menu, desktop drawer/history, mobile at 390 CSS px with no page or drawer overflow and Escape/scroll restoration. Browser console zero errors/warnings. Screenshots under ignored output/playwright: customers-india.png, workspace-dropdown-india.png, customer-profile-india.png, customers-india-mobile.png, customer-history-india-mobile.png. README and asset notes updated. All work remains uncommitted/unpushed.


Last updated: 2026-10-29

New-session entry point: [SESSION_HANDOFF.md](SESSION_HANDOFF.md). It records the current code map, user preferences, run commands, known gaps, and Git handoff. The user requested these `.agent` changes remain local and uncommitted for now.

## Current phase

RetailPulse expansion: retail data, analytics, evaluated churn and PostgreSQL customer documents.

## Completed

- Created the scalable workspace structure for applications, services, shared packages, data, ML, infrastructure, documentation, scripts, configuration, and tests.
- Defined the initial data-input support scope.
- Created and migrated the local PostgreSQL `retailplus` database with Prisma schemas, query modules, migration history, a local shadow database, and an admin seed.
- Created a FastAPI login/dashboard API backed by PostgreSQL.
- Created a React admin scaffold with landing, login, and dashboard screens.
- Added an authenticated CSV organizer with field normalization, cleaning, validation, duplicate review, and CSV export.
- Adopted the nine-stage logical agent workflow and five-phase delivery plan in `docs/agent-workflow.md`.
- Added basic CSV dataset understanding and downloadable per-change provenance.
- Added workspace selection and creation after login, with workspace-scoped dashboard and CSV access.
- Added selectable Dataset pipeline checkpoints and expanded CSV encoding and separator detection.
- Moved CSV processing into the Datasets tab inside the dashboard shell and removed the oversized dashboard import actions.
- Added a saved Datasets list, drop or attach upload, persistent CSV import records, reopenable processing details, paginated rows, and saved-source downloads.
- Replaced the large finished checkpoint panel with a compact processing disclosure and an editable numbered dataset grid; added upload progress and persisted cell/row edits.
- Expanded the saved dataset sheet across the workspace and removed the duplicate Datasets page heading and excess top spacing.
- Replaced Previous/Next paging with a continuously scrolling 100-row window; added selected-cell address/value controls, persisted cell formatting, and gentle missing-value/type cues.
- Grouped sidebar navigation into Home, Data, Analyze, and AI, with clear planned views for upcoming sections; made sheet tools wrap visibly on narrow screens.
- RetailPulse expansion: seeded 10K/50K/100K retail generator with customer IDs, product SKUs, stores, country/city/state/postal codes; upgraded cleaning, missing-value strategies, invalid-transaction reporting and before/after quality scores.
- Immutable raw source and CSV/Parquet revisions with checksums/provenance; saved retail mappings and detected column types; edit/mapping-driven model invalidation.
- PostgreSQL-backed pipeline stage status/timing, navigation recovery and clear failures. Interrupted local jobs are marked failed on API restart; retry is manual.
- Filtered retail analytics, rule insights, simulated inventory/restocking and CSV/PDF reports; evaluated logistic regression/random forest churn, current risk probabilities and KMeans RFM segmentation.
- PostgreSQL JSONB customer documents, nested purchase histories, combined document filters and high-risk export. MongoDB/JSON fallback explicitly superseded by the user's PostgreSQL-only direction.
- Architecture/Status pages, real optional PySpark DataFrame/RDD/SQL demo, simulated stream with controls/counters/feed, monthly baseline forecast, README and VIVA_NOTES.md.
- Verification: 22 API/domain tests pass, frontend production build and Prisma generation pass. Actual full 10K pipeline: 5.67s. 100K generation/cleaning/analytics/training domain check: 13.25s. Actual Spark demo: 14.171s, 8,064 valid completed lines, identical category totals across all three APIs. Browser-checked analytics filters, prediction metrics, customer profiles/segments, dataset sheet and simulation; mobile screenshot checked at 390px.

## In progress

- Latest refinement completed (2026-10-29): removed repeated breadcrumb/title headers; Customers is now **Customer health** with direct counts for **Likely to return / Check in soon / May not return** (aliases of model Low/Medium/High risk). The profile drawer gives a direct outlook and keeps probability/date/limitations in context. Added **Products** inside Analytics, with searchable next-month demand baselines, recent-month units and direction; requires mapped product/SKU plus enough filtered history. Uses the average of three calendar months before the final observation month, excludes that partial month, and is explicitly not an evaluated forecasting model.
- Rebuilt the landing page in `LandingPage.tsx`/`landing.css`, with an interactive, labeled illustrative product tour calculated from local sample fixtures. Added shared `Brand.tsx`, transparent cart-plus PNG and category-specific Lucide product icons. Generation prompt/provenance: `docs/brand-assets.md`. Actual alpha verified 0–255; project asset is `public/brand/retailplus-cart-plus.png`.
- Replaced full-screen workspace switching from the sidebar with `WorkspaceSwitcher.tsx`: in-place list, current-workspace check, inline creation form, outside/Escape closing and scoped token selection. Dashboard remounts per workspace ID to clear prior dataset/view state. Initial post-login gate still handles first workspace selection/setup.
- Latest verification: **28 tests pass**; frontend build passes. Browser verified direct customer counts, Products view/icons, landing tour, switching to Novki and back without leaving the dashboard, inline creation form open/cancel, and mobile landing at 390px with no horizontal overflow. Browser console clear. Fixed pandas `product` method/column collision exposed by new missing-SKU tests. New ignored screenshots: `landing-v2.png`, `landing-mobile-v2.png`, `customer-health-v2.png`, `product-outlook-v2.png`, `workspace-dropdown-v2.png`.

- 2026-10-29 UI follow-up completed: removed More navigation; rebuilt Analytics/Customers in focused `src/retail` modules with reusable chart/card components and shared types/styles. Analytics now has interactive sales bars/tooltips, category/location filtering, order-status and spend donuts, first/repeat-order charts, product tables and report views. Customers has real overview metrics, search/filter/server sorting, segment cards/scatter, pagination and a modal profile drawer with risk, purchase rhythm and filterable history. Improved readable type/contrast, compact desktop dataset selection and a pinned sidebar footer.
- Verification: 24 API/domain tests pass, production build passes. Browser checked category-driven KPI updates, customer search, directory sort control, drawer open/Escape, mobile navigation, and 390px Analytics/Customers layouts. Fixed an absolute hidden table label causing mobile page overflow; tables now scroll inside their container. Browser console has no errors/warnings. Local screenshots: `analytics-redesign.png`, `customers-redesign.png`, `customer-drawer-redesign.png`, `analytics-mobile-redesign.png`, `customers-mobile-redesign.png`, `customer-drawer-mobile.png` in ignored `output/playwright`.

## Next milestone

Use the retail demo for submission review. Select future work explicitly: Assistant, approved category organization/reviewer decisions, additional input formats, or durable production job/file lifecycle handling.

## Notes

- 2026-10-29: Read the session notes and inspected Git state, frontend dataset/placeholder views, API persistence, and CSV processing. Captured the user's RetailPulse feature intake and scope conflicts in [RETAILPULSE_SCOPE.md](RETAILPULSE_SCOPE.md). No implementation changes or runtime checks in this intake; awaiting the next task. Existing local notes were preserved; no commit or push.

- This document is the running delivery status. Update it whenever task status changes or a milestone is completed.
- Do not mark formats as supported until their parsing, validation, error handling, and tests exist.
