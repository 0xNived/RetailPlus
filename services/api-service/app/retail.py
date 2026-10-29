"""Retail calculations use mapped columns; source identifiers always remain strings."""
from datetime import date
import numpy as np
import pandas as pd
from .retail_demo import generate_indian_retail, india_today

SEED = 42
FIELDS = {
    "customer_id": ["customer_id", "client_id", "buyer_id", "customer_code"],
    "customer_name": ["customer_name", "client_name", "buyer_name"],
    "gender": ["gender", "customer_gender", "sex"],
    "currency": ["currency", "currency_code"],
    "avatar_seed": ["avatar_seed"],
    "order_id": ["order_id", "invoice_number", "invoice_id", "transaction_id"],
    "order_date": ["date", "order_date", "transaction_date", "purchase_date"],
    "price": ["price", "unit_price", "selling_price"],
    "quantity": ["quantity", "qty", "units"],
    "amount": ["amount", "total", "total_amount", "revenue", "sales", "line_total"],
    "status": ["status", "order_status"],
    "category": ["category", "product_category"],
    "product": ["product_name", "product", "item_name"],
    "product_id": ["product_id", "sku", "product_sku", "product_code"],
    "store_id": ["store_id", "shop_id", "store_code"],
    "store_name": ["store_name", "shop_name", "store"],
    "country": ["country", "country_name"],
    "city": ["city", "town"], "state": ["state", "province", "region"],
    "postal_code": ["postal_code", "pincode", "pin_code", "zip", "zip_code"],
    "payment_method": ["payment_method", "payment", "payment_type"],
    "email": ["email", "email_address"], "phone": ["phone", "mobile"],
}


def guess_mapping(columns):
    return {field: next((name for name in aliases if name in columns), "") for field, aliases in FIELDS.items()}


def eligibility(mapping):
    missing = [field for field in ("customer_id", "order_date") if not mapping.get(field)]
    if not mapping.get("amount") and not mapping.get("price"):
        missing.append("amount (or price × quantity)")
    return {"eligible": not missing, "missing": missing,
            "note": "Needs customer ID, date and amount columns." if missing else "Retail fields mapped"}


def column_types(frame, mapping):
    types = {}
    identifiers = {mapping.get(field) for field in ("customer_id", "order_id", "product_id", "store_id", "postal_code")}
    categories = {mapping.get(field) for field in ("category", "status", "city", "state", "country", "payment_method", "gender", "currency")}
    for column in frame:
        values = frame[column].replace("", pd.NA).dropna().astype(str)
        if column in identifiers:
            types[column] = "ID (text)"
        elif column == mapping.get("order_date"):
            types[column] = "date"
        elif len(values) and pd.to_numeric(values, errors="coerce").notna().mean() >= .9:
            types[column] = "number"
        elif column in categories or (len(values) and values.nunique() <= 20 and values.nunique() / len(values) < .1):
            types[column] = "category"
        else:
            types[column] = "text"
    return types


def generate_transactions(size=10000, seed=SEED, end_date=None, messy=True):
    if size not in (10000, 50000, 100000):
        raise ValueError("Choose 10,000, 50,000 or 100,000 transactions")
    return generate_indian_retail(size, seed, end_date, messy)


def mapped_series(frame, mapping, field, default=""):
    column = mapping.get(field)
    return frame[column].fillna("").astype(str) if column and column in frame else pd.Series(default, index=frame.index, dtype="object")


def currency_code(frame, mapping):
    values = set(mapped_series(frame, mapping, "currency").str.strip().str.upper()) - {""}
    if not values:
        return "INR"  # The user's Indian retail workspace default, never a conversion.
    if len(values) != 1:
        raise ValueError("This dataset mixes currencies. Separate or convert them before calculating totals.")
    value = values.pop()
    if len(value) != 3 or not value.isalpha():
        raise ValueError("Use a three-letter currency code such as INR")
    return value


def transaction_frame(frame, mapping, today=None):
    result = pd.DataFrame(index=frame.index)
    for field in FIELDS:
        result[field] = mapped_series(frame, mapping, field)
    result["order_date"] = pd.to_datetime(result["order_date"], errors="coerce", format="mixed", utc=True).dt.tz_localize(None)
    price = pd.to_numeric(result["price"], errors="coerce")
    quantity = pd.to_numeric(result["quantity"], errors="coerce") if mapping.get("quantity") else pd.Series(1., index=frame.index)
    result["amount"] = pd.to_numeric(result["amount"], errors="coerce") if mapping.get("amount") else price * quantity
    result["status"] = result["status"].str.strip().str.title() if mapping.get("status") else "Completed"
    invalid = result["order_date"].isna() | (result["order_date"].dt.normalize() > pd.Timestamp(today or india_today()).normalize()) | result["amount"].isna() | (result["amount"] < 0)
    if mapping.get("price"):
        invalid |= price.isna() | (price < 0)
    if mapping.get("quantity"):
        invalid |= quantity.isna() | (quantity <= 0)
    if mapping.get("status"):
        invalid |= ~result["status"].isin(["Completed", "Cancelled", "Returned"])
    # Financial imputations are visible in the sheet, but excluded from business math.
    if "_imputed_fields" in frame:
        financial = [mapping.get(key) for key in ("amount", "price", "quantity") if mapping.get(key)]
        invalid |= frame["_imputed_fields"].fillna("").map(lambda value: bool(set(str(value).split("|")) & set(financial)))
    result["invalid"] = invalid
    result["quantity"] = quantity
    result["order_key"] = result["order_id"].where(result["order_id"] != "", "row-" + frame.index.astype(str))
    return result


def quality(frame, mapping):
    data = frame[[c for c in frame.columns if not c.startswith("_")]].replace("", pd.NA)
    total = max(1, data.size)
    completeness = float(data.notna().sum().sum() / total * 100)
    uniqueness = float((1 - data.duplicated().sum() / max(1, len(data))) * 100)
    invalid = transaction_frame(frame, mapping)["invalid"] if mapping.get("order_date") and (mapping.get("price") or mapping.get("amount")) else pd.Series(False, index=frame.index)
    validity = float((1 - invalid.sum() / max(1, len(data))) * 100)
    return {"score": round((completeness + uniqueness + validity) / 3, 2), "completeness": round(completeness, 2),
            "uniqueness": round(uniqueness, 2), "validity": round(validity, 2), "invalid_rows": int(invalid.sum()),
            "missing": {c: int(data[c].isna().sum()) for c in data if data[c].isna().any()},
            "mostly_missing": [c for c in data if data[c].isna().mean() > .6]}


def clean_retail(frame, mapping):
    frame = frame.copy()
    changes = []
    imputed = frame["_imputed_fields"].fillna("").astype(str).map(lambda value: value + "|" if value else "") if "_imputed_fields" in frame else pd.Series("", index=frame.index)

    def replace(column, values, action):
        before = frame[column].fillna("").astype(str)
        after = values.fillna("").astype(str)
        for index in frame.index[before != after]:
            changes.append({"data_row": int(index) + 1, "field": column, "original_value": before.at[index], "new_value": after.at[index], "action": action, "decision": "automatic"})
        frame[column] = after.replace("", pd.NA).astype("string")

    # Reconcile spelling/case only among values that differ solely by casing.
    for field in ("product", "category", "city", "state", "country", "status", "customer_name", "store_name"):
        column = mapping.get(field)
        if not column:
            continue
        values = frame[column].dropna().astype(str)
        canonical = {}
        for value in values.unique():
            key = value.casefold()
            previous = canonical.get(key)
            if previous is None or (value != value.lower() and previous == previous.lower()):
                canonical[key] = value
        replace(column, frame[column].map(lambda value: canonical.get(str(value).casefold(), value)), "normalize_casing")
    for field, key in (("product", "product_id"), ("category", "product_id"), ("price", "product_id"),
                       ("customer_name", "customer_id"), ("city", "store_id"), ("state", "store_id"),
                       ("country", "store_id"), ("postal_code", "store_id"), ("store_name", "store_id")):
        column, key_column = mapping.get(field), mapping.get(key)
        if not column or not key_column:
            continue
        known = frame.loc[frame[key_column].notna() & frame[column].notna(), [key_column, column]]
        # Only fill if this key has exactly one known value: no guessed prices or geography.
        unique = known.groupby(key_column)[column].nunique()
        lookup = known.loc[known[key_column].isin(unique[unique == 1].index)].drop_duplicates(key_column).set_index(key_column)[column]
        replace(column, frame[column].fillna(frame[key_column].map(lookup)), "fill_from_key")
    for field in ("email", "phone", "order_date"):
        column = mapping.get(field)
        if not column:
            continue
        if field == "email":
            values = frame[column].str.lower()
        elif field == "phone":
            values = frame[column].str.replace(r"[^\d+]", "", regex=True)
        else:
            parsed = pd.to_datetime(frame[column], errors="coerce", format="mixed", utc=True)
            values = parsed.dt.strftime("%Y-%m-%d").where(parsed.notna(), frame[column])
        replace(column, values, "standardize_" + field)
    strategies = {}
    for field in ("price", "quantity", "category", "city", "state", "country"):
        column = mapping.get(field)
        if not column or not frame[column].isna().any():
            continue
        missing = frame[column].isna()
        if missing.mean() > .6:
            strategies[column] = "flag: over 60% missing"
            continue
        if field in ("price", "quantity"):
            numbers = pd.to_numeric(frame[column], errors="coerce")
            median = numbers[numbers > 0].median()
            if pd.notna(median):
                imputed.loc[missing] += column + "|"
                replace(column, frame[column].fillna(str(float(median))), "impute_median")
                strategies[column] = "median (excluded from financial KPIs)"
        else:
            mode = frame[column].dropna().mode()
            replace(column, frame[column].fillna(mode.iloc[0] if len(mode) else "Unknown"), "impute_mode" if len(mode) else "impute_unknown")
            strategies[column] = "mode" if len(mode) else "Unknown"
    if imputed.any():
        frame["_imputed_fields"] = imputed.str.rstrip("|").astype("string")
    invalid = transaction_frame(frame, mapping)["invalid"]
    return frame, changes, strategies, {"count": int(invalid.sum()), "rows": [int(i) + 1 for i in frame.index[invalid][:100]], "truncated": int(invalid.sum()) > 100}


def records(frame):
    # JSON round-trip handles numpy values, timestamps, missing values, and infinities.
    import json
    return json.loads(frame.to_json(orient="records", date_format="iso"))


def analytics(frame, mapping, filters=None, interval="daily"):
    if not mapping.get("order_date") or not (mapping.get("amount") or mapping.get("price")):
        raise ValueError("Map an order date and amount (or price) before running analytics")
    original = transaction_frame(frame, mapping)
    data = original.copy()
    filters = filters or {}
    for field in ("category", "city", "state", "customer_id", "country", "store_id"):
        if filters.get(field):
            data = data.loc[data[field] == filters[field]]
    for key in ("start", "end"):
        if filters.get(key):
            timestamp = pd.to_datetime(filters[key], errors="coerce")
            if pd.isna(timestamp):
                raise ValueError("Use a valid filter date")
            data = data.loc[data.order_date >= timestamp.normalize()] if key == "start" else data.loc[data.order_date < timestamp.normalize() + pd.Timedelta(days=1)]
    excluded = int(data["invalid"].sum())
    valid = data.loc[~data["invalid"]]
    sales = valid.loc[valid["status"] == "Completed"].copy()
    history = original.loc[~original.invalid & (original.status == "Completed") & (original.customer_id != "")].sort_values(["order_date", "order_key"])
    first_orders = history.drop_duplicates("customer_id").set_index("customer_id").order_key
    known_customer = sales.customer_id != ""
    first_purchase = known_customer & sales.order_key.eq(sales.customer_id.map(first_orders))
    sales["new_order_key"] = sales.order_key.where(first_purchase)
    sales["returning_order_key"] = sales.order_key.where(known_customer & ~first_purchase)
    orders = int(valid["order_key"].nunique())
    completed_orders = int(sales["order_key"].nunique())
    revenue = float(sales["amount"].sum())
    kpis = {"revenue": round(revenue, 2), "orders": orders,
            "customers": int(valid.loc[valid.customer_id != "", "customer_id"].nunique()),
            "products": int(valid.loc[(valid.product_id != "") | (valid["product"] != "")].apply(lambda row: row.product_id or row["product"], axis=1).nunique()),
            "average_order_value": round(revenue / max(1, completed_orders), 2),
            "cancellation_rate": round(valid.loc[valid.status == "Cancelled", "order_key"].nunique() / max(1, orders) * 100, 2),
            "excluded_rows": excluded}

    def grouped(field, limit=12):
        groups = sales.assign(**{field: sales[field].replace("", "Unknown")}).groupby(field).agg(revenue=("amount", "sum"), units=("quantity", "sum"), orders=("order_key", "nunique")).reset_index().sort_values("revenue", ascending=False)
        return records(groups.head(limit))

    frequency = {"daily": "D", "weekly": "W-MON", "monthly": "MS"}.get(interval, "D")
    trend = sales.set_index("order_date").resample(frequency).agg(revenue=("amount", "sum"), orders=("order_key", "nunique"), new_orders=("new_order_key", "nunique"), returning_orders=("returning_order_key", "nunique")).reset_index() if len(sales) else pd.DataFrame(columns=["order_date", "revenue", "orders", "new_orders", "returning_orders"])
    products = sales.groupby(["product_id", "product"], dropna=False).agg(revenue=("amount", "sum"), units=("quantity", "sum")).reset_index().sort_values("units", ascending=False)
    spending = sales.loc[sales.customer_id != ""].groupby("customer_id")["amount"].sum()
    distribution = pd.cut(spending, bins=[-1, 1000, 5000, 10000, 50000, float("inf")], labels=["0–1K", "1–5K", "5–10K", "10–50K", "50K+"]).value_counts(sort=False)
    insights = []
    if len(sales):
        last = sales.order_date.max()
        current = sales.loc[sales.order_date > last - pd.Timedelta(days=30)].groupby("category").amount.sum()
        previous = sales.loc[(sales.order_date > last - pd.Timedelta(days=60)) & (sales.order_date <= last - pd.Timedelta(days=30))].groupby("category").amount.sum()
        for category in previous.index:
            if previous[category] > 0 and current.get(category, 0) < previous[category] * .85:
                insights.append(f"{category or 'Uncategorised'} revenue declined {(1 - current.get(category, 0) / previous[category]) * 100:.1f}% in the last 30 days versus the preceding 30 days.")
        daily = sales.groupby(sales.order_date.dt.normalize()).amount.sum()
        if daily.std() > 0:
            unusual = daily.loc[((daily - daily.mean()) / daily.std()).abs() > 2.5]
            for day, amount in unusual.head(5).items():
                insights.append(f"Sales of {amount:,.2f} on {day.date()} were more than 2.5 standard deviations from the daily mean.")
        if len(spending):
            top = spending.loc[spending >= spending.quantile(.9)]
            insights.append(f"{len(top)} customers in the top spending decile generated {top.sum():,.2f}; consider a loyalty reward.")
        for field in ("payment_method", "category", "city"):
            if mapping.get(field):
                rates = valid.assign(cancelled=valid.status == "Cancelled").groupby(field).agg(rate=("cancelled", "mean"), count=("cancelled", "size"))
                rates = rates.loc[rates["count"] >= 10].sort_values("rate", ascending=False)
                if len(rates):
                    insights.append(f"{rates.index[0]} has a {rates.iloc[0]['rate'] * 100:.1f}% cancellation rate across {int(rates.iloc[0]['count'])} lines ({field}); this is an association, not a proven cause.")
        if len(valid) >= 20 and valid.amount.nunique() >= 4:
            bands = pd.qcut(valid.amount, q=4, duplicates="drop")
            rates = valid.assign(band=bands, cancelled=valid.status == "Cancelled").groupby("band", observed=True).agg(rate=("cancelled", "mean"), count=("cancelled", "size")).sort_values("rate", ascending=False)
            if len(rates):
                insights.append(f"Order-line amounts in {rates.index[0]} have a {rates.iloc[0]['rate'] * 100:.1f}% cancellation rate across {int(rates.iloc[0]['count'])} lines; compare this price range with other factors before acting.")
        if len(products):
            weakest = products.iloc[-1]
            insights.append(f"{weakest['product'] or weakest['product_id']} sold {weakest['units']:g} units; review placement or a targeted promotion.")
    options = {field: sorted(original[field].replace("", pd.NA).dropna().unique().tolist()) for field in ("category", "city", "state", "country", "store_id", "customer_id")}
    statuses = records(valid.groupby("status").agg(orders=("order_key", "nunique")).reset_index())
    repeat = sales.loc[known_customer].groupby("customer_id").order_key.nunique()
    customer_behavior = {"purchasing_customers": len(repeat), "repeat_customers": int((repeat > 1).sum()), "repeat_rate": round(float((repeat > 1).mean() * 100), 2) if len(repeat) else 0,
                         "new_orders": int(sales.new_order_key.nunique()), "returning_orders": int(sales.returning_order_key.nunique())}
    return {"kpis": kpis, "trend": records(trend), "best_products": records(products.head(10)), "least_products": records(products.tail(10).sort_values("units")),
            "categories": grouped("category"), "cities": grouped("city"), "states": grouped("state"), "stores": grouped("store_id"),
            "spending": [{"band": str(band), "customers": int(count)} for band, count in distribution.items()],
            "insights": insights or ["No rule thresholds were crossed in this filtered view."], "options": options,
            "order_status": statuses, "customer_behavior": customer_behavior, "currency": currency_code(frame, mapping),
            "product_outlook": product_outlook(sales, valid.order_date.max() if len(valid) else None),
            "period": {"start": valid.order_date.min().isoformat() if len(valid) else None, "end": valid.order_date.max().isoformat() if len(valid) else None},
            "basis": "Completed valid lines only for revenue; all valid statuses for orders and cancellation rate. Financial imputations excluded."}


def product_outlook(sales, observed_date):
    method = "Trailing three calendar months before the final observed month; simple average units, not an evaluated forecast model."
    if sales.empty or observed_date is None or pd.isna(observed_date):
        return {"available": False, "products": [], "method": method, "note": "No completed sales in this view."}
    if not ((sales["product"] != "") | (sales.product_id != "")).any():
        return {"available": False, "products": [], "method": method, "note": "Map a product name or SKU to see a product outlook."}
    observed_month = observed_date.to_period("M")
    months = pd.period_range(end=observed_month - 1, periods=3, freq="M")
    if sales.order_date.min().to_period("M") > months[0]:
        return {"available": False, "products": [], "method": method, "note": "Needs three prior calendar months plus a later observation month."}
    monthly = sales.assign(month=sales.order_date.dt.to_period("M")).groupby(["product_id", "product", "month"]).quantity.sum().unstack(fill_value=0)
    recent = monthly.reindex(columns=months, fill_value=0)
    products = []
    for (product_id, product), mean_units in recent.mean(axis=1).nlargest(200).items():
        values = recent.loc[(product_id, product)]
        baseline = float(mean_units)
        last = float(values.iloc[-1])
        change = (baseline / last - 1) * 100 if last > 0 else None
        direction = "Rising" if change is not None and change > 5 else "Cooling" if change is not None and change < -5 else "Steady" if change is not None else "Limited recent sales"
        products.append({"product_id": product_id, "product": product, "baseline_units": round(baseline, 1), "last_month_units": last,
                         "change_percent": round(change, 1) if change is not None else None, "direction": direction,
                         "history": [{"month": str(month), "units": float(value)} for month, value in values.items()]})
    products.sort(key=lambda row: row["baseline_units"], reverse=True)
    return {"available": True, "month": str(observed_month + 1), "basis_start": str(months[0]), "basis_end": str(months[-1]),
            "products": products[:200], "method": method, "note": "Compared with the last complete baseline month; includes zero-sale months. Uses the active filters."}


FEATURES = ["recency", "frequency", "monetary", "average_order_value", "cancellation_rate", "tenure", "category_diversity"]


def customer_features(data, reference):
    sales = data.loc[(data.status == "Completed") & ~data.invalid & (data.customer_id != "")]
    base = sales.groupby("customer_id").agg(last=("order_date", "max"), first=("order_date", "min"), frequency=("order_key", "nunique"), monetary=("amount", "sum"), category_diversity=("category", "nunique"))
    base["recency"] = (reference - base["last"]).dt.days.clip(lower=0)
    base["tenure"] = (reference - base["first"]).dt.days.clip(lower=0)
    base["average_order_value"] = base.monetary / base.frequency
    valid = data.loc[~data.invalid]
    counts = valid.groupby("customer_id").order_key.nunique()
    cancelled = valid.loc[valid.status == "Cancelled"].groupby("customer_id").order_key.nunique()
    base["cancellation_rate"] = (cancelled / counts).reindex(base.index).fillna(0)
    return base[FEATURES].astype(float)


def train_churn(frame, mapping):
    from sklearn.cluster import KMeans
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    if not eligibility(mapping)["eligible"]:
        raise ValueError(eligibility(mapping)["note"])
    data = transaction_frame(frame, mapping)
    valid = data.loc[~data.invalid]
    if valid.empty:
        raise ValueError("No valid transactions are available for training")
    end = valid.order_date.max()
    cutoff = end - pd.Timedelta(days=90)
    if (end - valid.order_date.min()).days < 180:
        raise ValueError("Churn needs at least 180 days of valid history for features and the 90-day outcome window")
    before = valid.loc[valid.order_date <= cutoff]
    after = valid.loc[(valid.order_date > cutoff) & (valid.order_date <= cutoff + pd.Timedelta(days=90)) & (valid.status == "Completed")]
    features = customer_features(before, cutoff)
    labels = pd.Series((~features.index.isin(after.customer_id)).astype(int), index=features.index)
    if len(features) < 30 or labels.nunique() < 2 or labels.value_counts().min() < 5:
        raise ValueError("Need at least 30 customers and five examples of each churn class before training")
    x_train, x_test, y_train, y_test = train_test_split(features, labels, test_size=.25, random_state=SEED, stratify=labels)
    models = {"Logistic regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, random_state=SEED)),
              "Random forest": RandomForestClassifier(n_estimators=100, max_depth=8, min_samples_leaf=3, random_state=SEED, n_jobs=2)}
    metrics = []
    for name, model in models.items():
        model.fit(x_train, y_train)
        predictions = model.predict(x_test)
        importance = model.feature_importances_ if name == "Random forest" else model[-1].coef_[0]
        metrics.append({"name": name, "accuracy": float(accuracy_score(y_test, predictions)), "precision": float(precision_score(y_test, predictions, zero_division=0)),
                        "recall": float(recall_score(y_test, predictions, zero_division=0)), "f1": float(f1_score(y_test, predictions, zero_division=0)),
                        "confusion_matrix": confusion_matrix(y_test, predictions, labels=[0, 1]).tolist(),
                        "importance": [{"feature": f, "value": float(v)} for f, v in zip(FEATURES, importance)]})
    # Score current features with the training-only fitted model, preserving holdout metrics.
    current = customer_features(valid, end)
    probabilities = models["Random forest"].predict_proba(current)[:, 1]
    distinct = min(4, len(current[["recency", "frequency", "monetary"]].drop_duplicates()))
    if distinct < 4:
        raise ValueError("Need four distinct RFM profiles for the requested segmentation")
    scaled = StandardScaler().fit_transform(np.log1p(current[["recency", "frequency", "monetary"]]))
    clusters = KMeans(n_clusters=4, random_state=SEED, n_init=10).fit_predict(scaled)
    ranking = pd.DataFrame({"cluster": clusters, "score": scaled[:, 1] + scaled[:, 2] - scaled[:, 0]}).groupby("cluster").score.mean().sort_values(ascending=False).index
    names = dict(zip(ranking, ["Champions", "Loyal", "At Risk", "Lost"]))
    current["probability"] = probabilities
    current["risk"] = np.where(probabilities < .33, "Low", np.where(probabilities <= .66, "Medium", "High"))
    current["segment"] = [names[c] for c in clusters]
    current["recommendation"] = ["Offer a personal check-in and a modest win-back discount." if p > .66 else "Share relevant replenishment reminders." if p >= .33 else "Reward loyalty and recommend related products." for p in probabilities]
    return {"cutoff": cutoff.isoformat(), "last_date": end.isoformat(), "definition": "Churned = no completed purchase in the 90 days after the cutoff. Features use dates at or before cutoff; labels use dates after cutoff.",
            "train_customers": len(x_train), "test_customers": len(x_test), "feature_max_date": before.order_date.max().isoformat(),
            "label_min_date": after.order_date.min().isoformat() if len(after) else None, "models": metrics,
            "customers": records(current.reset_index()), "seed": SEED, "currency": currency_code(frame, mapping), "scoring_date": end.isoformat(),
            "limitation": "Single historical cutoff and random customer holdout; not prospective validation. Cluster names are ranked RFM descriptions, not ground-truth classes."}
