github : https://github.com/0xNived/RetailPlus

# RetailPlus

## Product information

RetailPlus is an enterprise data platform for importing, cleaning, analyzing, and using business data in dashboards and ML workflows. It supports structured, semi-structured, and unstructured inputs through a staged rollout.

### Initial release: source files

The first release will start with the source-file formats represented in the product UI:

| Format | Extension | Initial purpose |
| --- | --- | --- |
| CSV | `.csv` | Tabular business and product data |
| Excel | `.xlsx` | Spreadsheet imports |
| PDF | `.pdf` | Invoices, reports, and documents |
| Docs | `.docx` | Word business documents |
| Images | `.png` | Image-based source material |
| JPEG | `.jpg`, `.jpeg` | Image-based source material |

These formats are the planned first implementation scope; support will be marked complete only after upload, extraction/parsing, validation, error handling, and tests are delivered.

### Supported and planned input formats

| Priority | Format | Extension | Typical use | Recommendation |
| --- | --- | --- | --- | --- |
| 🟢 P0 | CSV | `.csv` | Customer records, products, company datasets | **Essential** |
| 🟢 P0 | Excel | `.xlsx`, `.xls` | Business data, spreadsheets | **Essential** |
| 🟢 P0 | JSON | `.json` | APIs, nested data, company records | **Essential** |
| 🟢 P0 | Plain Text | `.txt` | Unorganized lists, raw text | **Essential** |
| 🟢 P0 | Paste Input | Direct text | Users paste messy data | **Essential** |
| 🟡 P1 | JSON Lines | `.jsonl`, `.ndjson` | Large datasets, AI pipelines | Highly recommended |
| 🟡 P1 | PDF | `.pdf` | Invoices, reports, company documents | Recommended |
| 🟡 P1 | Word | `.docx` | Reports, descriptions, business records | Recommended |
| 🟡 P1 | XML | `.xml` | Enterprise systems, data exports | Recommended |
| 🟡 P1 | HTML | `.html` | Website exports, scraped content | Recommended |
| 🔵 P2 | Parquet | `.parquet` | Large analytical datasets | Later |
| 🔵 P2 | SQL | `.sql` | Database exports | Later |
| 🔵 P2 | Database | PostgreSQL, MySQL, SQLite | Direct database imports | Later |

## Planned product workflow

```text
                 DATA INPUT
                     │
                     ▼
              DATA INGESTION
           (CSV, Excel, API, DB)
                     │
                     ▼
             DATA PROFILING
       (Understand data & detect issues)
                     │
                     ▼
              DATA CLEANING
       (Duplicates, missing values,
        formatting, invalid records)
                     │
                     ▼
           DATA TRANSFORMATION
       (Normalize, structure, categorize,
        merge and engineer features)
                     │
                     ▼
              DATA STORAGE
           (Database / Warehouse)
                     │
             ┌───────┴────────┐
             ▼                ▼
        ANALYTICS         ML / AI MODEL
      (KPIs, trends,      (Predictions,
       statistics)         classifications)
             │                │
             └───────┬────────┘
                     ▼
                DASHBOARD
          (Charts, insights, reports)
                     │
                     ▼
              EXPORT / ACTION
          (CSV, PDF, API, alerts)
```

This workflow is planned architecture. Initial development starts with P0 ingestion, profiling, cleaning, transformation, database storage, and dashboard-ready analytics; ML, advanced exports, and later input sources follow in staged releases.

## Working CSV organizer

The current admin workspace can sign in, analyze a UTF-8 CSV, review a basic dataset understanding profile, field normalization, missing values, exact duplicates and possible fuzzy duplicates, then download an organized CSV and its change log. Upload analysis is currently stateless and does not yet create a stored dataset or dashboard history. The planned schema matching and AI categorization stages are detailed in [the CSV pipeline](docs/csv-pipeline.md).

The full nine-stage logical agent workflow and its phased delivery plan are in [the agent workflow](docs/agent-workflow.md).
