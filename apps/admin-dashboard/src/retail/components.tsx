import { useId, useState, type ReactNode } from "react";
import { Info, UsersRound } from "lucide-react";
import { formatNumber, formatMoney } from "../retailApi";
import type { ChartRow } from "./types";
import "./retail.css";

export const palette = [
  "#ef8651",
  "#8a79c7",
  "#8db497",
  "#eac271",
  "#afc6d5",
  "#c994a7",
  "#a9b68d",
  "#dfad83",
];
export const segmentColor: Record<string, string> = {
  Champions: "#638d73",
  Loyal: "#8a79c7",
  "At Risk": "#d49c58",
  Lost: "#a3a8ad",
};

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  info,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  info?: string;
}) {
  return (
    <article className={`rp-card ${className}`}>
      <header className="rp-card-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="rp-card-actions">
          {action}
          {info && (
            <span
              className="rp-info"
              tabIndex={0}
              role="note"
              aria-label={info}
            >
              <Info size={14} />
              <span>{info}</span>
            </span>
          )}
        </div>
      </header>
      {children}
    </article>
  );
}

export function Metric({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  spark,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
  tone?: string;
  spark?: number[];
}) {
  const max = Math.max(1, ...(spark || []));
  return (
    <article className={`rp-metric rp-tone-${tone}`}>
      <div className="rp-metric-top">
        <span>{label}</span>
        {icon && <i>{icon}</i>}
      </div>
      <strong>{value}</strong>
      <div className="rp-metric-bottom">
        <small>{detail}</small>
        {spark && spark.length > 0 && (
          <svg aria-hidden="true" viewBox="0 0 80 24">
            <polyline
              points={spark
                .map(
                  (v, i) =>
                    `${(i / Math.max(1, spark.length - 1)) * 80},${23 - (v / max) * 21}`,
                )
                .join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          </svg>
        )}
      </div>
    </article>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className="rp-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          tabIndex={active === tab ? 0 : -1}
          id={`${id}-${index}`}
          onClick={() => onChange(tab)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (index + tabs.length - 1) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : -1;
            if (next >= 0) {
              event.preventDefault();
              onChange(tabs[next]);
              (
                event.currentTarget.parentElement?.children[
                  next
                ] as HTMLButtonElement
              )?.focus();
            }
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rp-empty">
      <span>
        <UsersRound size={22} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`rp-badge rp-badge-${(tone || String(children)).toLowerCase().replaceAll(" ", "-")}`}
    >
      <i />
      {children}
    </span>
  );
}

export function shortNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function dateLabel(value: string, full = false) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        ...(full ? { year: "numeric" as const } : {}),
      });
}

export function SalesChart({
  rows,
  metric = "revenue",
  currency = "INR",
}: {
  rows: ChartRow[];
  metric?: string;
  currency?: string;
}) {
  const id = useId().replaceAll(":", "");
  const data = rows.slice(-24);
  const [active, setActive] = useState<number | null>(null);
  const chosen =
    active !== null && active < data.length
      ? active
      : Math.max(0, data.length - 1);
  const selected = data[chosen];
  const max = Math.max(1, ...data.map((row) => Number(row[metric])));
  const width = 680,
    height = 230,
    left = 38,
    bottom = 200,
    plotWidth = width - left - 12;
  const slot = plotWidth / Math.max(1, data.length),
    bar = Math.min(36, slot * 0.66);
  return (
    <div className="rp-sales-chart">
      {selected && (
        <div className="rp-chart-readout" aria-live="polite">
          <span>{dateLabel(String(selected.order_date), true)}</span>
          <strong>
            {metric === "revenue"
              ? formatMoney(Number(selected[metric]), 2, currency)
              : formatNumber(Number(selected[metric]))}
          </strong>
          <small>
            {formatNumber(Number(selected.orders || 0))} completed orders
          </small>
        </div>
      )}
      {active !== null && selected && (
        <div
          className="rp-sales-tooltip"
          aria-hidden="true"
          style={{
            left: `${Math.max(18, Math.min(82, 7 + (chosen / Math.max(1, data.length - 1)) * 88))}%`,
          }}
        >
          <strong>{dateLabel(String(selected.order_date), true)}</strong>
          <span>
            <i />
            Revenue<b>{formatMoney(Number(selected.revenue), 2, currency)}</b>
          </span>
          <span>
            <i />
            Completed orders<b>{formatNumber(Number(selected.orders || 0))}</b>
          </span>
        </div>
      )}
      {!data.length ? (
        <Empty title="No sales in this view">
          Try another date range or clear a filter.
        </Empty>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          aria-label={`Sales ${metric} by period. Use Tab to inspect bars.`}
          role="group"
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            <pattern
              id={`${id}-stripes`}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(30)"
            >
              <rect width="6" height="6" fill="#f48b50" />
              <rect width="2" height="6" fill="#ec7841" />
            </pattern>
            <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#ffd3ad" />
              <stop offset="1" stopColor="#f8b17d" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line
                x1={left}
                x2={width - 10}
                y1={bottom - t * 160}
                y2={bottom - t * 160}
                stroke="#e8e9e6"
                strokeDasharray="3 4"
              />
              <text
                x={left - 8}
                y={bottom - t * 160 + 3}
                textAnchor="end"
                fontSize="9"
                fill="#a1a29c"
              >
                {shortNumber(max * t)}
              </text>
            </g>
          ))}
          {data.map((row, index) => {
            const x = left + slot * index + (slot - bar) / 2,
              h = (Number(row[metric]) / max) * 160;
            return (
              <g
                key={`${row.order_date}-${index}`}
                className="rp-chart-mark"
                tabIndex={0}
                role="button"
                aria-label={`${dateLabel(String(row.order_date), true)}: ${formatNumber(Number(row[metric]), 2)} ${metric}, ${row.orders || 0} orders`}
                onFocus={() => setActive(index)}
                onPointerEnter={() => setActive(index)}
                onClick={() => setActive(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActive(index);
                  }
                }}
              >
                <rect
                  x={left + slot * index}
                  y="20"
                  width={slot}
                  height="185"
                  fill="transparent"
                />
                <rect
                  x={x}
                  y={bottom - Math.max(1, h)}
                  width={bar}
                  height={Math.max(1, h)}
                  rx="3"
                  fill={
                    index === chosen ? `url(#${id}-stripes)` : `url(#${id}-bar)`
                  }
                  opacity={index === chosen ? 1 : 0.4}
                  stroke={index === chosen ? "#df6c35" : "#edb995"}
                  strokeWidth=".6"
                />
                {index % Math.max(1, Math.ceil(data.length / 7)) === 0 && (
                  <text
                    x={x + bar / 2}
                    y="220"
                    textAnchor="middle"
                    fontSize="9"
                    fill="#92968c"
                  >
                    {dateLabel(String(row.order_date))}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <div className="rp-chart-foot">
        <span>
          <i className="rp-dot" />
          {metric === "revenue"
            ? "Completed sales revenue"
            : "Completed orders"}
        </span>
        <small>
          {rows.length > 24
            ? "Latest 24 periods shown"
            : `${data.length} periods`}{" "}
          · hover or focus to inspect
        </small>
      </div>
    </div>
  );
}

function numberForTooltip(value: number) {
  return formatNumber(value, 2);
}

export function RankedBars({
  rows,
  label,
  value = "revenue",
  total,
  color = "orange",
  onSelect,
  currency = "INR",
}: {
  rows: ChartRow[];
  label: string;
  value?: string;
  total?: number;
  color?: string;
  onSelect?: (value: string) => void;
  currency?: string;
}) {
  const denominator =
    total ?? rows.reduce((sum, row) => sum + Number(row[value]), 0);
  return (
    <div className={`rp-ranked rp-ranked-${color}`}>
      {rows.length ? (
        rows.map((row, index) => {
          const share =
            denominator > 0 ? (Number(row[value]) / denominator) * 100 : 0;
          const content = (
            <>
              <div className="rp-ranked-label">
                <span>{row[label] || "Unknown"}</span>
                <strong>
                  {share.toFixed(1)}%{" "}
                  <small>
                    {value === "revenue"
                      ? new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency,
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(Number(row[value]))
                      : shortNumber(Number(row[value]))}
                  </small>
                </strong>
              </div>
              <div className="rp-ranked-track">
                <i
                  style={{
                    width: `${Math.min(100, share)}%`,
                    opacity: 1 - index * 0.09,
                  }}
                />
              </div>
            </>
          );
          return onSelect ? (
            <button
              key={index}
              onClick={() => onSelect(String(row[label]))}
              title={`Filter by ${row[label]}`}
            >
              {content}
            </button>
          ) : (
            <div key={index}>{content}</div>
          );
        })
      ) : (
        <p className="rp-muted">No matching records.</p>
      )}
    </div>
  );
}

export function Donut({
  rows,
  label,
  value,
  center,
  caption,
  colors = palette,
  currency = "INR",
}: {
  rows: ChartRow[];
  label: string;
  value: string;
  center: string;
  caption: string;
  colors?: string[];
  currency?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = rows.reduce((sum, row) => sum + Number(row[value]), 0);
  const selected = active !== null && rows[active] ? rows[active] : null;
  const circumference = 2 * Math.PI * 58;
  let offset = 0;
  return (
    <div className="rp-donut-layout">
      <div className="rp-donut">
        <svg
          viewBox="0 0 160 160"
          role="img"
          aria-label={rows
            .map((row) => `${row[label]}: ${formatNumber(Number(row[value]))}`)
            .join(", ")}
        >
          <circle
            cx="80"
            cy="80"
            r="58"
            fill="none"
            stroke="#f0f1ed"
            strokeWidth="18"
          />
          {rows.map((row, index) => {
            const length = total
              ? (Number(row[value]) / total) * circumference
              : 0;
            const start = offset;
            offset += length;
            return (
              <circle
                key={index}
                cx="80"
                cy="80"
                r="58"
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth={active === index ? 21 : 18}
                strokeDasharray={`${Math.max(0, length - 3)} ${circumference - Math.max(0, length - 3)}`}
                strokeDashoffset={-start}
                transform="rotate(-90 80 80)"
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
              >
                <title>
                  {row[label]}: {formatNumber(Number(row[value]))}
                </title>
              </circle>
            );
          })}
        </svg>
        <div>
          <strong>
            {selected
              ? value === "revenue"
                ? formatMoney(Number(selected[value]), 0, currency)
                : formatNumber(Number(selected[value]))
              : center}
          </strong>
          <small>{selected ? selected[label] : caption}</small>
        </div>
      </div>
      <div className="rp-donut-legend">
        {rows.map((row, index) => (
          <button
            key={index}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            onPointerEnter={() => setActive(index)}
            onPointerLeave={() => setActive(null)}
            onClick={() => setActive(index)}
          >
            <i style={{ background: colors[index % colors.length] }} />
            <span>
              {row[label]}
              <small>
                {value === "revenue"
                  ? formatMoney(Number(row[value]), 0, currency)
                  : formatNumber(Number(row[value]))}
              </small>
            </span>
            <strong>
              {total ? ((Number(row[value]) / total) * 100).toFixed(1) : 0}%
            </strong>
          </button>
        ))}
      </div>
    </div>
  );
}

export function BehaviorChart({
  rows,
  first = "new_orders",
  second = "returning_orders",
}: {
  rows: ChartRow[];
  first?: string;
  second?: string;
}) {
  const data = rows.slice(-24);
  const max = Math.max(
    1,
    ...data.flatMap((row) => [
      Number(row[first] || 0),
      Number(row[second] || 0),
    ]),
  );
  const [active, setActive] = useState<number | null>(null);
  const x = (i: number) => 24 + (i / Math.max(1, data.length - 1)) * 352;
  const y = (v: number) => 130 - (v / max) * 105;
  return (
    <div className="rp-behavior-chart">
      <div className="rp-legend">
        <span>
          <i style={{ background: "#ef8651" }} />
          First orders
        </span>
        <span>
          <i style={{ background: "#a995cf" }} />
          Repeat orders
        </span>
      </div>
      <svg
        viewBox="0 0 400 158"
        role="group"
        aria-label="First and repeat completed orders over time"
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="24"
              x2="376"
              y1={y(max * t)}
              y2={y(max * t)}
              stroke="#ebede7"
              strokeDasharray="3 4"
            />
            <text
              x="18"
              y={y(max * t) + 3}
              textAnchor="end"
              fontSize="8"
              fill="#9a9f92"
            >
              {shortNumber(max * t)}
            </text>
          </g>
        ))}
        {[first, second].map((key, index) => (
          <polyline
            key={key}
            points={data
              .map((row, i) => `${x(i)},${y(Number(row[key] || 0))}`)
              .join(" ")}
            stroke={index ? "#a995cf" : "#ef8651"}
            strokeWidth="2"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {data.map((row, index) => (
          <g
            key={index}
            tabIndex={0}
            role="button"
            aria-label={`${dateLabel(String(row.order_date))}: ${row[first] || 0} first orders, ${row[second] || 0} repeat orders`}
            onFocus={() => setActive(index)}
            onPointerEnter={() => setActive(index)}
            onClick={() => setActive(index)}
          >
            <rect
              x={x(index) - 7}
              y="15"
              width="14"
              height="120"
              fill="transparent"
            />
            {active === index && (
              <>
                <line
                  x1={x(index)}
                  x2={x(index)}
                  y1="20"
                  y2="130"
                  stroke="#cbd1c1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={x(index)}
                  cy={y(Number(row[first] || 0))}
                  r="3"
                  fill="#ef8651"
                />
                <circle
                  cx={x(index)}
                  cy={y(Number(row[second] || 0))}
                  r="3"
                  fill="#a995cf"
                />
              </>
            )}
          </g>
        ))}
        {data.length > 0 && (
          <>
            <text x="24" y="151" fontSize="9" fill="#979e8e">
              {dateLabel(String(data[0].order_date))}
            </text>
            <text x="376" y="151" textAnchor="end" fontSize="9" fill="#979e8e">
              {dateLabel(String(data[data.length - 1].order_date))}
            </text>
          </>
        )}
      </svg>
      <p className="rp-chart-caption" aria-live="polite">
        {active !== null && data[active]
          ? `${dateLabel(String(data[active].order_date))}: ${data[active][first] || 0} first / ${data[active][second] || 0} repeat orders`
          : "Based on each customer’s first completed order in dataset history."}
      </p>
    </div>
  );
}
