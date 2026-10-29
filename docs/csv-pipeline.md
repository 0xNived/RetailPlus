# CSV organization pipeline

Last updated: 2026-10-29

## Current working slice

`CSV upload → basic understanding → field normalization → value cleaning → validation → duplicate review → organized CSV + change log`

The authenticated CSV workspace accepts UTF-8 (including a byte-order mark), UTF-16 with a byte-order mark, and Windows-1252 CSV files up to 5 MB, 20,000 rows, and 100 columns. It detects comma, semicolon, tab, and pipe separators. **Add dataset** saves the original source and organized CSV under `data/uploads/`, creates a workspace-scoped import job and dataset, and stores the profile summary. The Datasets tab lists saved datasets and opens an editable, paginated row grid. Edits, row additions, and row deletions update the organized copy; the change log includes manual actions.

| Stage | Current behavior | Tool |
| --- | --- | --- |
| Parse | Read all columns as text to preserve IDs, leading zeroes, and source values | Pandas |
| Understand | Infer a likely dataset type and likely field types without converting source values; suggest missing fields | Pandas |
| Match fields | Normalize headings and apply known business aliases; show fuzzy suggestions for review | Pandas, RapidFuzz |
| Clean | Trim and collapse whitespace, convert common empty markers to missing values | Pandas |
| Validate | Check the cleaned column structure; report missing values by column | Pandera |
| Detect duplicates | Remove exact duplicate rows; retain and report likely fuzzy pairs | Pandas, RapidFuzz |
| Export | Download the cleaned CSV and a per-change provenance CSV, with spreadsheet formula cells escaped | Pandas |

The saved dataset opens as a continuously scrolling, numbered grid that requests 100 rows at a time. A compact status disclosure shows the detected format, dataset type, missing-value count, and duplicate findings. Cell styles are stored separately from CSV values because CSV does not support formatting. The change log records original and new values, affected data rows, the action, and whether it was automatic or manual. Fuzzy suggestions are never applied automatically. Existing category values are preserved; category discovery and naming are not active yet. The original source file is preserved separately from the editable organized copy.

## Planned extensions

| Stage | Candidate | Activation condition |
| --- | --- | --- |
| Cross-dataset schema matching | Valentine | Compare an imported CSV to a known reference dataset or approved schema; require review of proposed mapping. |
| Interactive cleaning | OpenRefine | Add when analysts need repeatable, human-edited cleaning recipes; Pandas covers the initial automatic flow. |
| Learned record linkage | Dedupe or Splink | Add labeled examples and a review workflow before merging nonidentical records. |
| Topic discovery | BERTopic | Add when there are enough meaningful free-text rows to cluster and evaluate topics. |
| Category naming | Configured LLM provider | Present suggested labels with evidence and approval; do not silently send business records to a model. |
| Document extraction | Docling or Unstructured | Feed PDF/DOCX extraction into a separate structured review flow. |

Other tools from the research list remain candidates, not installed dependencies: Cleanlab for label and data-error detection, Great Expectations or Soda Core for broader quality checks, Data Formulator for assisted transformation, Top2Vec or Sentence Transformers with HDBSCAN for alternative grouping, and OpenRefine for interactive cleanup. Choose each after a representative RetailPlus dataset and measurable acceptance criteria exist.

## Next integration step

Store versioned organized outputs and reviewer decisions. Move processing to a background job when imports become too large for one request, then expose per-stage progress and resume.
