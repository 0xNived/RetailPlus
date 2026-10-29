import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Search,
  TrendingUp,
  Package,
  IndianRupee,
  ShieldCheck,
} from "lucide-react";
import {
  retailRequest,
  formatNumber as number,
  formatMoney as money,
} from "../retailApi";
import { Card, Empty, Metric, Tabs, SalesChart } from "./components";
import ProductIcon from "./ProductIcon";
import CustomerWorkspace from "./CustomerWorkspace";
import PredictionEvaluation from "./PredictionEvaluation";
import type { ChartRow } from "./types";
import "./predictions.css";

export type PlannedProduct = {
  key: string;
  product_id: string;
  product: string;
  category: string;
  eligible: boolean;
  forecast_units: number | null;
  revenue_plan: number | null;
  average_selling_price: number | null;
  recent_revenue: number;
  last_month_units: number;
  change_percent: number | null;
  direction: string;
  cancellation_rate: number;
  return_rate: number;
  variability: string;
  method: string;
  abc_class: string;
  action: string;
  history: { month: string; units: number; revenue: number; orders: number }[];
  evaluation: {
    method: string;
    label: string;
    periods: number;
    mae_units: number | null;
    wape_percent: number | null;
    bias_units: number | null;
  }[];
};
type Plan = {
  available: boolean;
  currency: string;
  as_of: string;
  target_month: string;
  basis_start: string;
  basis_end: string;
  note: string;
  revision: number;
  categories: string[];
  summary: {
    products: number;
    eligible_products: number;
    forecast_units: number;
    revenue_plan: number;
    priority_products: number;
  };
  products: PlannedProduct[];
  total: number;
  offset: number;
  selected: PlannedProduct | null;
};

export default function PredictionsWorkspace({
  token,
  id,
}: {
  token: string;
  id: string;
}) {
  const [tab, setTab] = useState("Product planning");
  return (
    <section className="rp-workspace rp-predictions">
      <p className="rp-planning-intro">
        Plan product demand. Prioritize the customers worth a check-in.
      </p>
      <Tabs
        tabs={["Product planning", "Customer retention", "Model evaluation"]}
        active={tab}
        onChange={setTab}
        label="Prediction views"
      />
      {tab === "Product planning" ? (
        <ProductPlanning token={token} id={id} />
      ) : tab === "Customer retention" ? (
        <CustomerWorkspace token={token} id={id} />
      ) : (
        <PredictionEvaluation token={token} id={id} />
      )}
    </section>
  );
}

function ProductPlanning({ token, id }: { token: string; id: string }) {
  const [data, setData] = useState<Plan | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<PlannedProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      dataset_id: id,
      search: query,
      category,
      offset: String(offset),
      limit: "25",
    });
    retailRequest<Plan>(token, `/retail/product-planning?${params}`)
      .then((result) => {
        if (live) {
          setData(result);
          setSelected(null);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [token, id, query, category, offset]);
  const month = data?.target_month
    ? new Date(`${data.target_month}-01T00:00:00`).toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
      })
    : "Next month";
  return (
    <>
      {error && (
        <p className="csv-error" role="alert">
          {error}
        </p>
      )}
      {data?.available && (
        <>
          <div className="rp-plan-heading">
            <div>
              <h2>{month} planning</h2>
              <p>
                Data through {data.as_of} · revision {data.revision}. Completed
                months {data.basis_start} to {data.basis_end} inform the
                baseline.
              </p>
            </div>
            <span className="rp-plan-label">
              <ShieldCheck size={14} /> Historical checks included
            </span>
          </div>
          <div className="rp-plan-metrics">
            <Metric
              label="Demand plan"
              value={`${number(data.summary.forecast_units, 1)} units`}
              detail={`${data.summary.eligible_products} products with enough history`}
              icon={<Package size={17} />}
              tone="sage"
            />
            <Metric
              label="Revenue at recent prices"
              value={money(data.summary.revenue_plan, 0, data.currency)}
              detail="Demand × recent realized selling price"
              icon={<IndianRupee size={17} />}
              tone="orange"
            />
            <Metric
              label="A-class products"
              value={number(data.summary.priority_products)}
              detail="Products contributing the first 80% of recent revenue"
              icon={<TrendingUp size={17} />}
              tone="purple"
            />
          </div>
          <Card
            title="Find a product"
            subtitle="Search every saved product or SKU. Open one for demand, revenue, order quality and stock planning."
          >
            <div className="rp-plan-filters">
              <label className="rp-search">
                <Search size={16} />
                <input
                  aria-label="Search product predictions"
                  placeholder="Product name or SKU…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                aria-label="Product planning category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All categories</option>
                {data.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            {loading ? (
              <p className="rp-plan-note" role="status">
                Updating product plans…
              </p>
            ) : (
              <div className="rp-data-scroll">
                <table className="rp-table rp-plan-table">
                  <thead>
                    <tr>
                      <th>Product / SKU</th>
                      <th>{month} demand</th>
                      <th>Revenue plan</th>
                      <th>Sales momentum</th>
                      <th>Priority</th>
                      <th>Next action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.products.map((p) => (
                      <tr
                        key={p.key}
                        className={selected?.key === p.key ? "is-selected" : ""}
                      >
                        <td>
                          <button
                            className="rp-plan-product"
                            onClick={() => setSelected(p)}
                            aria-label={`Plan ${p.product}`}
                          >
                            <ProductIcon
                              product={p.product}
                              category={p.category}
                            />
                            <span>
                              <strong>{p.product}</strong>
                              <small>
                                {p.product_id || "Name-based product"} ·{" "}
                                {p.category}
                              </small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <strong>
                            {p.forecast_units === null
                              ? "Needs history"
                              : `${number(p.forecast_units, 1)} units`}
                          </strong>
                          <small>{p.method}</small>
                        </td>
                        <td>
                          {p.revenue_plan === null
                            ? "—"
                            : money(p.revenue_plan, 0, data.currency)}
                        </td>
                        <td>
                          <span
                            className={`rp-plan-momentum ${p.direction.toLowerCase()}`}
                          >
                            {p.direction}
                          </span>
                          <small>
                            {p.change_percent === null
                              ? "No prior-month comparison"
                              : `${p.change_percent > 0 ? "+" : ""}${p.change_percent}% month on month`}
                          </small>
                        </td>
                        <td>
                          <span className={`rp-abc rp-abc-${p.abc_class}`}>
                            {p.abc_class}
                          </span>
                        </td>
                        <td>
                          <button
                            className="rp-plan-action"
                            onClick={() => setSelected(p)}
                          >
                            {p.action}
                            <ArrowRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.products.length && (
                  <Empty title="No matching products">
                    Try a different name, SKU or category.
                  </Empty>
                )}
              </div>
            )}
            <div className="rp-pagination">
              <span>
                {data.total
                  ? `${offset + 1}–${Math.min(offset + 25, data.total)}`
                  : "0"}{" "}
                of {number(data.total)} products
              </span>
              <div>
                <button
                  className="rp-button"
                  disabled={!offset || loading}
                  onClick={() => setOffset((v) => Math.max(0, v - 25))}
                >
                  Previous
                </button>
                <button
                  className="rp-button"
                  disabled={offset + 25 >= data.total || loading}
                  onClick={() => setOffset((v) => v + 25)}
                >
                  Next
                </button>
              </div>
            </div>
          </Card>
          {selected && (
            <ProductDetail
              key={selected.key}
              product={selected}
              currency={data.currency}
              month={month}
            />
          )}
          <details className="rp-plan-method">
            <summary>How to read these business measures</summary>
            <dl>
              <dt>Demand plan</dt>
              <dd>
                Units projected using a 3-month average or the last complete
                month. The method with lower historical mean absolute error is
                selected when at least three rolling checks exist.
              </dd>
              <dt>Revenue plan / average selling price</dt>
              <dd>
                Projected units × completed revenue per unit over the last three
                complete months. This is revenue, not profit; product costs are
                not available.
              </dd>
              <dt>ABC classification</dt>
              <dd>
                Ranked by the last three complete months’ completed revenue. A
                covers the first 80%, B the next 15%, C the remainder. The
                product crossing a threshold stays in the preceding class.
              </dd>
              <dt>Cancellation / return rate</dt>
              <dd>
                Distinct cancelled or returned orders divided by all valid
                orders for that product in the three complete months.
              </dd>
              <dt>MAE / WAPE / bias</dt>
              <dd>
                MAE is average absolute unit error; WAPE is total absolute error
                / total actual units. Positive bias means overforecasting. Zero
                actual demand has no WAPE. Up to six past periods are checked
                with the same two-month horizon as this plan.
              </dd>
            </dl>
            <p>{data.note}</p>
          </details>
        </>
      )}
      {!data && loading && <p role="status">Calculating product plans…</p>}
      {data && !data.available && (
        <Empty title="More sales history is needed">{data.note}</Empty>
      )}
    </>
  );
}

function ProductDetail({
  product: p,
  currency,
  month,
}: {
  product: PlannedProduct;
  currency: string;
  month: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);
  const [stock, setStock] = useState("");
  const [incoming, setIncoming] = useState("");
  const [lead, setLead] = useState("7");
  const [buffer, setBuffer] = useState("7");
  const valid =
    stock !== "" &&
    incoming !== "" &&
    [stock, incoming, lead, buffer].every(
      (v) =>
        v !== "" &&
        Number.isFinite(Number(v)) &&
        Number(v) >= 0 &&
        Number.isInteger(Number(v)),
    ) &&
    Number(lead) + Number(buffer) <= 365;
  const daily = (p.forecast_units || 0) / 30;
  const target = Math.ceil(daily * (Number(lead) + Number(buffer)));
  const reorder =
    valid && p.eligible
      ? Math.max(0, target - Number(stock) - Number(incoming))
      : null;
  const rows: ChartRow[] = p.history.map((r) => ({
    order_date: `${r.month}-01`,
    revenue: r.revenue,
    orders: r.orders,
  }));
  return (
    <div
      className="rp-product-detail"
      ref={root}
      aria-label="Selected product plan"
    >
      <div className="rp-plan-heading">
        <div>
          <span className="rp-plan-eyebrow">
            PRODUCT PLAN · {p.product_id || "NO SKU"}
          </span>
          <h2>{p.product}</h2>
          <p>
            {p.category} · {month} · {p.action}
          </p>
        </div>
        <ProductIcon product={p.product} category={p.category} size={32} />
      </div>
      <div className="rp-plan-detail-grid">
        <Card
          title="Demand & order health"
          subtitle={`${p.method}. Recent demand variability: ${p.variability.toLowerCase()}.`}
        >
          <div className="rp-plan-facts">
            <div>
              <span>Planned units</span>
              <strong>
                {p.forecast_units === null
                  ? "Insufficient history"
                  : number(p.forecast_units, 1)}
              </strong>
            </div>
            <div>
              <span>Revenue plan</span>
              <strong>
                {p.revenue_plan === null
                  ? "—"
                  : money(p.revenue_plan, 0, currency)}
              </strong>
            </div>
            <div>
              <span>Realized price / unit</span>
              <strong>
                {p.average_selling_price === null
                  ? "—"
                  : money(p.average_selling_price, 2, currency)}
              </strong>
            </div>
            <div>
              <span>Cancellations / returns</span>
              <strong>
                {p.cancellation_rate}% / {p.return_rate}%
              </strong>
            </div>
          </div>
          <div className="rp-unit-history" aria-label="Recent monthly units">
            {p.history.slice(-6).map((row) => (
              <div key={row.month}>
                <span>
                  {new Date(`${row.month}-01T00:00:00`).toLocaleDateString(
                    "en-IN",
                    { month: "short" },
                  )}
                </span>
                <b>{number(row.units)}</b>
                <small>units sold</small>
              </div>
            ))}
          </div>
          <SalesChart rows={rows} currency={currency} />
        </Card>
        <Card
          title="Purchase quantity calculator"
          subtitle="Enter actual stock figures. No inventory is inferred from sales."
        >
          <div className="rp-stock-inputs">
            {[
              ["On hand", stock, setStock],
              ["Incoming units", incoming, setIncoming],
              ["Supplier lead time (days)", lead, setLead],
              ["Buffer coverage (days)", buffer, setBuffer],
            ].map(([label, value, setter]) => (
              <label key={String(label)}>
                {String(label)}
                <input
                  aria-label={String(label)}
                  type="number"
                  min="0"
                  max={String(label).includes("days") ? 365 : undefined}
                  step="1"
                  value={String(value)}
                  onChange={(e) =>
                    (setter as (v: string) => void)(e.target.value)
                  }
                />
              </label>
            ))}
          </div>
          <div className="rp-reorder-result">
            <span>Suggested purchase quantity</span>
            <strong>
              {reorder === null
                ? "Enter your stock"
                : `${number(reorder)} units`}
            </strong>
            <p>
              {valid
                ? `Cover ${Number(lead) + Number(buffer)} days at ${number(daily, 2)} units/day. Target stock: ${number(target)} units.`
                : "Enter non-negative whole-number stock and incoming units; total lead + buffer must be 365 days or less."}
            </p>
          </div>
          <p className="rp-plan-note">
            max(0, demand / 30 × (lead time + buffer days) − on hand −
            incoming), target rounded up. Planning aid only; buffer days are
            your assumption, not statistical safety stock. Fractional units are
            planning averages.
          </p>
        </Card>
      </div>
      <Card
        title="Historical forecast checks"
        subtitle="Compare unit error across the same two-month planning horizon."
      >
        <div className="rp-data-scroll">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Baseline</th>
                <th>Periods checked</th>
                <th>MAE (units)</th>
                <th>WAPE</th>
                <th>Bias (units)</th>
              </tr>
            </thead>
            <tbody>
              {p.evaluation.map((e) => (
                <tr key={e.method}>
                  <td>
                    {e.label}
                    {p.method === e.label ? " · used" : ""}
                  </td>
                  <td>{e.periods}</td>
                  <td>
                    {e.mae_units === null
                      ? "Not enough history"
                      : number(e.mae_units, 2)}
                  </td>
                  <td>
                    {e.wape_percent === null ? "—" : `${e.wape_percent}%`}
                  </td>
                  <td>
                    {e.bias_units === null ? "—" : number(e.bias_units, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
