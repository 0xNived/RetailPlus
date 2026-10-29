# RetailPlus frontend storyboard

Last updated: 2026-10-29

## 1. Landing and sign in

The visitor sees the product story and chooses **Open workspace** or **Log in**. The login form accepts the seeded account and sends credentials to `POST /auth/login`. A successful login receives a user session token and moves to the workspace chooser. A failed login stays on the form with an inline error.

## 2. Workspace chooser

The chooser loads the user's memberships from `GET /workspaces`.

| State | Screen behavior | Next action |
| --- | --- | --- |
| Loading | Show a short loading status | Wait for the list |
| One or more workspaces | Show a card per workspace with name, role and slug | Open one or create another |
| No workspaces | Show a required **Name your workspace** dialog | Enter a name and create |
| Creation failure | Keep the dialog open and show the reason | Correct the name or retry |
| Selection failure | Keep the chooser and show the reason | Retry or choose another |

Creating a workspace calls `POST /workspaces` and gives its creator the admin role. Opening one calls `POST /workspaces/{id}/select` and issues a token scoped to that workspace. The dashboard and dataset endpoints reject an unselected session. The dashboard sidebar offers **Switch workspace** so a user with several memberships can change context.

## 3. Dashboard

The selected workspace name appears in the breadcrumb and switch control. Metrics and recent imports come from the selected workspace only. **Datasets** is a tab in the same dashboard shell. It lists saved datasets and opens their processing results without removing the sidebar. Switching between Home and Datasets keeps the selected dataset view during that visit. A successful import is stored and appears in dashboard counts and recent activity after the dashboard reloads.

The sidebar is grouped as **Home**, **Data → Datasets**, **Analyze → Analytics, Customers, Predictions**, and **AI → Assistant**. The Analyze and AI entries open clearly marked planned views until their services exist.

## 4. Datasets and processing

Within the Datasets tab, the user sees a table of existing datasets or an empty state. **Add dataset** opens an upload view in the same shell. The user drops or attaches a CSV and selects **Add dataset**. During upload, the view shows actual upload percentage; while the API organizes the file, it shows an indeterminate processing state. The API validates and processes the source, saves it under the selected workspace, and opens the dataset table. Errors stay near the upload control. It supports UTF-8, UTF-16 with a byte-order mark, and Windows-1252 text, and detects comma, semicolon, tab and pipe separators.

After processing, the large checkpoint panel disappears. A compact **Data organized** status at the top expands on request to show processing facts and the four checks currently implemented. Planned stages are not shown as progress on the finished table.

CSV analysis currently runs in one request. Live per-stage percentages would need a background job and progress endpoint; the UI only claims the upload percentage it can measure.

| Checkpoint | Current state after successful CSV analysis | Detail shown |
| --- | --- | --- |
| Ingestion | Complete | Row count, detected encoding and separator |
| Understanding | Complete, basic | Likely dataset and field types, suggested missing fields |
| Cleaning | Complete, basic | Exact duplicate count and possible fuzzy pairs retained |
| Organization | Planned | Dataset-specific categories and generated fields are future work |
| Validation | Complete, basic | Column validation and missing-value counts |
| Analytics | Planned | Future dataset-specific statistics and charts |
| Prediction | Planned | Future eligibility and evaluation gate |
| Dashboard | Planned | Future dataset dashboard based on validated data |
| Export | Ready, then complete after download | Organized CSV and per-change log |

The saved detail page gives the spreadsheet-style grid the full area beside the sidebar. It omits the duplicate Datasets heading and keeps only a compact back link, dataset name, status disclosure, and small table controls above the sheet. The grid has Excel-style row numbers (headers at row 1), column letters, a selected-cell address and value bar, editable cells, and row add/remove controls. Rows scroll continuously; the browser requests a 100-row window at a time. Double-click or press Enter/F2 to edit a selected cell. The toolbar shows every formatting control and wraps on narrow screens instead of scrolling sideways. It saves bold, italic, underline, alignment, fill color, and text color for the selected cell. Empty values have a soft amber tint, and numeric/date-looking fields align according to their inferred type. The organized CSV export includes saved values and row changes, and the change log includes manual actions. CSV does not carry visual formatting, so RetailPlus stores cell styles separately for the web grid. No fuzzy duplicate is silently removed. The original local file is untouched; the server stores its own source and organized copies under `data/uploads/`.

## 5. CSV failure and recovery

- Unsupported file or oversized input: explain the accepted CSV format and size limit; let the user choose another file.
- Encoding or separator mismatch: try supported encodings and separators automatically; show the detected format on success.
- Inconsistent rows or quotes: show a specific row-structure message and keep the selected file for retry or replacement.
- Network/API failure: keep the file selection and show an inline error; never show completed checkpoints on a failed analysis.

## Next build milestone

Persist immutable stage outputs and reviewer decisions with versioned provenance. Add background processing and checkpoint updates so large imports can resume after navigation or refresh.
