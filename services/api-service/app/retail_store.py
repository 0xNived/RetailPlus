"""PostgreSQL catalogs and immutable files. Caller holds the dataset advisory lock."""
import hashlib
import json
from pathlib import Path
from uuid import uuid4
import pandas as pd
from .database import open_database
from .retail import guess_mapping, transaction_frame, records

DATA = Path(__file__).resolve().parents[3] / "data"


def save_version(connection, dataset_id, frame, reason, changes=None, mapping=None):
    connection.execute("INSERT INTO retail_dataset_state(dataset_id, mapping) VALUES (%s, %s::jsonb) ON CONFLICT DO NOTHING", (dataset_id, json.dumps(mapping or guess_mapping(frame.columns))))
    state = connection.execute("UPDATE retail_dataset_state SET revision = revision + 1, model = NULL, model_revision = NULL, updated_at = NOW() WHERE dataset_id = %s RETURNING revision", (dataset_id,)).fetchone()
    version = str(uuid4())
    clean = DATA / "clean" / str(dataset_id)
    lake = DATA / "lake" / str(dataset_id)
    clean.mkdir(parents=True, exist_ok=True)
    lake.mkdir(parents=True, exist_ok=True)
    csv_path, parquet_path = clean / f"{version}.csv", lake / f"{version}.parquet"
    content = frame.fillna("").to_csv(index=False).encode("utf-8")
    csv_path.write_bytes(content)
    frame.astype("string").to_parquet(parquet_path, index=False)
    connection.execute("INSERT INTO dataset_versions(id, dataset_id, revision, reason, csv_path, parquet_path, checksum, changes) VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb)",
                       (version, dataset_id, state["revision"], reason, str(csv_path.relative_to(DATA)), str(parquet_path.relative_to(DATA)), hashlib.sha256(content).hexdigest(), json.dumps(changes or [])))
    connection.execute("DELETE FROM retail_customers WHERE dataset_id = %s", (dataset_id,))
    return state["revision"]


def get_state(dataset_id, columns):
    with open_database() as connection:
        state = connection.execute("SELECT mapping, revision, model, model_revision FROM retail_dataset_state WHERE dataset_id = %s", (dataset_id,)).fetchone()
    return state or {"mapping": guess_mapping(columns), "revision": 0, "model": None, "model_revision": None}


def current_snapshot(dataset_id, source, read_organized):
    with open_database() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dataset_id,))
        frame = read_organized(dataset_id, source)
        state = connection.execute("SELECT mapping, revision, model, model_revision FROM retail_dataset_state WHERE dataset_id = %s", (dataset_id,)).fetchone()
        if not state:
            save_version(connection, dataset_id, frame, "Baseline for existing dataset")
            state = connection.execute("SELECT mapping, revision, model, model_revision FROM retail_dataset_state WHERE dataset_id = %s", (dataset_id,)).fetchone()
    return frame, state


def persist_model(dataset_id, revision, model, frame, mapping):
    data = transaction_frame(frame, mapping)
    grouped = {key: group for key, group in data.loc[data.customer_id != ""].groupby("customer_id")}
    documents = []
    for customer in model["customers"]:
        orders = grouped.get(customer["customer_id"])
        doc = {**customer, "total_spend": customer["monetary"], "order_count": customer["frequency"],
               "name": orders.customer_name.iloc[-1] if orders is not None else "",
               "gender": orders.gender.iloc[-1] if orders is not None else "",
               "email": orders.email.iloc[-1] if orders is not None else "",
               "avatar_seed": orders.avatar_seed.iloc[-1] if orders is not None else customer["customer_id"],
               "currency": model.get("currency", "INR"),
               "orders": records(orders[["order_id", "order_date", "product_id", "product", "category", "quantity", "amount", "status", "store_id", "city", "invalid"]]) if orders is not None else []}
        documents.append((dataset_id, customer["customer_id"], revision, json.dumps(doc)))
    with open_database() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dataset_id,))
        updated = connection.execute("UPDATE retail_dataset_state SET model = %s::jsonb, model_revision = %s WHERE dataset_id = %s AND revision = %s RETURNING dataset_id", (json.dumps(model), revision, dataset_id, revision)).fetchone()
        if not updated:
            raise ValueError("Dataset changed while training. Run the pipeline again for the latest version.")
        connection.execute("DELETE FROM retail_customers WHERE dataset_id = %s", (dataset_id,))
        with connection.cursor() as cursor:
            cursor.executemany("INSERT INTO retail_customers(dataset_id, customer_id, revision, document) VALUES (%s,%s,%s,%s::jsonb)", documents)
