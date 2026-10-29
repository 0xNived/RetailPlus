import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Search } from "lucide-react";
import { formatNumber } from "../retailApi";
import { Card, Empty } from "./components";
import ProductIcon from "./ProductIcon";
import type { ProductOutlook as Outlook } from "./types";

export default function ProductOutlook({
  outlook,
  compact = false,
}: {
  outlook: Outlook;
  compact?: boolean;
}) {
  const [search, setSearch] = useState("");
  const products = outlook.products.filter((product) =>
    `${product.product} ${product.product_id}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const month = outlook.month
    ? new Date(`${outlook.month}-01T00:00:00`).toLocaleDateString("en", {
        month: "long",
        year: "numeric",
      })
    : "Next month";
  return (
    <Card
      title={`Next month: ${month}`}
      subtitle="Product demand baseline · relative to the dataset’s last observation"
      className="rp-outlook-card"
      info={outlook.method}
    >
      {!outlook.available ? (
        <Empty title="A little more history is needed">{outlook.note}</Empty>
      ) : compact ? (
        <>
          <div className="rp-product-forecast-list">
            {outlook.products.slice(0, 3).map((product) => (
              <div key={`${product.product_id}-${product.product}`}>
                <ProductIcon product={product.product} size={26} />
                <div>
                  <strong>{product.product || product.product_id}</strong>
                  <span>
                    {product.direction} · {product.product_id}
                  </span>
                  <p>
                    <b>{formatNumber(product.baseline_units, 1)}</b> units /
                    month baseline
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="rp-forecast-caption">
            Average of {outlook.basis_start} to {outlook.basis_end}. Planning
            baseline, not a guaranteed prediction.
          </p>
        </>
      ) : (
        <>
          <div className="rp-outlook-search">
            <label className="rp-search">
              <Search size={14} />
              <input
                aria-label="Search product outlook"
                placeholder="Find a product or SKU…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <small>{products.length} products</small>
          </div>
          <div className="rp-data-scroll">
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Last baseline month</th>
                  <th>{month} baseline</th>
                  <th>Direction</th>
                  <th>Recent three months</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={`${product.product_id}-${product.product}`}>
                    <td>
                      <span className="rp-product-identity">
                        <ProductIcon product={product.product} size={25} />
                        <div>
                          <strong>
                            {product.product || "Unnamed product"}
                          </strong>
                          <small>{product.product_id || "No SKU mapped"}</small>
                        </div>
                      </span>
                    </td>
                    <td>{formatNumber(product.last_month_units, 1)} units</td>
                    <td>
                      <strong>
                        {formatNumber(product.baseline_units, 1)} units
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`rp-outlook-trend ${product.direction === "Cooling" ? "cooling" : ""}`}
                      >
                        {product.direction === "Rising" ? (
                          <ArrowUpRight size={14} />
                        ) : product.direction === "Cooling" ? (
                          <ArrowDownRight size={14} />
                        ) : (
                          <Minus size={14} />
                        )}
                        {product.direction}
                        {product.change_percent !== null
                          ? ` ${product.change_percent > 0 ? "+" : ""}${product.change_percent}%`
                          : ""}
                      </span>
                    </td>
                    <td>
                      {product.history.map((row) => (
                        <span
                          key={row.month}
                          className="rp-history-month"
                          title={row.month}
                        >
                          <small>
                            {new Date(
                              `${row.month}-01T00:00:00`,
                            ).toLocaleDateString("en", { month: "short" })}
                          </small>
                          <b>{formatNumber(row.units)}</b>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!products.length && (
              <Empty title="No matching products">
                Try another name or SKU.
              </Empty>
            )}
          </div>
          <p className="rp-forecast-caption">
            {outlook.method} {outlook.note}
          </p>
        </>
      )}
    </Card>
  );
}
