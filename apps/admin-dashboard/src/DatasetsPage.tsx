import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  Plus,
  Trash2,
} from "lucide-react";
import CsvWorkspace, { type Summary } from "./CsvWorkspace";
import { DatasetTools } from "./RetailControls";
import DeleteDatasetDialog from "./DeleteDatasetDialog";

type Dataset = {
  id: string;
  name: string;
  status: string;
  record_count: number | null;
  updated_at?: string;
  original_name?: string;
};
type DatasetView = "list" | "new" | "detail";
type EditingCell = { row: number; column: string; value: string };
type CellStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  fill_color?: string;
  font_color?: string;
};
type SelectedCell = { row: number; column: string };
const rowHeight = 37;
const windowSize = 100;
const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function DatasetsPage({
  token,
  onSelect,
  onDeleted,
  active = true,
}: {
  token: string;
  onSelect?: (id: string) => void;
  onDeleted?: (id: string) => void;
  active?: boolean;
}) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [view, setView] = useState<DatasetView>("list");
  const [selectedId, setSelectedId] = useState("");
  const [deleting, setDeleting] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDatasets() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/datasets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Could not load datasets");
      setDatasets(await response.json());
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load datasets",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (active && view === "list") void loadDatasets();
  }, [token, active]);

  function showList() {
    void loadDatasets();
    setView("list");
  }

  const deletionDialog = deleting && (
    <DeleteDatasetDialog
      key={`delete-${deleting.id}`}
      token={token}
      dataset={deleting}
      onCancel={() => setDeleting(null)}
      onDeleted={() => {
        onDeleted?.(deleting.id);
        if (selectedId === deleting.id) {
          setSelectedId("");
          setView("list");
        }
        setDeleting(null);
        void loadDatasets();
      }}
    />
  );

  if (view === "new")
    return (
      <CsvWorkspace
        token={token}
        onBack={showList}
        onSaved={(id) => {
          setSelectedId(id);
          onSelect?.(id);
          setView("detail");
        }}
      />
    );
  if (view === "detail")
    return (
      <>
        <DatasetDetail
          key={selectedId}
          token={token}
          id={selectedId}
          onBack={showList}
          onDelete={(dataset) => setDeleting(dataset)}
        />
        {deletionDialog}
      </>
    );

  return (
    <>
      <section className="datasets-page" aria-label="Datasets">
        <div className="datasets-toolbar">
          <div>
            <p className="eyebrow">Workspace data</p>
            <h2>Saved datasets</h2>
            <p>Open a dataset to view and edit its rows.</p>
          </div>
          <button className="primary-button" onClick={() => setView("new")}>
            <Plus size={17} /> Add dataset
          </button>
        </div>
        {error && (
          <p className="csv-error" role="alert">
            {error} <button onClick={() => void loadDatasets()}>Retry</button>
          </p>
        )}
        {loading ? (
          <p className="datasets-note" role="status">
            Loading datasets…
          </p>
        ) : datasets.length ? (
          <div className="datasets-table-wrap">
            <table className="datasets-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Rows</th>
                  <th>State</th>
                  <th>Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td>
                      <span className="dataset-file-icon">
                        <Database size={18} />
                      </span>
                      <span>
                        <strong>{dataset.name}</strong>
                        <small>{dataset.original_name || "CSV source"}</small>
                      </span>
                    </td>
                    <td>{dataset.record_count ?? "—"}</td>
                    <td>
                      <span className="dataset-status">
                        {dataset.status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      {dataset.updated_at
                        ? new Date(dataset.updated_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="dataset-open"
                        onClick={() => {
                          setSelectedId(dataset.id);
                          onSelect?.(dataset.id);
                          setView("detail");
                        }}
                      >
                        Open <ArrowRight size={15} />
                      </button>
                      <button
                        className="dataset-delete"
                        aria-label={`Delete ${dataset.name}`}
                        onClick={() => setDeleting(dataset)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="datasets-empty">
            <Database size={24} />
            <h3>No datasets yet</h3>
            <p>Add a CSV to organize it and save it to this workspace.</p>
            <button className="secondary-button" onClick={() => setView("new")}>
              Add your first dataset <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>
      {deletionDialog}
    </>
  );
}

function DatasetDetail({
  token,
  id,
  onBack,
  onDelete,
}: {
  token: string;
  id: string;
  onBack: () => void;
  onDelete: (dataset: Dataset) => void;
}) {
  const [dataset, setDataset] = useState<
    (Dataset & { summary: Summary }) | null
  >(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [styles, setStyles] = useState<
    Record<string, Record<string, CellStyle>>
  >({});
  const [windowOffset, setWindowOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [formulaValue, setFormulaValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const cancelEdit = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`${apiUrl}/datasets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(
        `${apiUrl}/datasets/${id}/rows?offset=${windowOffset}&limit=${windowSize}`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    ])
      .then(async ([detailResponse, rowsResponse]) => {
        if (!detailResponse.ok || !rowsResponse.ok)
          throw new Error("Could not open this dataset");
        return Promise.all([detailResponse.json(), rowsResponse.json()]);
      })
      .then(([detail, page]) => {
        if (active) {
          setDataset(detail);
          setRows(page.rows);
          setColumns(page.columns);
          setStyles(page.styles || {});
          setTotal(page.total);
          if (!selected && page.rows.length && page.columns.length) {
            setSelected({ row: 0, column: page.columns[0] });
            setFormulaValue(page.rows[0][page.columns[0]] || "");
          }
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, id, windowOffset, refresh]);

  async function sendChange(path: string, method: string, body?: object) {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : "Could not save the change",
      );
    }
    return response.json();
  }

  async function saveCell() {
    if (!editing || saving) return;
    if (cancelEdit.current) {
      cancelEdit.current = false;
      setEditing(null);
      return;
    }
    const current = editing;
    if (current.value === rows[current.row - windowOffset]?.[current.column]) {
      setEditing(null);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await sendChange(`/datasets/${id}/cells`, "PATCH", {
        row_index: current.row,
        column: current.column,
        value: current.value,
      });
      setRows((items) =>
        items.map((row, index) =>
          index + windowOffset === current.row
            ? { ...row, [current.column]: current.value }
            : row,
        ),
      );
      setFormulaValue(current.value);
      setEditing(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save the cell",
      );
    } finally {
      setSaving(false);
    }
  }

  async function addRow() {
    setError("");
    try {
      const result = await sendChange(`/datasets/${id}/rows`, "POST");
      const lastPage =
        Math.floor((result.record_count - 1) / windowSize) * windowSize;
      setWindowOffset(lastPage);
      setRefresh((value) => value + 1);
      requestAnimationFrame(() => {
        if (sheetRef.current)
          sheetRef.current.scrollTop = result.record_count * rowHeight;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not add a row",
      );
    }
  }

  async function deleteRow(rowIndex: number) {
    setError("");
    try {
      await sendChange(`/datasets/${id}/rows/${rowIndex}`, "DELETE");
      if (windowOffset > 0 && total - 1 <= windowOffset)
        setWindowOffset(Math.max(0, windowOffset - windowSize));
      setRefresh((value) => value + 1);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not remove the row",
      );
    }
  }

  function selectCell(row: number, column: string, value: string) {
    setSelected({ row, column });
    setFormulaValue(value);
  }

  async function saveFormulaValue() {
    if (!selected || saving) return;
    const previous = rows[selected.row - windowOffset]?.[selected.column];
    if (previous === undefined || previous === formulaValue) return;
    setSaving(true);
    setError("");
    try {
      await sendChange(`/datasets/${id}/cells`, "PATCH", {
        row_index: selected.row,
        column: selected.column,
        value: formulaValue,
      });
      setRows((items) =>
        items.map((row, index) =>
          index + windowOffset === selected.row
            ? { ...row, [selected.column]: formulaValue }
            : row,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save the cell",
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyStyle(update: CellStyle) {
    if (!selected) return;
    setError("");
    try {
      const result = await sendChange(`/datasets/${id}/cells/style`, "PATCH", {
        row_index: selected.row,
        column: selected.column,
        ...update,
      });
      setStyles((current) => ({
        ...current,
        [selected.row]: {
          ...current[selected.row],
          [selected.column]: result.style,
        },
      }));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not format the cell",
      );
    }
  }

  function handleSheetScroll() {
    if (!sheetRef.current) return;
    const firstRow = Math.max(
      0,
      Math.floor(Math.max(0, sheetRef.current.scrollTop - 37) / rowHeight),
    );
    const nextOffset = Math.floor(firstRow / windowSize) * windowSize;
    if (nextOffset !== windowOffset && nextOffset < total)
      setWindowOffset(nextOffset);
  }

  async function download(kind: "organized" | "changes") {
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/datasets/${id}/download/${kind}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Could not download the CSV");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${dataset?.name || "dataset"}-${kind}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not download the CSV",
      );
    }
  }

  const selectedStyle = selected
    ? (styles[String(selected.row)]?.[selected.column] ?? {})
    : {};
  const selectedAddress = selected
    ? `${columnLetter(columns.indexOf(selected.column))}${selected.row + 2}`
    : "";

  return (
    <section className="dataset-detail">
      <button className="csv-back" onClick={onBack}>
        <ArrowLeft size={16} /> All datasets
      </button>
      {error && (
        <p className="csv-error" role="alert">
          {error}
        </p>
      )}
      {loading && !dataset && <p role="status">Loading dataset…</p>}
      {dataset && (
        <>
          <div className="datasets-toolbar dataset-detail-toolbar">
            <h2>{dataset.name}</h2>
            <div className="csv-downloads">
              <button
                className="secondary-button"
                onClick={() => void download("changes")}
              >
                <Download size={16} /> Change log
              </button>
              <button
                className="secondary-button"
                onClick={() => void download("organized")}
              >
                <Download size={16} /> CSV
              </button>
            </div>
          </div>
          <details className="processing-disclosure">
            <summary>
              <span>
                <CheckCircle2 size={18} /> Data organized
              </span>
              <span>
                {dataset.summary.fixes
                  ? `${dataset.summary.fixes.filled} filled / ${dataset.summary.fixes.casing} casing fixes / `
                  : ""}
                {dataset.summary.exact_duplicates_removed} duplicates removed
                {dataset.summary.fixes
                  ? ` / ${dataset.summary.fixes.invalid} flagged`
                  : ""}{" "}
                <ChevronDown size={16} />
              </span>
            </summary>
            <div className="processing-details">
              {dataset.summary.quality_after && (
                <p>
                  <strong>
                    Quality {dataset.summary.quality_before?.score} to{" "}
                    {dataset.summary.quality_after.score}/100
                  </strong>{" "}
                  / Completeness {dataset.summary.quality_after.completeness}% /
                  Uniqueness {dataset.summary.quality_after.uniqueness}% /
                  Validity {dataset.summary.quality_after.validity}% /{" "}
                  {dataset.summary.processing_seconds}s processing time. This
                  report describes the last cleaning run; edits are recorded as
                  new versions.
                </p>
              )}
              {dataset.summary.invalid_transactions && (
                <p>
                  Invalid transaction rows retained for review:{" "}
                  {dataset.summary.invalid_transactions.rows.join(", ") ||
                    "None"}
                  {dataset.summary.invalid_transactions.truncated
                    ? " (first 100)"
                    : ""}
                  . Row numbers refer to data before duplicate removal.
                </p>
              )}
              {dataset.summary.missing_strategies && (
                <p>
                  {Object.entries(dataset.summary.missing_strategies)
                    .map(([field, strategy]) => `${field}: ${strategy}`)
                    .join(" / ")}
                </p>
              )}
              <p>
                Read as {dataset.summary.source_format.encoding} with{" "}
                {dataset.summary.source_format.delimiter === "tab"
                  ? "tab"
                  : dataset.summary.source_format.delimiter}{" "}
                separator. Likely {dataset.summary.understanding.dataset_type}{" "}
                data.
              </p>
              <div>
                <span>
                  Ingestion <b>Complete</b>
                </span>
                <span>
                  Understanding <b>Complete</b>
                </span>
                <span>
                  Cleaning <b>Complete</b>
                </span>
                <span>
                  Validation <b>Complete</b>
                </span>
              </div>
              <p>
                {Object.values(dataset.summary.missing_values).reduce(
                  (sum, value) => sum + value,
                  0,
                )}{" "}
                missing cells found.{" "}
                {dataset.summary.possible_duplicates.length} possible duplicate
                pairs retained for review. Category discovery is not active yet.
              </p>
            </div>
          </details>
          <button
            className="dataset-delete"
            onClick={() => onDelete(dataset)}
            aria-label={`Delete ${dataset.name}`}
          >
            <Trash2 size={15} /> Delete dataset
          </button>
          <DatasetTools
            token={token}
            id={id}
            onRefresh={() => setRefresh((value) => value + 1)}
          />
          <div className="sheet-toolbar">
            <div className="sheet-tools">
              <button
                type="button"
                className={selectedStyle.bold ? "tool-active" : ""}
                onClick={() => void applyStyle({ bold: !selectedStyle.bold })}
                disabled={!selected}
                title="Bold"
                aria-label="Bold selected cell"
              >
                <b>B</b>
              </button>
              <button
                type="button"
                className={selectedStyle.italic ? "tool-active" : ""}
                onClick={() =>
                  void applyStyle({ italic: !selectedStyle.italic })
                }
                disabled={!selected}
                title="Italic"
                aria-label="Italic selected cell"
              >
                <i>I</i>
              </button>
              <button
                type="button"
                className={selectedStyle.underline ? "tool-active" : ""}
                onClick={() =>
                  void applyStyle({ underline: !selectedStyle.underline })
                }
                disabled={!selected}
                title="Underline"
                aria-label="Underline selected cell"
              >
                <u>U</u>
              </button>
              <span className="sheet-tool-divider" />
              <button
                type="button"
                className={selectedStyle.align === "left" ? "tool-active" : ""}
                onClick={() => void applyStyle({ align: "left" })}
                disabled={!selected}
                title="Align left"
                aria-label="Align left"
              >
                <AlignLeft size={15} />
              </button>
              <button
                type="button"
                className={
                  selectedStyle.align === "center" ? "tool-active" : ""
                }
                onClick={() => void applyStyle({ align: "center" })}
                disabled={!selected}
                title="Align center"
                aria-label="Align center"
              >
                <AlignCenter size={15} />
              </button>
              <button
                type="button"
                className={selectedStyle.align === "right" ? "tool-active" : ""}
                onClick={() => void applyStyle({ align: "right" })}
                disabled={!selected}
                title="Align right"
                aria-label="Align right"
              >
                <AlignRight size={15} />
              </button>
              <span className="sheet-tool-divider" />
              <label className="sheet-color-tool" title="Fill color">
                Fill
                <input
                  type="color"
                  value={selectedStyle.fill_color || "#ffffff"}
                  onChange={(event) =>
                    void applyStyle({ fill_color: event.target.value })
                  }
                  disabled={!selected}
                  aria-label="Selected cell fill color"
                />
              </label>
              <label className="sheet-color-tool" title="Text color">
                Text
                <input
                  type="color"
                  value={selectedStyle.font_color || "#333530"}
                  onChange={(event) =>
                    void applyStyle({ font_color: event.target.value })
                  }
                  disabled={!selected}
                  aria-label="Selected cell text color"
                />
              </label>
            </div>
            <button className="sheet-add-row" onClick={() => void addRow()}>
              <Plus size={15} /> Add row
            </button>
          </div>
          <div className="sheet-formula">
            <span className="sheet-address">{selectedAddress || "A1"}</span>
            <span
              className="sheet-fx"
              title="Edit cell values; formulas are not calculated yet"
            >
              fx
            </span>
            <input
              value={formulaValue}
              onChange={(event) => setFormulaValue(event.target.value)}
              onBlur={() => void saveFormulaValue()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              disabled={!selected}
              aria-label="Selected cell value"
            />
          </div>
          <div
            className="sheet-scroll"
            ref={sheetRef}
            onScroll={handleSheetScroll}
          >
            <table className="sheet-table">
              <thead>
                <tr>
                  <th className="sheet-index">1</th>
                  {columns.map((column, index) => (
                    <th key={column}>
                      <small>{columnLetter(index)}</small>
                      <strong>{column}</strong>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {windowOffset > 0 && (
                  <tr className="sheet-spacer">
                    <td
                      colSpan={columns.length + 1}
                      style={{ height: windowOffset * rowHeight }}
                    />
                  </tr>
                )}
                {rows.map((row, index) => {
                  const rowIndex = windowOffset + index;
                  return (
                    <tr key={rowIndex}>
                      <th className="sheet-index">
                        <span>{rowIndex + 2}</span>
                        <button
                          onClick={() => void deleteRow(rowIndex)}
                          aria-label={`Delete row ${rowIndex + 2}`}
                          title="Delete row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </th>
                      {columns.map((column) => {
                        const cellStyle =
                          styles[String(rowIndex)]?.[column] || {};
                        const isSelected =
                          selected?.row === rowIndex &&
                          selected.column === column;
                        const inferredType =
                          dataset.summary.understanding.likely_field_types[
                            column
                          ];
                        const inferredAlign =
                          inferredType === "numeric-looking text"
                            ? "right"
                            : inferredType === "date-looking text"
                              ? "center"
                              : "left";
                        return (
                          <td
                            key={column}
                            tabIndex={0}
                            aria-label={`Row ${rowIndex + 2}, ${column}: ${row[column] || "empty"}`}
                            title={row[column] ? undefined : "Missing value"}
                            className={`${editing?.row === rowIndex && editing.column === column ? "sheet-editing" : ""} ${isSelected ? "sheet-selected" : ""}`}
                            style={{
                              fontWeight: cellStyle.bold ? 700 : undefined,
                              fontStyle: cellStyle.italic
                                ? "italic"
                                : undefined,
                              textDecoration: cellStyle.underline
                                ? "underline"
                                : undefined,
                              textAlign: cellStyle.align || inferredAlign,
                              backgroundColor:
                                cellStyle.fill_color ||
                                (row[column] ? undefined : "#fff9ed"),
                              color: cellStyle.font_color,
                            }}
                            onClick={() =>
                              selectCell(rowIndex, column, row[column] || "")
                            }
                            onDoubleClick={() => {
                              selectCell(rowIndex, column, row[column] || "");
                              setEditing({
                                row: rowIndex,
                                column,
                                value: row[column] || "",
                              });
                            }}
                            onKeyDown={(event) => {
                              if (
                                (event.key === "Enter" || event.key === "F2") &&
                                !editing
                              )
                                setEditing({
                                  row: rowIndex,
                                  column,
                                  value: row[column] || "",
                                });
                            }}
                          >
                            {editing?.row === rowIndex &&
                            editing.column === column ? (
                              <input
                                autoFocus
                                value={editing.value}
                                onChange={(event) =>
                                  setEditing({
                                    ...editing,
                                    value: event.target.value,
                                  })
                                }
                                onBlur={() => void saveCell()}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  if (event.key === "Enter")
                                    event.currentTarget.blur();
                                  if (event.key === "Escape") {
                                    cancelEdit.current = true;
                                    event.currentTarget.blur();
                                  }
                                }}
                                aria-label={`Edit row ${rowIndex + 2}, ${column}`}
                              />
                            ) : (
                              row[column] || (
                                <span className="sheet-empty">empty</span>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {windowOffset + rows.length < total && (
                  <tr className="sheet-spacer">
                    <td
                      colSpan={columns.length + 1}
                      style={{
                        height:
                          (total - windowOffset - rows.length) * rowHeight,
                      }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="sheet-footer">
            <span>
              {total} data rows · {columns.length} columns
            </span>
            <span>Scroll to browse all rows</span>
          </div>
        </>
      )}
    </section>
  );
}

function columnLetter(index: number): string {
  let label = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  return label;
}
