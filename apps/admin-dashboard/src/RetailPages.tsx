import { useEffect, useState } from "react";
import { ArrowRight, Pause, Play, RefreshCw } from "lucide-react";
import { PipelineControl, type Mapping } from "./RetailControls";
import {
  retailRequest,
  formatNumber as number,
  formatMoney,
} from "./retailApi";
import LearningPages from "./RetailLearning";
import AnalyticsWorkspace from "./retail/AnalyticsWorkspace";
import CustomerWorkspace from "./retail/CustomerWorkspace";
import PredictionsWorkspace from "./retail/PredictionsWorkspace";

export type RetailPage =
  | "analytics"
  | "customers"
  | "predictions"
  | "simulation"
  | "architecture"
  | "status";
type Dataset = { id: string; name: string; record_count: number };
type Row = Record<string, string | number>;
export default function RetailPages({
  page,
  token,
  datasetId,
  onSelect,
}: {
  page: RetailPage;
  token: string;
  datasetId: string;
  onSelect: (id: string) => void;
}) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    retailRequest<Dataset[]>(token, "/datasets")
      .then((list) => {
        if (live) {
          setDatasets(list);
          if (!list.some((d) => d.id === datasetId))
            onSelect(list[0]?.id || "");
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token, page, refresh]);
  useEffect(() => {
    let live = true;
    setMapping(null);
    setError("");
    if (datasetId)
      retailRequest<Mapping>(token, `/retail/datasets/${datasetId}/mapping`)
        .then((result) => {
          if (live) setMapping(result);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [token, datasetId, refresh]);

  if (page === "architecture" || page === "status")
    return <LearningPages page={page} token={token} datasetId={datasetId} />;
  const needsCustomers = page === "customers" || page === "simulation";
  return (
    <section className="retail-page">
      <div className="retail-page-toolbar">
        <label>
          Dataset
          <select
            aria-label="Active retail dataset"
            value={datasetId}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="">Choose a dataset</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {number(d.record_count)} rows
              </option>
            ))}
          </select>
        </label>
        <button
          className="text-button"
          onClick={() => setRefresh((v) => v + 1)}
          aria-label="Refresh retail data"
        >
          <RefreshCw size={16} />
        </button>
        {datasetId && page === "predictions" && (
          <PipelineControl
            token={token}
            datasetId={datasetId}
            onComplete={() => setRefresh((v) => v + 1)}
          />
        )}
      </div>
      {error && (
        <p className="csv-error" role="alert">
          {error}
        </p>
      )}
      {!datasetId ? (
        <div className="retail-empty">
          <h2>Start with your retail data.</h2>
          <p>
            Add a CSV or generate transactions in Datasets to explore customers,
            products and stores.
          </p>
        </div>
      ) : !mapping && !error ? (
        <p role="status">Reading dataset mapping…</p>
      ) : needsCustomers && !mapping?.eligible ? (
        <div className="retail-empty" aria-disabled="true">
          <h2>This dataset needs a few more fields.</h2>
          <p>Needs customer ID, date and amount columns.</p>
          <p>Open the dataset and confirm its column mapping.</p>
        </div>
      ) : (
        mapping && (
          <div key={`${datasetId}-${refresh}`}>
            {page === "analytics" ? (
              <AnalyticsWorkspace token={token} id={datasetId} />
            ) : page === "customers" ? (
              <CustomerWorkspace token={token} id={datasetId} />
            ) : page === "predictions" ? (
              <PredictionsWorkspace token={token} id={datasetId} />
            ) : (
              <Simulation token={token} id={datasetId} />
            )}
          </div>
        )
      )}
    </section>
  );
}

export function Bars({
  title,
  rows,
  label,
  value = "revenue",
}: {
  title: string;
  rows: Row[];
  label: string;
  value?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(Number(row[value]))));
  return (
    <article className="retail-card">
      <h3>{title}</h3>
      {!rows.length && <p className="retail-note">No matching data.</p>}
      <div className="retail-bars">
        {rows.map((row, index) => (
          <div key={index}>
            <div>
              <span title={String(row[label])}>{row[label] || "Unknown"}</span>
              <strong>{number(Number(row[value]), 2)}</strong>
            </div>
            <div className="retail-bar-track">
              <i
                style={{
                  width: `${(Math.abs(Number(row[value])) / max) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function LineChart({
  rows,
  label = "order_date",
  value = "revenue",
  title,
}: {
  rows: Row[];
  label?: string;
  value?: string;
  title: string;
}) {
  const width = 720,
    height = 210;
  const max = Math.max(1, ...rows.map((row) => Number(row[value])));
  const points = rows
    .map(
      (row, i) =>
        `${35 + (i / Math.max(1, rows.length - 1)) * (width - 60)},${height - 30 - (Number(row[value]) / max) * (height - 60)}`,
    )
    .join(" ");
  return (
    <div className="retail-line">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title}. ${rows.length} observations. Maximum ${number(max, 2)}.`}
      >
        <title>{title}</title>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="35"
              x2={width - 25}
              y1={height - 30 - t * (height - 60)}
              y2={height - 30 - t * (height - 60)}
              stroke="#e6e7e2"
            />
            <text
              x="35"
              y={height - 36 - t * (height - 60)}
              fill="#7a7c74"
              fontSize="10"
            >
              {number(max * t)}
            </text>
          </g>
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="#358368"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {rows.length > 0 && (
          <>
            <text x="35" y={height - 8} fill="#7a7c74" fontSize="11">
              {String(rows[0][label]).slice(0, 10)}
            </text>
            <text
              textAnchor="end"
              x={width - 25}
              y={height - 8}
              fill="#7a7c74"
              fontSize="11"
            >
              {String(rows[rows.length - 1][label]).slice(0, 10)}
            </text>
          </>
        )}
      </svg>
      {!rows.length && (
        <p className="retail-note">No matching sales in this view.</p>
      )}
      <details className="retail-chart-data">
        <summary>View chart data</summary>
        <DataTable rows={rows} fields={[label, value]} />
      </details>
    </div>
  );
}

function DataTable({
  rows,
  fields,
  onRow,
}: {
  rows: Row[];
  fields: string[];
  onRow?: (row: Row) => void;
}) {
  return (
    <div className="retail-table-scroll">
      <table className="retail-table">
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field}>{field.replaceAll("_", " ")}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {fields.map((field, j) => (
                <td key={field}>
                  {onRow && j === 0 ? (
                    <button className="text-button" onClick={() => onRow(row)}>
                      {row[field]}
                    </button>
                  ) : typeof row[field] === "number" ? (
                    number(Number(row[field]), 2)
                  ) : (
                    String(row[field] ?? "—")
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="retail-note">No matching records.</p>}
    </div>
  );
}

function Simulation({ token, id }: { token: string; id: string }) {
  const [samples, setSamples] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [feed, setFeed] = useState<Row[]>([]);
  const [series, setSeries] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, orders: 0 });
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    retailRequest<{ transactions: Row[] }>(
      token,
      `/retail/simulation/sample?dataset_id=${id}`,
    )
      .then((result) => {
        if (live) setSamples(result.transactions);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token, id]);
  useEffect(() => {
    if (!running || !samples.length) return;
    let index = 0;
    const timer = setInterval(() => {
      const source = samples[index++ % samples.length];
      const timestamp = new Date().toLocaleTimeString();
      setTotals((previous) => ({
        revenue: previous.revenue + Number(source.amount),
        orders: previous.orders + 1,
      }));
      setFeed((previous) =>
        [
          { ...source, order_id: `SIM-${Date.now()}`, arrived: timestamp },
          ...previous,
        ].slice(0, 20),
      );
      setSeries((previous) =>
        [
          ...previous,
          { arrived: timestamp, revenue: Number(source.amount) },
        ].slice(-60),
      );
    }, 1000 / speed);
    return () => clearInterval(timer);
  }, [running, speed, samples]);
  return (
    <>
      <article className="retail-card">
        <p className="eyebrow">
          Simulated stream (Kafka-style architecture demo)
        </p>
        <h3>A live retail counter</h3>
        <p className="retail-note">
          Replays valid completed transaction samples as synthetic arrivals.
          Counters belong to this session. This demo does not connect to Kafka
          or modify the dataset.
        </p>
        <div className="retail-action-row">
          <button
            className="primary-button"
            disabled={!samples.length}
            onClick={() => setRunning((v) => !v)}
          >
            {running ? <Pause size={15} /> : <Play size={15} />}
            {running ? "Stop" : "Start"}
          </button>
          <label>
            Speed · {speed} transactions / second
            <input
              aria-label="Simulation transactions per second"
              type="range"
              min="1"
              max="20"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
          </label>
          <span role="status">{running ? "Streaming" : "Stopped"}</span>
        </div>
        {error && <p className="csv-error">{error}</p>}
        <div className="retail-kpis">
          <article>
            <span>Simulated revenue</span>
            <strong>{formatMoney(totals.revenue, 2)}</strong>
          </article>
          <article>
            <span>Simulated orders</span>
            <strong>{number(totals.orders)}</strong>
          </article>
        </div>
        <LineChart
          rows={series}
          label="arrived"
          title="Incoming transaction values"
        />
      </article>
      <article className="retail-card">
        <h3>Activity feed</h3>
        <DataTable
          rows={feed}
          fields={[
            "arrived",
            "order_id",
            "customer_id",
            "product",
            "amount",
            "city",
          ]}
        />
      </article>
    </>
  );
}
