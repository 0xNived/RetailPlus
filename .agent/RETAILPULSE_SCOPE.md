# RetailPulse requirements intake

Recorded: 2026-10-29. This preserves the original requirements intake. **Superseding delivery:** the user supplied a detailed college-submission task and authorized implementation, explicitly choosing PostgreSQL instead of MongoDB/fallback and retail entities/geography. The retail slice is now implemented and verified; see `PROGRESS.md`, `TASKS.md`, the updated handoff, README and live Status page. The baseline and open decisions below describe the earlier intake, not current implementation state.

## Verified baseline

- React workspace shell with grouped navigation and saved, editable CSV datasets.
- FastAPI with PostgreSQL persistence and local CSV/style/edit-log files.
- pandas processing: field aliases, profiling, whitespace and missing-value normalization, exact duplicate removal, fuzzy duplicate suggestions, and organized CSV/change-log export.
- Current import limits: 5 MB, 20,000 rows, 100 columns. Processing runs during the upload request; transfer progress is measured, processing is indeterminate.
- Analytics, Customers, Predictions, and Assistant are placeholder views in `App.tsx`. Home reports dataset/import activity, not retail sales KPIs.
- Source inspection only in this intake; no runtime verification or test rerun.

## Requested additions

| Area | Requested scope | Relationship to existing plan |
| --- | --- | --- |
| Dashboard and analytics | Revenue, orders, customers, products; daily/weekly/monthly trends; best/worst products and categories; city/state sales; average order value and cancellation rate; date/category/region/customer filters; CSV/PDF reports | Extends planned Analytics with retail-specific measures and required field mappings. |
| Data processing | Generate 10K–500K transactions or upload CSV; duplicates, missing values, invalid-transaction handling; quality score/report; PySpark and Spark SQL; processing time/job status; local Parquet lake | Basic CSV cleaning exists. Generation, retail validation, quality scoring, Spark, Parquet, and observable background jobs remain to build. Current limits do not support a general 500K-row promise. |
| Machine learning | Churn prediction; Low/Medium/High risk; segmentation; measured accuracy/precision/recall/F1; feature importance; retention recommendations | Extends planned Predictions. Requires suitable historical data, target definitions, evaluation, and eligibility gates. |
| Business insights | Declining categories, unusual sales, cancellation reasons, high-value customers, promotion/discount and restocking suggestions; rule-based insights | New retail rules within planned analytics/insights. Inventory and cancellation explanations require relevant data. |
| Live simulation | Start/stop synthetic transaction stream; live counters/charts/activity; adjustable speed | New capability. Synthetic activity must be identified as simulated. |
| Customers | Search, profiles, purchase history, spending, order frequency, segment, risk; MongoDB with local JSON fallback | Customers view exists only as a placeholder. MongoDB/JSON is a new storage requirement alongside current PostgreSQL; ownership and fallback behavior need definition. |
| Learning/viva | Pipeline diagram; Hadoop, Kafka, Spark, data lakes, batch/streaming, CAP explanations; syllabus mapping; Implemented/Simulated/Conceptual labels | New educational scope. Do not claim explanatory Hadoop/Kafka material is a running integration. |
| System | Responsive sidebar, optional dark/light mode, one-click pipeline with progress/errors, FastAPI, tests, documentation and architecture diagrams | Shell, FastAPI, and CSV unit tests exist. Complete pipeline execution, stage persistence, wider tests, and documentation remain incremental work. |

## Reconciliation and open decisions

- Preserve the recorded UI preferences: imports stay in Data / Datasets; saved list first; compact status after processing; large spreadsheet area; grouped sidebar and restrained visual styling.
- Proposed fit: retain general dataset ingestion and add retail analysis when mapped fields support it. This preserves previous work while accommodating the requested retail scope. This is a proposal, not a confirmed product decision.
- Existing multi-format import work, traceability, reviewed categories, and Assistant remain on the earlier backlog. Their priority relative to retail delivery is not yet settled.
- PostgreSQL is the current runtime store. Do not replace it or add an automatic JSON fallback merely from this intake; define the customer-store boundary when that work is selected.
- Separate actual PySpark/Spark SQL/Parquet implementation from educational or simulated components. Hadoop/Kafka explanations do not require real services unless requested later.
- Never invent missing transaction values, model metrics, job progress, or explanations. Define retail validation and review behavior before automatically dropping business records.
- The pasted college-versus-product question is unresolved; do not assume a college submission or a syllabus deadline. Confirm intended delivery scope when it affects implementation.

## Next handoff

The user requested context review and will provide the next task. No app implementation, commit, or push was performed for this intake. Use this document together with `SESSION_HANDOFF.md`, `PROGRESS.md`, and `TASKS.md`.
