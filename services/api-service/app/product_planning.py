"""Product-level planning from observed sales, with time-ordered baseline evaluation."""
import numpy as np
import pandas as pd
from .retail import transaction_frame, currency_code


def product_plan(frame, mapping):
    if not mapping.get("order_date") or not (mapping.get("amount") or mapping.get("price")):
        raise ValueError("Map an order date and amount (or price) to plan product demand.")
    data = transaction_frame(frame, mapping)
    data = data.loc[~data.invalid].copy()
    currency = currency_code(frame, mapping)
    empty = {"available": False, "currency": currency, "products": [], "summary": {}, "categories": []}
    if data.empty:
        return {**empty, "note": "No valid transactions to plan from."}
    # SKU is authoritative even if a title changes. Name is a fallback only without SKU.
    data["key"] = np.where(data.product_id != "", "sku:" + data.product_id, "name:" + data["product"])
    data = data.loc[(data.product_id != "") | (data["product"] != "")].copy()
    if data.empty:
        return {**empty, "note": "Map a product name or SKU to plan product demand."}
    observed = data.order_date.max()
    observed_month = observed.to_period("M")
    first = data.order_date.min().to_period("M")
    # Conservatively omit both boundary months; source coverage may be partial.
    months = pd.period_range(first + 1, observed_month - 1, freq="M")
    if len(months) < 3:
        return {**empty, "note": "Needs three interior calendar months plus boundary observations. Upload more history."}
    sales = data.loc[data.status == "Completed"].copy()
    sales["month"] = sales.order_date.dt.to_period("M")
    totals = sales.groupby(["key", "month"]).agg(units=("quantity", "sum"), revenue=("amount", "sum"), orders=("order_key", "nunique"))
    products = []
    names = {"moving_average": "3-month moving average", "last_month": "Last complete month"}
    for key, orders in data.groupby("key", sort=False):
        orders = orders.sort_values("order_date", kind="stable")
        sku = str(orders.product_id.iloc[-1])
        titles = orders.loc[orders["product"] != "", "product"]
        categories = orders.loc[orders.category != "", "category"]
        # New products do not get fabricated pre-launch zero months.
        product_start = orders.order_date.min().to_period("M")
        coverage = months[months > product_start]
        if len(coverage) == 0:
            coverage = months[:0]
        monthly = totals.loc[key].reindex(coverage, fill_value=0) if key in totals.index.get_level_values(0) else pd.DataFrame(0., index=coverage, columns=["units", "revenue", "orders"])
        units = monthly.units.to_numpy(dtype=float)
        recent = units[-3:]
        actuals, predictions = [], {"moving_average": [], "last_month": []}
        # Same two-month horizon as the plan: target month, with its prior month hidden.
        for target in range(max(4, len(units) - 6), len(units)):
            history = units[:target - 1]
            actuals.append(float(units[target]))
            predictions["moving_average"].append(float(history[-3:].mean()))
            predictions["last_month"].append(float(history[-1]))
        evaluations = []
        for method, predicted in predictions.items():
            errors = np.array(predicted) - np.array(actuals)
            evaluations.append({"method": method, "label": names[method], "periods": len(actuals),
                                "mae_units": round(float(np.abs(errors).mean()), 2) if len(errors) else None,
                                "wape_percent": round(float(np.abs(errors).sum() / sum(actuals) * 100), 1) if sum(actuals) > 0 else None,
                                "bias_units": round(float(errors.mean()), 2) if len(errors) else None})
        enough = len(recent) == 3
        method = min(evaluations, key=lambda row: (row["mae_units"], row["method"] != "moving_average"))["method"] if len(actuals) >= 3 else "moving_average"
        demand = round(float(recent.mean() if method == "moving_average" else recent[-1]), 1) if enough else None
        recent_revenue = float(monthly.revenue.iloc[-3:].sum())
        recent_units = float(recent.sum())
        asp = recent_revenue / recent_units if recent_units > 0 else None
        change = (recent[-1] / recent[-2] - 1) * 100 if len(recent) >= 2 and recent[-2] > 0 else None
        # Signal refers to actual month-on-month sales, separate from forecast vs actual.
        direction = "Rising" if change is not None and change > 10 else "Cooling" if change is not None and change < -10 else "Steady" if change is not None else "Limited history"
        full_recent = orders.loc[orders.order_date.dt.to_period("M").isin(coverage[-3:])]
        order_count = full_recent.order_key.nunique()
        cancelled = full_recent.loc[full_recent.status == "Cancelled"].order_key.nunique()
        returned = full_recent.loc[full_recent.status == "Returned"].order_key.nunique()
        variability = float(np.std(recent, ddof=1) / np.mean(recent)) if len(recent) == 3 and np.mean(recent) > 0 else None
        review = "Review cancellations" if order_count >= 10 and cancelled / order_count >= .10 else "Review returns" if order_count >= 10 and returned / order_count >= .10 else "Review demand decline" if direction == "Cooling" else "Check availability" if direction == "Rising" else "Monitor demand"
        products.append({"key": key, "product_id": sku, "product": str(titles.iloc[-1]) if len(titles) else sku,
                         "category": str(categories.iloc[-1]) if len(categories) else "Uncategorized",
                         "eligible": enough, "forecast_units": round(demand, 1) if demand is not None else None,
                         "revenue_plan": round(demand * asp, 2) if demand is not None and asp is not None else None,
                         "average_selling_price": round(asp, 2) if asp is not None else None,
                         "recent_revenue": round(recent_revenue, 2), "last_month_units": float(recent[-1]) if len(recent) else 0,
                         "change_percent": round(change, 1) if change is not None else None, "direction": direction,
                         "cancellation_rate": round(cancelled / order_count * 100, 1) if order_count else 0,
                         "return_rate": round(returned / order_count * 100, 1) if order_count else 0,
                         "variability": "High" if variability is not None and variability > .5 else "Moderate" if variability is not None and variability > .2 else "Low" if variability is not None else "No recent demand",
                         "method": names[method], "evaluation": evaluations, "action": review,
                         "history": [{"month": str(month), "units": float(row.units), "revenue": round(float(row.revenue), 2), "orders": int(row.orders)} for month, row in monthly.iloc[-12:].iterrows()]})
    products.sort(key=lambda row: row["recent_revenue"], reverse=True)
    total_revenue = sum(p["recent_revenue"] for p in products)
    cumulative = 0
    for p in products:
        share_before = cumulative / total_revenue if total_revenue else 0
        p["abc_class"] = "A" if total_revenue and share_before < .8 else "B" if total_revenue and share_before < .95 else "C"
        cumulative += p["recent_revenue"]
    eligible = [p for p in products if p["eligible"]]
    return {"available": True, "currency": currency, "as_of": observed.strftime("%Y-%m-%d"), "target_month": str(observed_month + 1),
            "basis_start": str(months[-3]), "basis_end": str(months[-1]), "products": products,
            "categories": sorted({p["category"] for p in products}),
            "summary": {"products": len(products), "eligible_products": len(eligible), "forecast_units": round(sum(p["forecast_units"] for p in eligible), 1),
                        "revenue_plan": round(sum(p["revenue_plan"] or 0 for p in eligible), 2), "priority_products": sum(p["abc_class"] == "A" for p in products)},
            "note": "Planning estimates, not guaranteed sales. Excludes the first and final observed months. Assumes the uploaded interior months have complete coverage; absent sales are treated as zero after product introduction. No seasonality, promotions, margin or actual stock data is inferred. Method selection and error reporting use the same historical checks; these are not independent validation. Historical MAE/WAPE are rolling two-month-horizon checks (up to six periods), not prospective accuracy. With fewer than three checks, uses the moving average without model selection."}
