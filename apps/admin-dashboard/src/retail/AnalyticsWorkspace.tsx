import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BadgeDollarSign,
  Box,
  Check,
  Download,
  Filter,
  ShoppingBag,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import {
  retailDownload,
  retailRequest,
  formatNumber as number,
  formatMoney,
} from "../retailApi";
import {
  BehaviorChart,
  Card,
  Donut,
  Empty,
  Metric,
  RankedBars,
  SalesChart,
  Tabs,
  dateLabel,
  palette,
  shortNumber,
} from "./components";
import type { Analysis } from "./types";
import ProductIcon from "./ProductIcon";
import ProductOutlook from "./ProductOutlook";

const emptyFilters = {
  start: "",
  end: "",
  category: "",
  state: "",
  city: "",
  country: "",
  store_id: "",
  customer_id: "",
};

export default function AnalyticsWorkspace({
  token,
  id,
}: {
  token: string;
  id: string;
}) {
  const [tab, setTab] = useState("Overview");
  const [filters, setFilters] = useState<Record<string, string>>(emptyFilters);
  const [expanded, setExpanded] = useState(false);
  const [interval, setInterval] = useState("monthly");
  const [metric, setMetric] = useState("revenue");
  const [region, setRegion] = useState("city");
  const [productMode, setProductMode] = useState("best");
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const params = new URLSearchParams({
    dataset_id: id,
    interval,
    ...filters,
  }).toString();
  const activeFilters = Object.entries(filters).filter(([, value]) => value);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      retailRequest<Analysis>(token, `/retail/analytics?${params}`)
        .then((result) => {
          if (live) setData(result);
        })
        .catch((e) => {
          if (live) {
            setError(e.message);
            setData(null);
          }
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token, params]);

  async function download(kind: "csv" | "pdf") {
    setExporting(true);
    setError("");
    try {
      await retailDownload(
        token,
        `/retail/report?${params}&kind=${kind}`,
        `retailplus-report.${kind}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setExporting(false);
    }
  }

  const money = (value: number, decimals = 0) =>
    formatMoney(value, decimals, data?.currency || "INR");
  const products = data
    ? productMode === "best"
      ? data.best_products
      : data.least_products
    : [];
  const regions = data
    ? region === "city"
      ? data.cities
      : region === "state"
        ? data.states
        : data.stores
    : [];
  return (
    <div className="rp-workspace rp-analytics">
      <div className="rp-section-top">
        <Tabs
          tabs={["Overview", "Products", "Insights", "Reports"]}
          active={tab}
          onChange={setTab}
          label="Analytics views"
        />
        <button
          className="rp-button"
          disabled={exporting || !data || loading}
          onClick={() => void download("csv")}
        >
          <Download size={14} />
          Export report
        </button>
      </div>
      <div className="rp-filterbar">
        <div className="rp-date-range">
          <Filter size={14} />
          <label>
            <span className="sr-only">Start date</span>
            <input
              aria-label="Start date"
              type="date"
              value={filters.start}
              onChange={(e) =>
                setFilters({ ...filters, start: e.target.value })
              }
            />
          </label>
          <span>—</span>
          <label>
            <span className="sr-only">End date</span>
            <input
              aria-label="End date"
              type="date"
              value={filters.end}
              onChange={(e) => setFilters({ ...filters, end: e.target.value })}
            />
          </label>
        </div>
        <select
          aria-label="Filter category"
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        >
          <option value="">All categories</option>
          {data?.options.category?.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <button
          className={`rp-button ${expanded ? "is-selected" : ""}`}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={14} />
          More filters
          {activeFilters.length > 0 && (
            <span className="rp-count">{activeFilters.length}</span>
          )}
        </button>
        <span className="rp-period">
          {loading
            ? "Updating view…"
            : data?.period.start && data.period.end
              ? `${dateLabel(data.period.start, true)} – ${dateLabel(data.period.end, true)}`
              : "No matching activity"}
        </span>
      </div>
      {expanded && (
        <div className="rp-expanded-filters">
          {["state", "city", "country", "store_id"].map((field) => (
            <label key={field}>
              {field.replaceAll("_", " ")}
              <select
                value={filters[field]}
                onChange={(e) =>
                  setFilters({ ...filters, [field]: e.target.value })
                }
              >
                <option value="">All</option>
                {data?.options[field]?.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Customer ID
            <input
              placeholder="Exact customer ID"
              value={filters.customer_id}
              onChange={(e) =>
                setFilters({ ...filters, customer_id: e.target.value })
              }
            />
          </label>
        </div>
      )}
      {activeFilters.length > 0 && (
        <div className="rp-filter-chips">
          {activeFilters.map(([key, value]) => (
            <button
              key={key}
              onClick={() => setFilters({ ...filters, [key]: "" })}
            >
              {key.replaceAll("_", " ")}: {value}
              <X size={12} />
            </button>
          ))}
          <button className="rp-link" onClick={() => setFilters(emptyFilters)}>
            Clear all
          </button>
        </div>
      )}
      {error && (
        <div className="rp-error" role="alert">
          {error}
        </div>
      )}
      {!data ? (
        loading ? (
          <div
            className="rp-skeleton"
            role="status"
            aria-label="Loading analytics"
          >
            <div />
            <div />
            <div />
          </div>
        ) : (
          <Empty title="Analytics isn’t ready yet">
            Confirm the date and amount mapping in Datasets.
          </Empty>
        )
      ) : (
        <div aria-busy={loading} className={loading ? "rp-updating" : ""}>
          {tab === "Overview" ? (
            <>
              <div className="rp-metrics six">
                <Metric
                  label="Total revenue"
                  value={money(data.kpis.revenue, 2)}
                  detail="Completed sales"
                  icon={<BadgeDollarSign size={15} />}
                  tone="orange"
                  spark={data.trend.map((r) => Number(r.revenue))}
                />
                <Metric
                  label="Total orders"
                  value={number(data.kpis.orders)}
                  detail="Across valid statuses"
                  icon={<ShoppingBag size={15} />}
                  spark={data.trend.map((r) => Number(r.orders))}
                />
                <Metric
                  label="Customers"
                  value={number(data.kpis.customers)}
                  detail="Unique customer IDs"
                  icon={<UsersRound size={15} />}
                />
                <Metric
                  label="Products"
                  value={number(data.kpis.products)}
                  detail="Unique products / SKUs"
                  icon={<Box size={15} />}
                />
                <Metric
                  label="Avg. order value"
                  value={money(data.kpis.average_order_value, 2)}
                  detail="Per completed order"
                />
                <Metric
                  label="Cancellation rate"
                  value={`${data.kpis.cancellation_rate}%`}
                  detail="Cancelled / valid orders"
                  tone="purple"
                />
              </div>
              <div className="rp-analytics-grid">
                <Card
                  title="Sales overview"
                  subtitle="A closer look at the revenue behind your orders"
                  className="rp-sales-card"
                  action={
                    <div
                      className="rp-segmented"
                      aria-label="Sales chart metric"
                    >
                      <button
                        aria-pressed={metric === "revenue"}
                        onClick={() => setMetric("revenue")}
                      >
                        Revenue
                      </button>
                      <button
                        aria-pressed={metric === "orders"}
                        onClick={() => setMetric("orders")}
                      >
                        Orders
                      </button>
                    </div>
                  }
                >
                  <div className="rp-sales-summary">
                    <div>
                      <strong>
                        {(metric === "revenue" ? money : number)(
                          metric === "revenue"
                            ? data.kpis.revenue
                            : data.trend.reduce(
                                (sum, row) => sum + Number(row.orders),
                                0,
                              ),
                          metric === "revenue" ? 2 : 0,
                        )}
                      </strong>
                      <span>
                        {metric === "revenue"
                          ? "in completed sales"
                          : "completed orders"}
                      </span>
                    </div>
                    <select
                      aria-label="Sales trend interval"
                      value={interval}
                      onChange={(e) => setInterval(e.target.value)}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <SalesChart
                    rows={data.trend}
                    metric={metric}
                    currency={data.currency || "INR"}
                  />
                </Card>
                <Card
                  title="Top selling categories"
                  subtitle="Share of completed revenue"
                  className="rp-categories-card"
                  info="Percentages use total revenue in this filtered view. Select a category to filter the entire dashboard."
                >
                  <RankedBars
                    rows={data.categories.slice(0, 6)}
                    label="category"
                    currency={data.currency || "INR"}
                    total={data.kpis.revenue}
                    onSelect={(value) =>
                      setFilters({ ...filters, category: value })
                    }
                  />
                  <div className="rp-card-bottom">
                    <span>
                      {data.categories.length} leading categories shown
                    </span>
                    <span>
                      Click to explore <ArrowUpRight size={12} />
                    </span>
                  </div>
                </Card>
                <Card
                  title="Order breakdown"
                  subtitle="Every valid order, by status"
                  className="rp-orders-card"
                  info="Distinct order IDs per status. Orders with mixed line statuses can appear in more than one slice."
                >
                  <Donut
                    currency={data.currency || "INR"}
                    rows={data.order_status}
                    label="status"
                    value="orders"
                    center={shortNumber(data.kpis.orders)}
                    caption="valid orders"
                    colors={["#a895ce", "#91b693", "#eac16f"]}
                  />
                </Card>
                <Card
                  title="Customer behavior"
                  subtitle="The balance between first and repeat purchases"
                  className="rp-behavior-card"
                >
                  <div className="rp-card-number">
                    <strong>{data.customer_behavior.repeat_rate}%</strong>
                    <span>
                      of purchasing customers ordered more than once in this
                      view
                    </span>
                  </div>
                  <BehaviorChart rows={data.trend} />
                </Card>
                <Card
                  title="Where sales happen"
                  subtitle="Revenue by location"
                  className="rp-regions-card"
                  action={
                    <select
                      aria-label="Sales geography"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                    >
                      <option value="city">City</option>
                      <option value="state">State</option>
                      <option value="store_id">Store</option>
                    </select>
                  }
                >
                  <RankedBars
                    rows={regions.slice(0, 5)}
                    label={region}
                    currency={data.currency || "INR"}
                    total={data.kpis.revenue}
                    color="sage"
                    onSelect={(value) =>
                      setFilters({ ...filters, [region]: value })
                    }
                  />
                </Card>
                <Card
                  title="Product performance"
                  subtitle="The items moving your business"
                  className="rp-products-card"
                  action={
                    <div className="rp-segmented">
                      <button
                        aria-pressed={productMode === "best"}
                        onClick={() => setProductMode("best")}
                      >
                        Best sellers
                      </button>
                      <button
                        aria-pressed={productMode === "least"}
                        onClick={() => setProductMode("least")}
                      >
                        Slow movers
                      </button>
                    </div>
                  }
                >
                  <div className="rp-data-scroll">
                    <table className="rp-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>SKU</th>
                          <th>Units sold</th>
                          <th>Revenue</th>
                          <th>Revenue share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.slice(0, 6).map((row, index) => (
                          <tr key={`${row.product_id}-${index}`}>
                            <td>
                              <ProductIcon
                                product={String(row.product || "")}
                                size={23}
                              />
                              <strong>
                                {row.product || "Unnamed product"}
                              </strong>
                            </td>
                            <td className="rp-mono">{row.product_id || "—"}</td>
                            <td>{number(Number(row.units))}</td>
                            <td>{money(Number(row.revenue), 2)}</td>
                            <td>
                              <span className="rp-inline-bar">
                                <i
                                  style={{
                                    width: `${data.kpis.revenue ? (Number(row.revenue) / data.kpis.revenue) * 100 : 0}%`,
                                  }}
                                />
                              </span>
                              <small>
                                {data.kpis.revenue
                                  ? (
                                      (Number(row.revenue) /
                                        data.kpis.revenue) *
                                      100
                                    ).toFixed(1)
                                  : 0}
                                %
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!products.length && (
                      <Empty title="No product sales">
                        Choose another filter range.
                      </Empty>
                    )}
                  </div>
                </Card>
                {data.product_outlook && (
                  <ProductOutlook outlook={data.product_outlook} compact />
                )}
                <Card
                  title="Customer spending"
                  subtitle="Completed spend per customer"
                  className="rp-spending-card"
                >
                  <Donut
                    currency={data.currency || "INR"}
                    rows={data.spending}
                    label="band"
                    value="customers"
                    center={shortNumber(
                      data.customer_behavior.purchasing_customers,
                    )}
                    caption="purchasers"
                  />
                </Card>
              </div>
            </>
          ) : tab === "Products" ? (
            data.product_outlook && (
              <ProductOutlook outlook={data.product_outlook} />
            )
          ) : tab === "Insights" ? (
            <Insights data={data} />
          ) : (
            <Reports data={data} exporting={exporting} onDownload={download} />
          )}
          <div className="rp-methodology">
            <Check size={13} />
            <span>
              {number(data.kpis.excluded_rows)} invalid or financially imputed
              rows excluded. Amounts use your dataset’s currency.
            </span>
            <details>
              <summary>Calculation details</summary>
              <p>{data.basis}</p>
              <p>
                First/repeat orders use each customer’s first completed order in
                full dataset history. Charts and metrics follow the active
                filters.
              </p>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

function Insights({ data }: { data: Analysis }) {
  return (
    <div className="rp-insight-grid">
      <Card
        title="Signals worth a closer look"
        subtitle="Rules evaluated on your filtered data"
      >
        <div className="rp-insight-list">
          {data.insights.map((insight, i) => (
            <div key={i}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <p>{insight}</p>
              <ArrowUpRight size={16} />
            </div>
          ))}
        </div>
      </Card>
      <Card
        title="Your sales mix"
        subtitle="Revenue concentration, at a glance"
      >
        <Donut
          currency={data.currency || "INR"}
          rows={data.categories}
          label="category"
          value="revenue"
          center={shortNumber(data.kpis.revenue)}
          caption="revenue"
        />
        <p className="rp-muted">
          Use category and region filters to compare the signals that matter.
          Associations describe the data and do not establish a cause.
        </p>
      </Card>
    </div>
  );
}

function Reports({
  data,
  exporting,
  onDownload,
}: {
  data: Analysis;
  exporting: boolean;
  onDownload: (kind: "csv" | "pdf") => Promise<void>;
}) {
  return (
    <div className="rp-report-grid">
      {(["csv", "pdf"] as const).map((kind) => (
        <Card
          key={kind}
          title={kind === "csv" ? "Analysis workbook" : "Business summary"}
          subtitle={
            kind === "csv"
              ? "CSV · ready for your next analysis"
              : "PDF · ready to review and share"
          }
        >
          <div className={`rp-file-preview rp-file-${kind}`}>
            <span>{kind.toUpperCase()}</span>
            <div />
            <div />
            <div />
          </div>
          <p className="rp-muted">
            {kind === "csv"
              ? "Calculated KPIs, daily sales and active filters in a portable data file."
              : "A readable summary of KPIs, active filters and evaluated business insights."}
          </p>
          <button
            className="rp-button"
            disabled={exporting}
            onClick={() => void onDownload(kind)}
          >
            <Download size={14} />
            Download {kind.toUpperCase()}
          </button>
        </Card>
      ))}
      <div className="rp-report-context">
        <Check size={15} />
        <p>
          Both reports use this view’s filters. Current scope:{" "}
          <strong>{number(data.kpis.orders)} orders</strong> and{" "}
          <strong>
            {formatMoney(data.kpis.revenue, 2, data.currency || "INR")}{" "}
            completed revenue
          </strong>
          .
        </p>
      </div>
    </div>
  );
}
