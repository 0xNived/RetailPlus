import { useEffect, useRef, useState } from "react";
import { Play, CheckCircle2, ChevronDown, Download } from "lucide-react";
import { retailRequest, retailDownload } from "./retailApi";

type Stage = { name: string; status: string; seconds: number | null };
type Job = { id: string; status: string; dataset_id: string | null; stages: Stage[]; error: string | null };
export type Mapping = { fields: string[]; columns: string[]; column_types: Record<string, string>; mapping: Record<string, string>; eligible: boolean; note: string; revision: number };

export function PipelineControl({ token, datasetId, onComplete }: { token: string; datasetId?: string; onComplete?: (id: string) => void }) {
  const [size, setSize] = useState(10000);
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notified = useRef("");
  const complete = useRef(onComplete);
  complete.current = onComplete;

  useEffect(() => {
    let live = true;
    retailRequest<Job[]>(token, "/retail/jobs").then(jobs => {
      const found = jobs.find(item => item.status === "Running" || (datasetId && item.dataset_id === datasetId));
      if (live && found) { notified.current = found.status === "Running" ? "" : found.id; setJob(found); }
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [token, datasetId]);

  useEffect(() => {
    if (!job || job.status !== "Running") return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await retailRequest<Job>(token, `/retail/jobs/${job!.id}`);
        if (!live) return;
        setJob(next);
        setError("");
        if (next.status === "Done" && next.dataset_id && notified.current !== next.id) {
          notified.current = next.id;
          complete.current?.(next.dataset_id);
        }
        if (next.status === "Running") timer = setTimeout(poll, 900);
      } catch (e) {
        if (live) { setError(e instanceof Error ? e.message : "Could not read pipeline status"); timer = setTimeout(poll, 2500); }
      }
    }
    timer = setTimeout(poll, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [token, job?.id, job?.status]);

  async function start() {
    setBusy(true); setError("");
    try {
      const result = await retailRequest<{ id: string }>(token, "/retail/jobs", { method: "POST", body: JSON.stringify({ dataset_id: datasetId || null, size }) });
      setJob({ id: result.id, status: "Running", dataset_id: datasetId || null, stages: [], error: null });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start pipeline"); }
    finally { setBusy(false); }
  }

  const running = busy || job?.status === "Running";
  return <div className="retail-pipeline">
    <div className="retail-action-row">{!datasetId && <label>Demo transactions<select value={size} disabled={running} onChange={e => setSize(Number(e.target.value))}><option value={10000}>10,000 rows</option><option value={50000}>50,000 rows</option><option value={100000}>100,000 rows</option></select></label>}<button className="primary-button" disabled={running} onClick={() => void start()}><Play size={15} />{running ? "Pipeline running…" : datasetId ? "Run full pipeline" : "Generate and run pipeline"}</button>{!datasetId && <small>Fixed seed · synthetic retail data · India / INR</small>}</div>
    {job && <details className="retail-job" open={job.status === "Running" || job.status === "Failed"}><summary><span>{job.status === "Done" && <CheckCircle2 size={15} />} Pipeline {job.status.toLowerCase()}</span><ChevronDown size={14} /></summary><div className="retail-stages">{job.stages.map(stage => <div key={stage.name}><div><span>{stage.name}</span><small>{stage.status}{stage.seconds !== null ? ` · ${stage.seconds.toFixed(2)}s` : ""}</small></div><progress aria-label={`${stage.name}: ${stage.status}`} max={1} value={stage.status === "Done" ? 1 : stage.status === "Running" ? undefined : 0} /></div>)}</div>{job.error && <p role="alert" className="csv-error">{job.error}</p>}</details>}
    {error && <p role="alert" className="csv-error">{error}</p>}
  </div>;
}

export function DatasetTools({ token, id, onRefresh }: { token: string; id: string; onRefresh: () => void }) {
  const [data, setData] = useState<Mapping | null>(null);
  const [versions, setVersions] = useState<{ revision: number; reason: string; created_at: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  function load(initial = false) {
    retailRequest<Mapping>(token, `/retail/datasets/${id}/mapping`).then(result => { setData(result); if (initial) setOpen(result.revision <= 1); }).catch(e => setError(e.message));
    retailRequest<typeof versions>(token, `/retail/datasets/${id}/versions`).then(setVersions).catch(e => setError(e.message));
  }
  useEffect(() => load(true), [token, id]);
  async function save() {
    if (!data) return;
    setSaving(true); setError("");
    try {
      await retailRequest(token, `/retail/datasets/${id}/mapping`, { method: "PUT", body: JSON.stringify({ mapping: data.mapping }) });
      load(); setOpen(false); setMessage("Mapping saved. Run the pipeline to refresh analytics and models.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save mapping"); }
    finally { setSaving(false); }
  }
  async function download(path: string, name: string) {
    try { await retailDownload(token, path, name); } catch (e) { setError(e instanceof Error ? e.message : "Download failed"); }
  }
  return <div className="dataset-retail-tools">
    <details className="retail-mapping" open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>Retail column mapping <small>{data?.note}</small><ChevronDown size={14} /></summary>{data && <><p>Confirm the fields used for retail analytics. IDs, SKUs and postal codes stay as text. Use either a line amount or price × quantity (quantity defaults to 1).</p><div className="retail-mapping-grid">{data.fields.map(field => <label key={field}>{field.replaceAll("_", " ")}<select value={data.mapping[field] || ""} onChange={e => setData({ ...data, mapping: { ...data.mapping, [field]: e.target.value } })}><option value="">Not mapped</option>{data.columns.filter(c => !c.startsWith("_")).map(column => <option key={column} value={column}>{column} - {data.column_types[column]}</option>)}</select></label>)}</div><button className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save mapping"}</button></>}</details>
    <div className="retail-dataset-actions"><PipelineControl token={token} datasetId={id} onComplete={() => { load(); onRefresh(); }} /><details className="retail-versions"><summary>Versions & source <ChevronDown size={14} /></summary><button className="text-button" onClick={() => load()}>Refresh versions</button><button className="text-button" onClick={() => void download(`/retail/datasets/${id}/raw`, "retailplus-raw.csv")}><Download size={14} /> Original source</button>{versions.map(v => <div key={v.revision}><span>v{v.revision} · {v.reason}</span><button onClick={() => void download(`/retail/datasets/${id}/versions/${v.revision}/download`, `retailplus-v${v.revision}.csv`)}>CSV</button><button onClick={() => void download(`/retail/datasets/${id}/versions/${v.revision}/download?kind=parquet`, `retailplus-v${v.revision}.parquet`)}>Parquet</button></div>)}</details></div>
    {message && <p className="retail-note" role="status">{message}</p>}{error && <p className="csv-error" role="alert">{error}</p>}
  </div>;
}
