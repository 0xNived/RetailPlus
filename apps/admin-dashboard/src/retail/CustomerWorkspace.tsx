import { useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BadgeDollarSign,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import {
  retailDownload,
  retailRequest,
  formatNumber as number,
  formatMoney as money,
} from "../retailApi";
import {
  Badge,
  Card,
  Donut,
  Empty,
  Metric,
  SalesChart,
  Tabs,
  dateLabel,
  segmentColor,
  shortNumber,
} from "./components";
import type { ChartRow, Customer, CustomerOverview } from "./types";
import ProductIcon from "./ProductIcon";
import "./customer-polish.css";
const CustomerAvatar = lazy(() => import("./CustomerAvatar"));

const segments = ["Champions", "Loyal", "At Risk", "Lost"];
const recommendations: Record<string, { title: string; text: string }> = {
  Champions: {
    title: "Make your best customers feel known",
    text: "Offer early access, thoughtful product recommendations and recognition for their loyalty.",
  },
  Loyal: {
    title: "Build on an established relationship",
    text: "Time replenishment reminders around their buying habits and suggest complementary products.",
  },
  "At Risk": {
    title: "Give them a reason to return",
    text: "Start with a personal check-in. Test a relevant offer and measure whether it brings them back.",
  },
  Lost: {
    title: "Keep the next touch intentional",
    text: "Try one focused win-back offer. Review engagement before sending more messages.",
  },
};

export default function CustomerWorkspace({
  token,
  id,
}: {
  token: string;
  id: string;
}) {
  const [tab, setTab] = useState("Directory");
  const [overview, setOverview] = useState<CustomerOverview | null>(null);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("");
  const [risk, setRisk] = useState("");
  const [gender, setGender] = useState("");
  const [spend, setSpend] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState("spend");
  const [direction, setDirection] = useState("desc");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{
    customers: Customer[];
    total: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [modelCustomers, setModelCustomers] = useState<Customer[]>([]);
  const actualRisk = tab === "High risk" ? "High" : risk;
  const params = new URLSearchParams({
    dataset_id: id,
    search,
    segment,
    min_spend: spend || "0",
    risk: actualRisk,
    gender,
    offset: String(offset),
    limit: "25",
    sort,
    direction,
  }).toString();

  useEffect(() => {
    let live = true;
    retailRequest<CustomerOverview>(
      token,
      `/retail/customer-overview?dataset_id=${id}`,
    )
      .then((result) => {
        if (live) setOverview(result);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token, id]);

  useEffect(() => {
    if (tab !== "Segments") return;
    let live = true;
    retailRequest<{ customers: Customer[] }>(
      token,
      `/retail/model?dataset_id=${id}`,
    )
      .then((result) => {
        if (live) setModelCustomers(result.customers);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [token, id, tab]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      retailRequest<{ customers: Customer[]; total: number }>(
        token,
        `/retail/customers?${params}`,
      )
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
    }, 220);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [token, params]);

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setOffset(0);
  }
  function changeTab(value: string) {
    setTab(value);
    setOffset(0);
  }
  function changeSort(value: string) {
    setDirection(sort === value && direction === "desc" ? "asc" : "desc");
    setSort(value);
    setOffset(0);
  }
  async function download() {
    setExporting(true);
    try {
      await retailDownload(
        token,
        `/retail/report?dataset_id=${id}&kind=risk`,
        "high-risk-customers.csv",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export customers");
    } finally {
      setExporting(false);
    }
  }

  const summary = overview?.summary;
  const total = data?.total || 0;
  return (
    <div className="rp-workspace rp-customers">
      <div className="rp-section-top">
        <p className="rp-direct-intro">Who may return. Who needs a check-in.</p>
        <button
          className="rp-button"
          disabled={exporting || !summary?.customers}
          onClick={() => void download()}
        >
          <Download size={14} />
          Export high-risk customers
        </button>
      </div>
      <div className="rp-metrics four">
        <Metric
          label="Your customers"
          value={summary ? number(summary.customers) : "-"}
          detail={
            summary
              ? `${number(summary.returning)} repeat buyers`
              : "Customers with scored history"
          }
          icon={<UsersRound size={15} />}
        />
        <Metric
          label="Likely to return"
          value={summary ? number(summary.low_risk || 0) : "-"}
          detail="Low estimated risk / below 33%"
          icon={<ArrowUp size={15} />}
          tone="sage"
        />
        <Metric
          label="Check in soon"
          value={summary ? number(summary.medium_risk || 0) : "-"}
          detail="Moderate estimated risk / 33-66%"
          icon={<ShoppingBag size={15} />}
          tone="purple"
        />
        <Metric
          label="May not return"
          value={summary ? number(summary.high_risk) : "-"}
          detail="High estimated risk / above 66%"
          icon={<ArrowDownRight size={15} />}
          tone="orange"
        />
      </div>
      <div className="rp-section-top rp-directory-tabs">
        <Tabs
          tabs={["Directory", "Segments", "High risk"]}
          active={tab}
          onChange={changeTab}
          label="Customer views"
        />
        {overview?.scoring_date && (
          <span className="rp-muted rp-asof">
            Scored as of {dateLabel(overview.scoring_date, true)}
          </span>
        )}
      </div>
      {error && (
        <div className="rp-error" role="alert">
          {error}
        </div>
      )}
      {summary && summary.customers === 0 ? (
        <Empty title="Build your customer view">
          Run the full pipeline in Datasets to calculate profiles, segments and
          churn risk for this dataset version.
        </Empty>
      ) : tab === "Segments" ? (
        <SegmentView
          customers={modelCustomers}
          overview={overview}
          onExplore={(value) => {
            setSegment(value);
            setTab("Directory");
            setOffset(0);
          }}
          onCustomer={setSelectedId}
        />
      ) : (
        <>
          <div className="rp-segment-strip">
            {segments.map((name) => {
              const group = overview?.segments.find((s) => s.segment === name);
              return (
                <button
                  key={name}
                  aria-pressed={segment === name}
                  onClick={() =>
                    changeFilter(setSegment, segment === name ? "" : name)
                  }
                >
                  <i style={{ background: segmentColor[name] }} />
                  <span>{name}</span>
                  <strong>{group?.customers || 0}</strong>
                  <span className="rp-strip-share">
                    {summary?.customers
                      ? `${(((group?.customers || 0) / summary.customers) * 100).toFixed(0)}%`
                      : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          {tab === "High risk" && (
            <div className="rp-retention-banner">
              <div className="rp-retention-icon">
                <UsersRound size={20} />
              </div>
              <div>
                <strong>A focused list for your next retention review</strong>
                <p>
                  High risk means a churn probability above 66%. Review each
                  customer’s purchase pattern before choosing an offer.
                </p>
              </div>
            </div>
          )}
          <section
            className="rp-card rp-directory-card"
            aria-label="Customer directory"
          >
            <div className="rp-directory-heading">
              <div>
                <h3>
                  {tab === "High risk"
                    ? "Customers who may need attention"
                    : "All customers"}
                  <span className="rp-count">{number(total)}</span>
                </h3>
                <p>
                  Purchase history, value and relationship health in one place.
                </p>
              </div>
            </div>
            <div className="rp-directory-filters">
              <label className="rp-search">
                <Search size={15} />
                <span className="sr-only">Search customers</span>
                <input
                  aria-label="Search customers"
                  value={search}
                  onChange={(e) => changeFilter(setSearch, e.target.value)}
                  placeholder="Search by name or customer ID…"
                />
                {search && (
                  <button
                    aria-label="Clear customer search"
                    onClick={() => changeFilter(setSearch, "")}
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
              <select
                aria-label="Customer segment"
                value={segment}
                onChange={(e) => changeFilter(setSegment, e.target.value)}
              >
                <option value="">All segments</option>
                {segments.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {tab !== "High risk" && (
                <select
                  aria-label="Customer risk"
                  value={risk}
                  onChange={(e) => changeFilter(setRisk, e.target.value)}
                >
                  <option value="">All risk levels</option>
                  {["Low", "Medium", "High"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
              <button
                className="rp-button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={14} />
                Filters
              </button>
            </div>
            {showFilters && (
              <div className="rp-customer-extra-filters">
                <label>
                  Gender
                  <select
                    aria-label="Customer gender"
                    value={gender}
                    onChange={(event) =>
                      changeFilter(setGender, event.target.value)
                    }
                  >
                    <option value="">All genders</option>
                    <option>Female</option>
                    <option>Male</option>
                  </select>
                </label>
                <label>
                  Minimum lifetime spend
                  <input
                    aria-label="Minimum customer spend"
                    type="number"
                    min="0"
                    value={spend}
                    onChange={(e) => changeFilter(setSpend, e.target.value)}
                    placeholder="0"
                  />
                </label>
                <label>
                  Sort by
                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setOffset(0);
                    }}
                  >
                    <option value="spend">Total spend</option>
                    <option value="orders">Orders</option>
                    <option value="recency">Days since purchase</option>
                    <option value="risk">Churn probability</option>
                    <option value="name">Customer name</option>
                  </select>
                </label>
                <button
                  className="rp-link"
                  onClick={() => {
                    setSearch("");
                    setSegment("");
                    setRisk("");
                    setGender("");
                    setSpend("");
                    setOffset(0);
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
            <div
              className={`rp-data-scroll ${loading ? "rp-table-loading" : ""}`}
              aria-busy={loading}
            >
              <table className="rp-table rp-customer-table">
                <thead>
                  <tr>
                    <SortableHeader
                      name="Customer"
                      value="name"
                      sort={sort}
                      direction={direction}
                      onSort={changeSort}
                    />
                    <th>Segment</th>
                    <SortableHeader
                      name="Total spend"
                      value="spend"
                      sort={sort}
                      direction={direction}
                      onSort={changeSort}
                    />
                    <SortableHeader
                      name="Orders"
                      value="orders"
                      sort={sort}
                      direction={direction}
                      onSort={changeSort}
                    />
                    <SortableHeader
                      name="Last purchase"
                      value="recency"
                      sort={sort}
                      direction={direction}
                      onSort={changeSort}
                    />
                    <SortableHeader
                      name="Outlook"
                      value="risk"
                      sort={sort}
                      direction={direction}
                      onSort={changeSort}
                    />
                    <th>
                      <span className="sr-only">View customer</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data?.customers.map((customer) => (
                    <tr
                      key={customer.customer_id}
                      onClick={() => setSelectedId(customer.customer_id)}
                    >
                      <td>
                        <div className="rp-customer-identity">
                          <Avatar customer={customer} />
                          <div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedId(customer.customer_id);
                              }}
                            >
                              {customer.name || customer.customer_id}
                            </button>
                            <span className="rp-mono">
                              {customer.customer_id}
                              {customer.gender ? ` / ${customer.gender}` : ""}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge>{customer.segment}</Badge>
                      </td>
                      <td className="rp-table-amount">
                        {money(
                          customer.monetary,
                          2,
                          customer.currency || "INR",
                        )}
                        <small>
                          {money(
                            customer.average_order_value,
                            2,
                            customer.currency || "INR",
                          )}{" "}
                          avg. order
                        </small>
                      </td>
                      <td>
                        <strong>{customer.frequency}</strong>
                        <small>completed</small>
                      </td>
                      <td>
                        <span>{customer.recency} days ago</span>
                        <small>
                          {overview?.scoring_date
                            ? purchaseDate(
                                overview.scoring_date,
                                customer.recency,
                              )
                            : "At scoring date"}
                        </small>
                      </td>
                      <td>
                        <div className="rp-risk-cell">
                          <Badge tone={customer.risk}>
                            {outlookLabel(customer.risk)}
                          </Badge>
                          <span>
                            {(customer.probability * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div
                          className={`rp-risk-meter rp-risk-${customer.risk.toLowerCase()}`}
                        >
                          <i
                            style={{ width: `${customer.probability * 100}%` }}
                          />
                        </div>
                      </td>
                      <td>
                        <button
                          className="rp-icon-button"
                          aria-label={`View ${customer.name || customer.customer_id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(customer.customer_id);
                          }}
                        >
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !data?.customers.length && (
                <Empty title="No customers match these filters">
                  Try a different name, segment or spend threshold.
                </Empty>
              )}
              {loading && !data && (
                <div className="rp-directory-loading" role="status">
                  Loading customers…
                </div>
              )}
            </div>
            <div className="rp-pagination">
              <span>
                {loading
                  ? "Updating…"
                  : total
                    ? `Showing ${offset + 1}–${Math.min(offset + 25, total)} of ${number(total)} customers`
                    : "0 customers"}
              </span>
              <div>
                <button
                  className="rp-button"
                  aria-label="Previous customer page"
                  disabled={loading || offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 25))}
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <span>
                  {total ? Math.floor(offset / 25) + 1 : 0} /{" "}
                  {Math.ceil(total / 25)}
                </span>
                <button
                  className="rp-button"
                  aria-label="Next customer page"
                  disabled={loading || offset + 25 >= total}
                  onClick={() => setOffset(offset + 25)}
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>
        </>
      )}
      <p className="rp-data-note">
        Profile totals reflect valid completed purchases. Risk is a model
        estimate, not a certainty. Customer summaries describe the full scored
        dataset; directory filters apply to the list.
      </p>
      {selectedId && (
        <CustomerDrawer
          token={token}
          datasetId={id}
          customerId={selectedId}
          scoringDate={overview?.scoring_date || null}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function SortableHeader({
  name,
  value,
  sort,
  direction,
  onSort,
}: {
  name: string;
  value: string;
  sort: string;
  direction: string;
  onSort: (value: string) => void;
}) {
  return (
    <th
      aria-sort={
        sort === value
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button onClick={() => onSort(value)}>
        {name}
        {sort !== value ? (
          <ArrowUpDown size={11} />
        ) : direction === "asc" ? (
          <ArrowUp size={11} />
        ) : (
          <ArrowDown size={11} />
        )}
      </button>
    </th>
  );
}

function Avatar({
  customer,
  large = false,
}: {
  customer: Customer;
  large?: boolean;
}) {
  const name = customer.name || customer.customer_id;
  return (
    <Suspense
      fallback={
        <span className={`rp-avatar ${large ? "rp-avatar-large" : ""}`}>
          {name
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
      }
    >
      <CustomerAvatar
        name={name}
        seed={customer.avatar_seed || `${customer.customer_id}|${name}`}
        large={large}
      />
    </Suspense>
  );
}

function purchaseDate(scoringDate: string, recency: number) {
  const date = new Date(scoringDate);
  date.setUTCDate(date.getUTCDate() - recency);
  return dateLabel(date.toISOString(), true);
}

function CustomerDrawer({
  token,
  datasetId,
  customerId,
  scoringDate,
  onClose,
}: {
  token: string;
  datasetId: string;
  customerId: string;
  scoringDate: string | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const [historyStatus, setHistoryStatus] = useState("All");
  useEffect(() => {
    const element = dialog.current;
    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    Object.assign(body.style, {
      overflow: "hidden",
      position: "fixed",
      top: `-${scrollY}px`,
      width: "100%",
    });
    element?.showModal();
    let live = true;
    setCustomer(null);
    setError("");
    retailRequest<Customer>(
      token,
      `/customers/${encodeURIComponent(customerId)}?dataset_id=${datasetId}`,
    )
      .then((result) => {
        if (live) setCustomer(result);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
      element?.close();
      Object.assign(body.style, previous);
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [token, datasetId, customerId]);

  const orders = [...(customer?.orders || [])].sort((a, b) =>
    String(b.order_date).localeCompare(String(a.order_date)),
  );
  const completed = orders.filter(
    (order) => order.status === "Completed" && !order.invalid,
  );
  const monthly = new Map<string, { revenue: number; orders: Set<string> }>();
  completed.forEach((order) => {
    const key = String(order.order_date).slice(0, 7) + "-01";
    const bucket = monthly.get(key) || {
      revenue: 0,
      orders: new Set<string>(),
    };
    bucket.revenue += Number(order.amount);
    bucket.orders.add(String(order.order_id || order.order_date));
    monthly.set(key, bucket);
  });
  const trend: ChartRow[] = [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      order_date: key,
      revenue: bucket.revenue,
      orders: bucket.orders.size,
    }));
  const cities = [
    ...new Set(orders.map((order) => order.city).filter(Boolean)),
  ];
  const history =
    historyStatus === "All"
      ? orders
      : orders.filter((order) => order.status === historyStatus);
  return (
    <dialog
      className="rp-customer-drawer"
      ref={dialog}
      onCancel={onClose}
      aria-label={customer?.name || customerId}
      aria-labelledby={customer ? "customer-profile-title" : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left) onClose();
        }
      }}
    >
      <div className="rp-drawer-top">
        <span>Customer profile</span>
        <button
          className="rp-icon-button"
          onClick={onClose}
          aria-label="Close customer profile"
        >
          <X size={18} />
        </button>
      </div>
      {error ? (
        <div className="rp-error" role="alert">
          {error}
        </div>
      ) : !customer ? (
        <div className="rp-directory-loading" role="status">
          Loading profile…
        </div>
      ) : (
        <div className="rp-drawer-body">
          <div className="rp-profile-identity">
            <Avatar customer={customer} large />
            <div>
              <h2 id="customer-profile-title">
                {customer.name || customer.customer_id}
              </h2>
              <span className="rp-mono">{customer.customer_id}</span>
              {customer.gender && (
                <span className="rp-profile-demographic">
                  {customer.gender}
                </span>
              )}
            </div>
          </div>
          <div className="rp-profile-badges">
            <Badge>{customer.segment}</Badge>
            <Badge tone={customer.risk}>{outlookLabel(customer.risk)}</Badge>
            {cities.length > 0 && (
              <span>
                <MapPin size={12} />
                {cities.slice(0, 2).join(", ")}
                {cities.length > 2 ? ` +${cities.length - 2}` : ""}
              </span>
            )}
          </div>
          <div className="rp-profile-stats">
            <div>
              <span>Total spend</span>
              <strong>
                {money(customer.monetary, 2, customer.currency || "INR")}
              </strong>
            </div>
            <div>
              <span>Completed orders</span>
              <strong>{customer.frequency}</strong>
            </div>
            <div>
              <span>Avg. order value</span>
              <strong>
                {money(
                  customer.average_order_value,
                  2,
                  customer.currency || "INR",
                )}
              </strong>
            </div>
            <div>
              <span>Last purchase</span>
              <strong>{customer.recency} days ago</strong>
              <small>
                {scoringDate
                  ? purchaseDate(scoringDate, customer.recency)
                  : "At scoring date"}
              </small>
            </div>
          </div>
          <section
            className={`rp-customer-outlook ${customer.risk.toLowerCase()}`}
          >
            <div>
              <strong>{outlookLabel(customer.risk)}</strong>
              <span>
                {(customer.probability * 100).toFixed(0)}% estimated risk
              </span>
            </div>
            <p>
              {customer.recency} days since their last completed purchase.{" "}
              {customer.recommendation}
            </p>
            <details>
              <summary>About this estimate</summary>
              <small>
                Probability of no completed purchase in the next 90 days,
                estimated from the fitted historical churn model.{" "}
                {scoringDate
                  ? `Scored as of ${dateLabel(scoringDate, true)}.`
                  : ""}{" "}
                This is a signal for review, not a certainty.
              </small>
            </details>
          </section>
          <Card
            title="Purchase rhythm"
            subtitle={`${customer.tenure} days of history · ${customer.tenure > 0 ? ((customer.frequency / customer.tenure) * 30).toFixed(1) : customer.frequency} orders / 30 days`}
          >
            <SalesChart rows={trend} currency={customer.currency || "INR"} />
          </Card>
          <section className="rp-history">
            <div className="rp-card-header">
              <h3>
                Purchase history{" "}
                <span className="rp-count">{orders.length} lines</span>
              </h3>
            </div>
            <div className="rp-segmented rp-history-filter">
              {["All", "Completed", "Cancelled", "Returned"].map((status) => (
                <button
                  key={status}
                  aria-pressed={historyStatus === status}
                  onClick={() => setHistoryStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <div className="rp-history-list">
              {history.map((order, index) => (
                <div key={index}>
                  <span className="rp-history-product-icon">
                    <ProductIcon
                      product={String(order.product || order.product_id || "")}
                      category={String(order.category || "")}
                      size={22}
                    />
                  </span>
                  <div>
                    <strong>
                      {order.product || order.product_id || "Order"}
                    </strong>
                    <span>
                      {order.order_id || "No order ID"} ·{" "}
                      {dateLabel(String(order.order_date), true)}
                      {Number(order.quantity) > 0 &&
                        ` \u00b7 Qty ${order.quantity}`}
                    </span>
                    <Badge>{order.status}</Badge>
                    {order.invalid && (
                      <small className="rp-validation-note">
                        Flagged for validation · excluded from totals
                      </small>
                    )}
                  </div>
                  <strong>
                    {money(Number(order.amount), 2, customer.currency || "INR")}
                  </strong>
                </div>
              ))}
              {!history.length && (
                <p className="rp-muted">
                  No {historyStatus.toLowerCase()} orders.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </dialog>
  );
}

function SegmentView({
  customers,
  overview,
  onExplore,
  onCustomer,
}: {
  customers: Customer[];
  overview: CustomerOverview | null;
  onExplore: (value: string) => void;
  onCustomer: (value: string) => void;
}) {
  const maxFrequency = Math.max(1, ...customers.map((c) => c.frequency));
  const maxSpend = Math.max(1, ...customers.map((c) => c.monetary));
  return (
    <>
      <div className="rp-segment-cards">
        {segments.map((name) => {
          const group = overview?.segments.find((s) => s.segment === name);
          return (
            <button
              className="rp-card"
              key={name}
              onClick={() => onExplore(name)}
            >
              <span className="rp-segment-title">
                <i style={{ background: segmentColor[name] }} />
                {name}
                <ArrowUpRightIcon />
              </span>
              <strong>{number(group?.customers || 0)}</strong>
              <small>{money(group?.spend || 0, 2)} completed spend</small>
              <div className="rp-segment-mini">
                <span>
                  {(group?.average_orders || 0).toFixed(1)} avg. orders
                </span>
                <span>
                  {(group?.average_recency || 0).toFixed(0)} days recency
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="rp-customer-segment-grid">
        <Card
          title="Every customer has a different rhythm"
          subtitle="Frequency × monetary value · select a customer to inspect"
        >
          <svg
            className="rp-rfm-chart"
            viewBox="0 0 680 310"
            role="group"
            aria-label="Customer segment scatter plot"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  x1="55"
                  x2="655"
                  y1={265 - t * 230}
                  y2={265 - t * 230}
                  stroke="#e9ece5"
                  strokeDasharray="3 4"
                />
                <text
                  x="47"
                  y={269 - t * 230}
                  textAnchor="end"
                  fontSize="9"
                  fill="#949c8a"
                >
                  {shortNumber(maxSpend * t)}
                </text>
              </g>
            ))}
            {customers.map((customer) => (
              <circle
                key={customer.customer_id}
                cx={55 + (customer.frequency / maxFrequency) * 590}
                cy={265 - (customer.monetary / maxSpend) * 230}
                r="3.5"
                fill={segmentColor[customer.segment]}
                opacity=".75"
                tabIndex={0}
                role="button"
                aria-label={`${customer.customer_id}, ${customer.segment}, ${customer.frequency} orders, ${number(customer.monetary)} spend`}
                onClick={() => onCustomer(customer.customer_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onCustomer(customer.customer_id);
                  }
                }}
              >
                <title>
                  {customer.name || customer.customer_id} · {customer.segment}
                </title>
              </circle>
            ))}
            <text
              x="345"
              y="300"
              textAnchor="middle"
              fill="#959d8c"
              fontSize="10"
            >
              Completed orders (0–{maxFrequency})
            </text>
            <text x="55" y="18" fill="#959d8c" fontSize="10">
              Completed spend
            </text>
          </svg>
          <div className="rp-legend">
            {segments.map((name) => (
              <span key={name}>
                <i style={{ background: segmentColor[name] }} />
                {name}
              </span>
            ))}
          </div>
        </Card>
        <Card
          title="Customer mix"
          subtitle="How your scored audience is distributed"
        >
          <Donut
            rows={(overview?.segments || []).map((s) => ({
              segment: s.segment,
              customers: s.customers,
            }))}
            label="segment"
            value="customers"
            center={shortNumber(overview?.summary.customers || 0)}
            caption="customers"
            colors={(overview?.segments || []).map(
              (s) => segmentColor[s.segment],
            )}
          />
        </Card>
      </div>
      <div className="rp-retention-grid">
        {segments.map((name) => (
          <Card
            key={name}
            title={recommendations[name].title}
            subtitle={`${name} · suggested next step`}
          >
            <p>{recommendations[name].text}</p>
            <button className="rp-link" onClick={() => onExplore(name)}>
              Explore {name.toLowerCase()} customers <ArrowRight size={13} />
            </button>
          </Card>
        ))}
      </div>
      <p className="rp-data-note">
        KMeans groups scaled log RFM into four clusters. Names describe relative
        cluster behavior and are separate from the predicted churn risk.
      </p>
    </>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 10L10 4M4 4h6v6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function outlookLabel(risk: string) {
  return risk === "High"
    ? "May not return"
    : risk === "Medium"
      ? "Check in soon"
      : "Likely to return";
}
