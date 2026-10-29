# RetailPlus frontend design

**Status:** planned
**Last updated:** 2026-10-29
**Purpose:** a build-ready product and visual design brief for the RetailPlus web application.

## Design direction

RetailPlus should feel like a calm, capable operations workspace: focused enough for an analyst working through a difficult import and clear enough for a business user checking the health of their data.

The supplied Obvious references inform the following qualities only: restrained editorial typography, deliberate whitespace, a strong light/dark contrast between marketing and product contexts, fine borders, compact data metadata, and a quiet interface with one clear primary action. RetailPlus must use its own name, iconography, copy, data model, and page layouts. Do not reproduce the Obvious logo, navigation, copy, or screen designs.

### Product personality

- **Assured, not flashy.** One primary action per view; color communicates state, not decoration.
- **Data-first.** Values, file names, types, status, and provenance are easy to scan.
- **Guided.** Every import exposes its next step and any required user decision.
- **Enterprise-ready.** Dense views stay legible, errors are actionable, and audit context is available.

## Users and primary jobs

| User | Primary job | Home view |
| --- | --- | --- |
| Operations analyst | Import, clean, validate, and publish business data | Workspace home / imports |
| Data analyst | Profile data, explore trends, and build dashboards | Analytics |
| ML practitioner | Prepare features and run or monitor models | Models |
| Manager | Review KPIs, exceptions, and scheduled outputs | Executive dashboard |
| Administrator | Manage people, access, integrations, and policies | Settings |

## Information architecture

The screen-by-screen login, workspace selection, and dataset processing journey is specified in [frontend-storyboard.md](frontend-storyboard.md).

```text
Workspace
├── Home
├── Imports
│   ├── New import
│   ├── Import detail
│   └── Source connections (later)
├── Data
│   ├── Datasets
│   ├── Profiles
│   ├── Cleaning runs
│   └── Transformations
├── Analytics
│   ├── Dashboards
│   ├── Reports
│   └── Exports
├── Models
│   ├── Experiments
│   ├── Deployments
│   └── Predictions
├── Alerts
└── Settings
    ├── Members & roles
    ├── Integrations
    ├── Data retention
    └── Audit log
```

### Navigation

Use a persistent, collapsible left sidebar in the authenticated application.

- Top: RetailPlus mark and workspace switcher.
- Middle: **Home**, **Data / Datasets**, **Analyze / Analytics, Customers, Predictions**, and **AI / Assistant**. Group headings are quiet and links are indented with a subtle guide line. Planned destinations open an explicit coming-next state.
- Bottom: help, notifications, user menu, and plan/usage state.
- Active item: a subdued filled background plus an accent edge or icon—never rely on color alone.

On screens under 800px, use a navigation drawer. Dataset creation remains inside the Datasets tab, where the add action is visible beside the saved list.

## Initial release experience

### Home

The default authenticated view is an onboarding-aware workspace home.

**Empty workspace**

```text
┌ Sidebar ───────────────┬───────────────────────────────────────────────────┐
│ RetailPlus             │ Good morning, [Name]                              │
│ [+ New import]         │ Bring your first business dataset into RetailPlus.│
│                        │                                                   │
│ Home                   │ ┌────────────── Upload source files ────────────┐ │
│ Imports                │ │ Drop files here or browse                       │ │
│ Data                   │ │ CSV · Excel · PDF · DOCX · PNG · JPEG          │ │
│ Analytics              │ │ [Choose files]                                  │ │
│ Models                 │ └────────────────────────────────────────────────┘ │
│ Alerts                 │                                                   │
│ Settings               │ What happens next                                 │
│                        │ 1. Profile  2. Review issues  3. Publish data    │
└────────────────────────┴───────────────────────────────────────────────────┘
```

**Active workspace**

- Header: workspace name, date range where relevant, `New import`.
- Summary row: datasets, data-health score, imports in progress, open alerts.
- Main grid: recent imports and their status, cleaning work requiring review, a compact data-quality trend, and saved dashboard shortcuts.
- Use progressively disclosed detail: a row opens its dedicated screen instead of putting every control on the home screen.

### New import

The first-release import source picker supports these files:

| Source | Extensions | UI treatment |
| --- | --- | --- |
| CSV | `.csv` | Green table/file icon |
| Excel | `.xlsx`, `.xls` | Green spreadsheet icon |
| PDF | `.pdf` | Red document icon |
| Word document | `.docx` | Blue document icon |
| PNG image | `.png` | Purple image icon |
| JPEG image | `.jpg`, `.jpeg` | Amber image icon |

The file picker is a large drop zone with an accessible `Choose files` button. Below it, present the source types as a compact two-column list—not as selectable cards—so the upload action remains visually dominant.

**Import states**

1. **Select:** accept drag-and-drop and file browse. Explain supported types, maximum file size, and privacy/retention link.
2. **Upload:** each file row shows name, type, size, progress, cancel, and retry where relevant. Do not block a batch because one file fails.
3. **Inspect:** show detected sheet/page/image count, likely schema or extraction type, and data-quality highlights.
4. **Resolve:** show only decisions that require a human (sheet selection, header row, duplicate handling, extraction warning).
5. **Confirm:** summarize output dataset name, record count where applicable, known warnings, and `Create dataset`.
6. **Complete:** send the user to the dataset profile with the next recommended action.

PDF, DOCX, PNG, and JPEG imports should be labelled as **document extraction** or **image extraction** in the UI. Never imply a row-level dataset exists before extraction and review succeed.

### Dataset profile

The profile is the handoff between ingestion and cleaning.

- Title area: dataset name, source file, owner, last updated, health status, and overflow actions.
- Tabs: Overview, Columns, Quality issues, Cleaning history, Transformations, Activity.
- Overview: sample preview, schema summary, profile findings, and downstream usage.
- Quality issues: sortable issue table with severity, column, affected records, recommended resolution, and audit-aware action.
- Cleaning history: immutable run timeline with who/what/when, input and output counts, and a reversible preview before publishing.

### Analytics and models

Analytics and models are downstream products, not extensions of the import wizard.

- **Analytics:** dashboard canvas, KPI tiles, trend charts, filters, sharing, and export controls.
- **Models:** model inventory, data source, run status, evaluation summary, prediction jobs, and deployment state.
- Both clearly show the source dataset and freshness timestamp.

## Visual system

### Theme model

Use a neutral light marketing surface and a deep charcoal application shell. The app is designed for long data-work sessions, so dark surfaces should be warm and low-glare, while tables and document previews can use elevated neutral panels.

```css
:root {
  --rp-canvas: #f7f6f2;
  --rp-surface: #ffffff;
  --rp-surface-subtle: #efeee9;
  --rp-app: #171817;
  --rp-panel: #202120;
  --rp-panel-hover: #292a29;
  --rp-text: #171817;
  --rp-text-on-dark: #f5f4ef;
  --rp-muted: #767571;
  --rp-border: #d9d7d0;
  --rp-border-dark: #363735;
  --rp-accent: #79e6a4;
  --rp-accent-strong: #28ae68;
  --rp-info: #75a9ff;
  --rp-warning: #f5bd48;
  --rp-danger: #ec6f6f;
  --rp-focus: #9fc1ff;
}
```

`--rp-accent` is reserved for positive progress, primary creation actions, and active states. Error, warning, and information colors always pair with an icon and text label. Verify all text/background pairs meet WCAG AA (4.5:1 for normal text).

### Typography

RetailPlus uses `Geist Sans` for the UI and `Geist Mono` for data metadata. Geist Sans is the observed font used across the current OpusClip product UI. Cursor uses Cursor Gothic and Berkeley Mono, which are licensed Cursor fonts and are therefore not bundled in RetailPlus.

The root size is `16px` (`1rem`). All product typography uses `rem` so users who increase their browser text size keep a readable interface.

| Role | Family | Size | Weight | Line height | Use |
| --- | --- | --- | --- | --- | --- |
| Display | Geist Sans | `clamp(3.25rem, 7.4vw, 5.875rem)` | 650 | 0.95 | Landing hero only |
| Page title | Geist Sans | `1.9375rem` | 600 | 1.1 | Dashboard and page titles |
| Section title | Geist Sans | `1.5625rem` | 600 | 1.2 | Major workspace sections |
| Card title | Geist Sans | `1.4375rem` | 600 | 1.3 | Feature and summary cards |
| Body large | Geist Sans | `1.25rem` | 400 | 1.45 | Marketing context and lead copy |
| Body | Geist Sans | `1rem` | 400 | 1.5 | Form inputs and general context |
| UI label | Geist Sans | `.875rem` | 600 | 1.35 | Buttons, navigation, controls |
| Metadata | Geist Sans | `.8125rem` | 450 | 1.4 | Descriptions, helper text, table labels |
| Overline | Geist Sans | `.75rem` | 600 | 1.3 | Eyebrows and compact headings |
| Technical metadata | Geist Mono | `.625rem`–`.75rem` | 450–500 | 1.4 | Status, IDs, file extensions, timestamps |

Use sentence case. Keep titles concrete: `Review imported data`, not `Data review center`.

### Layout, surfaces, and tokens

| Token | Value | Use |
| --- | --- | --- |
| Page maximum | 1440px | Main desktop content width |
| Page gutter | 24px desktop / 16px mobile | Page breathing room |
| Spacing unit | 4px | Base rhythm |
| Standard gaps | 8, 12, 16, 24, 32px | Component and section spacing |
| Radius | 8px controls, 12px cards, 20px upload panels | Keep shapes restrained |
| Border | 1px solid token color | Default surface separation |
| Shadow | subtle `0 8px 24px rgba(0,0,0,.12)` | Dialogs and menus only |

Avoid decorative gradients, glass effects, persistent heavy shadows, and more than one competing accent color in a view.

## Components and interaction rules

| Component | Specification |
| --- | --- |
| Buttons | Primary is filled accent; secondary is outlined; tertiary is text-only. Include visible hover, focus, disabled, loading, and pressed states. Pressed state scales to `0.97`. |
| File drop zone | Clear dashed/solid boundary, keyboard-accessible browse control, drag-active state, accepted types, and error summary. |
| Status badge | Icon + text. Use `Queued`, `Uploading`, `Profiling`, `Needs review`, `Ready`, `Failed`; never color alone. |
| Data table | Sticky header, row hover, sortable headers, column visibility, horizontal scroll on narrow viewports, and explicit empty/loading/error states. |
| KPI tile | One measure, label, comparison period, and directional cue. Do not make tiles clickable unless they lead somewhere. |
| Side panel | Use for contextual inspection and non-destructive actions; reserve modal dialogs for irreversible or blocking decisions. |
| Toast | Confirmation and recoverable failures only. Keep the action in place for important errors; a toast must not be the sole error message. |

### Motion

- Motion exists to confirm state changes, preserve spatial context, or explain an occasional workflow—not to decorate repeated data work.
- Button press: `transform 120ms cubic-bezier(0.23, 1, 0.32, 1)`; `scale(0.97)` while pressed.
- Menus, popovers, and tooltips: opacity and transform only, 150–200ms ease-out; anchor transform origin to the trigger.
- Dialogs and drawers: 200–240ms ease-out; dialogs stay center-origin.
- Table filtering, keyboard navigation, and command actions should update without entrance animation.
- Respect `prefers-reduced-motion`: remove position/scale motion and retain brief opacity transitions only.

## Responsive and accessibility requirements

- Support 320px through wide desktop. Start the authenticated layout at a usable 768px tablet breakpoint.
- Keep all core import actions available on mobile; use a bottom sheet or full-page flow for complex configuration.
- Provide a visible focus indicator using `--rp-focus`; preserve it for mouse and keyboard users.
- Meet WCAG 2.2 AA: semantic headings, labelled inputs, screen-reader status updates for upload progress, keyboard-operable drag/drop alternatives, and non-color status indicators.
- Use touch targets of at least 44 × 44px for primary mobile actions.
- Validate table workflows with keyboard-only navigation and screen readers before release.

## Content rules

- Name the user’s object: `5 files uploaded`, `Sales Q3 import needs review`.
- Explain failure and recovery: `We could not read page 3. Retry extraction or continue without that page.`
- Use direct actions: `Review 12 issues`, `Create dataset`, `Export CSV`.
- Avoid vague system language such as `Operation failed` or `Processing complete` without context.

## Build order

1. App shell, navigation, token layer, buttons, form fields, status badges, and dialog primitives.
2. New import and upload lifecycle for the initial six source types.
3. Import detail and dataset profile, including data-quality review.
4. Home dashboard, analytics dashboard, exports, and alerts.
5. Model workspace, settings, audit log, and direct data connections.

## Acceptance criteria for the first frontend milestone

- A new user can upload CSV, Excel, PDF, DOCX, PNG, and JPEG files from the home page or Imports page.
- Each selected file exposes its file type, size, progress, and individual failure/retry state.
- The application clearly distinguishes structured table imports from document/image extraction.
- Keyboard-only users can complete an upload and reach the post-import review state.
- Loading, empty, warning, failure, and success states are designed for every initial-release screen.
- The UI is responsive and meets WCAG 2.2 AA contrast and focus requirements.
