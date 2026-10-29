import { ChangeEvent, DragEvent, useState } from "react";
import { ArrowLeft, ArrowRight, FileSpreadsheet, UploadCloud } from "lucide-react";
import { PipelineControl } from "./RetailControls";

export type Summary = {
  original_rows: number;
  organized_rows: number;
  exact_duplicates_removed: number;
  missing_values: Record<string, number>;
  field_matches: { source: string; target: string; confidence: number; applied: boolean }[];
  possible_duplicates: { row_a: number; row_b: number; field: string; similarity: number }[];
  columns: string[];
  source_format: { encoding: string; delimiter: string };
  understanding: { dataset_type: string; likely_field_types: Record<string, string>; suggested_missing_fields: string[] };
  change_count: number;
  quality_before?: { score: number; completeness: number; uniqueness: number; validity: number };
  quality_after?: { score: number; completeness: number; uniqueness: number; validity: number; mostly_missing: string[] };
  fixes?: { filled: number; casing: number; invalid: number };
  invalid_transactions?: { count: number; rows: number[]; truncated: boolean };
  missing_strategies?: Record<string, string>;
  processing_seconds?: number;
};

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function CsvWorkspace({ token, onBack, onSaved }: { token: string; onBack: () => void; onSaved: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState("");

  function chooseFile(nextFile: File | null) {
    setFile(nextFile);
    setError("");
    setPhase("idle");
    setUploadPercent(0);
  }

  function dropFile(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    chooseFile(event.dataTransfer.files[0] ?? null);
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0] ?? null);
  }

  function analyzeFile() {
    if (!file || phase !== "idle") return;
    setError("");
    setPhase("uploading");
    const request = new XMLHttpRequest();
    request.open("POST", `${apiUrl}/datasets/import`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.upload.onprogress = event => {
      if (event.lengthComputable) setUploadPercent(Math.round(event.loaded / event.total * 100));
    };
    request.upload.onload = () => setPhase("processing");
    request.onload = () => {
      try {
        const result = JSON.parse(request.responseText);
        if (request.status !== 201) throw new Error(typeof result.detail === "string" ? result.detail : "The dataset could not be processed");
        onSaved(result.dataset.id);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "The dataset could not be processed");
        setPhase("idle");
      }
    };
    request.onerror = () => { setError("The connection failed. Please try again."); setPhase("idle"); };
    const body = new FormData();
    body.append("file", file);
    request.send(body);
  }

  return <section className="csv-page" aria-label="Add dataset"><div className="csv-content">
    <button className="csv-back" onClick={onBack}><ArrowLeft size={16} /> All datasets</button>
    <div className="csv-heading"><p className="eyebrow">New dataset</p><h2>Add a CSV dataset</h2><p>Drop or attach a file. RetailPlus will organize it and open the saved rows for review.</p></div>
    <section className="csv-upload" onDragOver={event => event.preventDefault()} onDrop={dropFile}><span className="csv-icon"><UploadCloud size={22} /></span><div><h2>Drop a CSV here or attach a file</h2><p>Up to 50 MB, 100,000 rows, and 100 columns. Map your customer, product, store and location fields after upload.</p></div><label className="secondary-button">Browse CSV<input type="file" accept=".csv,text/csv" onChange={selectFile} /></label></section>
    {file && <div className="csv-selected"><FileSpreadsheet size={18} /><span>{file.name}</span><small>{(file.size / 1024).toFixed(1)} KB</small><button className="primary-button" onClick={analyzeFile} disabled={phase !== "idle"}>{phase === "idle" ? "Add dataset" : "Processing…"}<ArrowRight size={16} /></button></div>}
    {error && <p className="csv-error" role="alert">{error}</p>}
    {phase !== "idle" && <div className="import-progress" role="status" aria-live="polite"><div><strong>{phase === "uploading" ? "Uploading source file" : "Organizing dataset"}</strong><span>{phase === "uploading" ? `${uploadPercent}% uploaded` : "Reading, cleaning, and validating rows"}</span></div><div className={`import-progress-track ${phase === "processing" ? "import-progress-indeterminate" : ""}`}><i style={phase === "uploading" ? { width: `${uploadPercent}%` } : undefined} /></div><p>The dataset table will open when processing finishes.</p></div>}
    {phase === "idle" && <section className="retail-generator"><p className="eyebrow">Try a retail dataset</p><h3>Customers, SKUs and stores. Ready to explore.</h3><p>Generate reproducible transactions with purchase patterns, missing values, duplicates and invalid orders. The pipeline cleans, analyzes and trains real churn models.</p><PipelineControl token={token} onComplete={onSaved} /></section>}
  </div></section>;
}
