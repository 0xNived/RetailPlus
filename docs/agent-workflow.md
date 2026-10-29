# RetailPlus agent workflow

Last updated: 2026-10-29

## Product goal

After a CSV upload, RetailPlus should understand the dataset, clean and organize it, validate proposed changes, generate relevant analytics, assess whether predictions are justified, and present results for review and export. These are nine logical stages of one pipeline; they do not require nine LLM services.

```text
Upload → Ingestion → Understanding → Cleaning → Organization
       → Validation → Analytics → Prediction eligibility
       → Dashboard → Export
```

Every stage receives the source file identity, a versioned dataset, prior stage findings, and a change log. A stage returns a candidate dataset plus evidence, warnings, and its decisions. The original upload remains immutable. Automatic changes and user-approved changes are distinguishable.

| Stage | Input and decision | Output | Initial implementation |
| --- | --- | --- | --- |
| Ingestion | Read source bytes, verify format and limits, retain text values | Parsed rows and original field names | CSV via Pandas |
| Understanding | Infer dataset purpose, field meanings and likely types without coercing IDs | Dataset profile and schema suggestions | Basic CSV profile; richer interpretation planned |
| Cleaning | Normalize safe formatting, find missing/invalid values and duplicates | Candidate cleaned rows and change log | Whitespace, empty markers, exact and fuzzy duplicate review |
| Organization | Extract useful fields and discover dataset-specific groups | Candidate categories and structured columns | Planned |
| Validation | Check candidate schema, values and confidence; route uncertain changes to review | Validated version and unresolved findings | Basic Pandera checks; approval workflow planned |
| Analytics | Calculate relevant statistics, trends, category distributions and KPIs | Reproducible insight definitions and aggregates | Planned |
| Prediction | Check data volume, target, history and evaluation; train only when justified | Eligibility explanation or evaluated predictions | Planned |
| Dashboard | Choose charts suited to validated fields and show quality context | Dataset-specific dashboard | Generic workspace shell exists; dynamic dataset dashboard planned |
| Export | Provide organized data, insight outputs and provenance | CSV and audit history | Organized CSV exists; saved artifacts planned |

## Execution rules

1. Understand field meaning before changing values or types. Preserve product codes, postal codes and identifiers as text unless the user explicitly confirms a conversion.
2. Never fabricate a missing value. Recover it from the uploaded data when evidence is clear, otherwise keep it missing or mark a proposed estimate.
3. Categories come from the uploaded dataset. No global fixed category list is imposed on every company. Generated labels are reviewable.
4. Analytics consumes only validated rows and must disclose exclusions or unresolved findings.
5. Predictions are optional. The system must explain an ineligible dataset instead of producing a forecast without a target, enough examples or reliable evaluation.
6. Keep the original, every changed value, the rule or model that changed it, and whether the change was automatic or approved. Fuzzy duplicates stay until reviewed.

## Development sequence

| Phase | Deliverable | Exit condition |
| --- | --- | --- |
| 1 | CSV upload, understanding, cleaning and duplicate review | A user can explain what changed and export a clean CSV plus provenance. |
| 2 | Dataset-specific field and category suggestions | Generated values are grounded in source data and can be accepted or rejected. |
| 3 | Validation and dynamic analytics | Every chart uses a validated dataset version and shows its definition. |
| 4 | Prediction eligibility and evaluated models | Predictions appear only after a held-out evaluation meets a documented threshold. |
| 5 | Saved projects, exports and reusable rules | Users can revisit original files, versions, decisions and outputs. |

The current implementation is an early Phase 1 slice. The [CSV pipeline](csv-pipeline.md) lists the exact behavior and limits.
