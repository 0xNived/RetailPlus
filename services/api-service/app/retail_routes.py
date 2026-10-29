from io import BytesIO, StringIO
import json
import logging
from time import perf_counter
from uuid import uuid4
from typing import Literal

import pandas as pd
from fastapi import BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation

from .database import open_database
from .csv_pipeline import organize_csv
from .retail import FIELDS, SEED, eligibility, column_types, generate_transactions, analytics, train_churn, transaction_frame, records
from .retail_store import DATA, current_snapshot, save_version, persist_model
from .product_planning import product_plan

logger = logging.getLogger(__name__)


def spark_environment():
    import os
    import shutil
    import sys
    from pathlib import Path
    environment = {**os.environ, "PYSPARK_PYTHON": sys.executable, "PYSPARK_DRIVER_PYTHON": sys.executable}
    java_home = os.getenv("SPARK_JAVA_HOME") or os.getenv("JAVA_HOME")
    if java_home and Path(java_home, "bin").is_dir():
        environment["JAVA_HOME"] = java_home
        environment["PATH"] = str(Path(java_home, "bin")) + os.pathsep + environment.get("PATH", "")
    return environment, bool(shutil.which("java", path=environment.get("PATH")))


class MappingRequest(BaseModel):
    mapping: dict[str, str]


class PipelineRequest(BaseModel):
    dataset_id: str | None = None
    size: Literal[10000, 50000, 100000] = 10000


def install_retail_routes(app, selected_workspace, load_dataset, read_organized, store_import, save_csv, organized_path):
    def snapshot(dataset_id, token):
        _, source = load_dataset(dataset_id, token["workspace_id"])
        return current_snapshot(dataset_id, source, read_organized)

    @app.get("/retail/product-planning")
    def planning(dataset_id: str, search: str = "", category: str = "", product_key: str = "", offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100), token=Depends(selected_workspace)):
        frame, state = snapshot(dataset_id, token)
        try:
            result = product_plan(frame, state["mapping"])
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        products = result.pop("products")
        matched = [p for p in products if (not category or p["category"] == category) and search.casefold() in (p["product"] + " " + p["product_id"]).casefold()]
        selected = next((p for p in products if p["key"] == product_key), None) if product_key else None
        return {**result, "revision": state["revision"], "products": matched[offset:offset + limit], "total": len(matched), "offset": offset, "selected": selected}

    @app.get("/retail/datasets/{dataset_id}/mapping")
    def get_mapping(dataset_id: str, token=Depends(selected_workspace)):
        frame, state = snapshot(dataset_id, token)
        return {"columns": list(frame.columns), "column_types": column_types(frame, state["mapping"]), "fields": list(FIELDS), "mapping": state["mapping"], "revision": state["revision"], **eligibility(state["mapping"])}

    @app.put("/retail/datasets/{dataset_id}/mapping")
    def set_mapping(dataset_id: str, body: MappingRequest, token=Depends(selected_workspace)):
        _, source = load_dataset(dataset_id, token["workspace_id"])
        with open_database() as connection:
            connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dataset_id,))
            frame = read_organized(dataset_id, source)
            if any(key not in FIELDS or (value and value not in frame.columns) for key, value in body.mapping.items()):
                raise HTTPException(422, "Mapping contains an unknown field or column")
            assigned = [v for v in body.mapping.values() if v]
            if len(set(assigned)) != len(assigned):
                raise HTTPException(422, "Each source column can map to only one retail field")
            mapping = {key: body.mapping.get(key, "") for key in FIELDS}
            previous = connection.execute("SELECT mapping FROM retail_dataset_state WHERE dataset_id = %s", (dataset_id,)).fetchone()
            if previous and previous["mapping"] == mapping:
                return {"mapping": mapping, **eligibility(mapping)}
            save_version(connection, dataset_id, frame, "Update column mapping", [{"mapping": mapping}], mapping)
            connection.execute("UPDATE retail_dataset_state SET mapping = %s::jsonb WHERE dataset_id = %s", (json.dumps(mapping), dataset_id))
        return {"mapping": mapping, **eligibility(mapping)}

    @app.get("/retail/datasets/{dataset_id}/versions")
    def versions(dataset_id: str, token=Depends(selected_workspace)):
        snapshot(dataset_id, token)
        with open_database() as connection:
            return connection.execute("SELECT id, revision, reason, checksum, created_at FROM dataset_versions WHERE dataset_id = %s ORDER BY revision DESC", (dataset_id,)).fetchall()

    @app.get("/retail/datasets/{dataset_id}/versions/{revision}/download")
    def download_version(dataset_id: str, revision: int, kind: Literal["csv", "parquet"] = "csv", token=Depends(selected_workspace)):
        load_dataset(dataset_id, token["workspace_id"])
        with open_database() as connection:
            row = connection.execute("SELECT csv_path, parquet_path FROM dataset_versions WHERE dataset_id = %s AND revision = %s", (dataset_id, revision)).fetchone()
        if not row:
            raise HTTPException(404, "Version not found")
        if kind == "parquet":
            content = (DATA / row["parquet_path"]).read_bytes()
        else:
            frame = pd.read_csv(DATA / row["csv_path"], dtype="string", keep_default_na=False)
            content = safe_csv(frame)
        return StreamingResponse(iter([content]), media_type="application/octet-stream", headers={"Content-Disposition": f'attachment; filename="retailplus-v{revision}.{kind}"'})

    @app.get("/retail/datasets/{dataset_id}/raw")
    def raw_download(dataset_id: str, token=Depends(selected_workspace)):
        _, source = load_dataset(dataset_id, token["workspace_id"])
        return StreamingResponse(iter([source]), media_type="application/octet-stream", headers={"Content-Disposition": 'attachment; filename="retailplus-raw.csv"'})

    @app.get("/kpis")
    @app.get("/retail/analytics")
    def get_analytics(dataset_id: str, interval: Literal["daily", "weekly", "monthly"] = "daily", start: str = "", end: str = "", category: str = "", city: str = "", state: str = "", country: str = "", store_id: str = "", customer_id: str = "", token=Depends(selected_workspace)):
        frame, state_data = snapshot(dataset_id, token)
        try:
            return analytics(frame, state_data["mapping"], {"start": start, "end": end, "category": category, "city": city, "state": state, "country": country, "store_id": store_id, "customer_id": customer_id}, interval)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.get("/retail/model")
    def model(dataset_id: str, token=Depends(selected_workspace)):
        _, state = snapshot(dataset_id, token)
        if not state["model"] or state["model_revision"] != state["revision"]:
            raise HTTPException(409, "Run the full pipeline to train models for this dataset version.")
        return {**state["model"], "revision": state["revision"]}

    @app.get("/retail/customers")
    def customers(dataset_id: str, search: str = "", segment: str = "", risk: str = "", gender: str = "", min_spend: float = Query(0, ge=0), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200), sort: Literal["spend", "orders", "recency", "risk", "name"] = "spend", direction: Literal["asc", "desc"] = "desc", token=Depends(selected_workspace)):
        load_dataset(dataset_id, token["workspace_id"])
        clauses = ["dataset_id = %s", "(customer_id ILIKE %s OR document->>'name' ILIKE %s)", "(document->>'total_spend')::numeric >= %s"]
        values = [dataset_id, f"%{search}%", f"%{search}%", min_spend]
        for field, value in (("segment", segment), ("risk", risk), ("gender", gender)):
            if value:
                clauses.append(f"document->>'{field}' = %s")
                values.append(value)
        where = " AND ".join(clauses)
        sort_fields = {"spend": "(document->>'total_spend')::numeric", "orders": "(document->>'frequency')::numeric", "recency": "(document->>'recency')::numeric", "risk": "(document->>'probability')::numeric", "name": "document->>'name'"}
        with open_database() as connection:
            total = connection.execute(f"SELECT COUNT(*) AS count FROM retail_customers WHERE {where}", values).fetchone()["count"]
            rows = connection.execute(f"SELECT document - 'orders' AS document FROM retail_customers WHERE {where} ORDER BY {sort_fields[sort]} {direction.upper()}, customer_id OFFSET %s LIMIT %s", [*values, offset, limit]).fetchall()
        return {"customers": [row["document"] for row in rows], "total": total, "offset": offset, "storage": "PostgreSQL JSONB"}

    @app.get("/retail/customer-overview")
    def customer_overview(dataset_id: str, token=Depends(selected_workspace)):
        load_dataset(dataset_id, token["workspace_id"])
        with open_database() as connection:
            summary = connection.execute("""SELECT COUNT(*) AS customers,
                COALESCE(SUM((document->>'total_spend')::numeric),0) AS revenue,
                COALESCE(AVG((document->>'total_spend')::numeric),0) AS average_spend,
                COALESCE(AVG((document->>'frequency')::numeric),0) AS average_orders,
                COUNT(*) FILTER (WHERE document->>'risk' = 'High') AS high_risk,
                COUNT(*) FILTER (WHERE document->>'risk' = 'Low') AS low_risk,
                COUNT(*) FILTER (WHERE document->>'risk' = 'Medium') AS medium_risk,
                COUNT(*) FILTER (WHERE (document->>'frequency')::numeric > 1) AS returning,
                COALESCE(SUM((document->>'total_spend')::numeric) FILTER (WHERE document->>'risk' = 'High'),0) AS high_risk_spend
                FROM retail_customers WHERE dataset_id = %s""", (dataset_id,)).fetchone()
            segments = connection.execute("""SELECT document->>'segment' AS segment, COUNT(*) AS customers,
                SUM((document->>'total_spend')::numeric) AS spend,
                AVG((document->>'frequency')::numeric) AS average_orders,
                AVG((document->>'recency')::numeric) AS average_recency
                FROM retail_customers WHERE dataset_id = %s GROUP BY document->>'segment'""", (dataset_id,)).fetchall()
            state = connection.execute("SELECT model->>'scoring_date' AS scoring_date FROM retail_dataset_state WHERE dataset_id = %s", (dataset_id,)).fetchone()
        return {"summary": summary, "segments": segments, "scoring_date": state["scoring_date"] if state else None}

    @app.get("/customers/{customer_id}")
    def customer_profile(customer_id: str, dataset_id: str, token=Depends(selected_workspace)):
        load_dataset(dataset_id, token["workspace_id"])
        with open_database() as connection:
            row = connection.execute("SELECT document FROM retail_customers WHERE dataset_id = %s AND customer_id = %s", (dataset_id, customer_id)).fetchone()
        if not row:
            raise HTTPException(404, "Customer not found. Run the pipeline to build customer profiles.")
        return row["document"]

    @app.get("/predict/{customer_id}")
    def predict(customer_id: str, dataset_id: str, token=Depends(selected_workspace)):
        doc = customer_profile(customer_id, dataset_id, token)
        return {key: doc[key] for key in ("customer_id", "probability", "risk", "recommendation")}

    def update_job(job_id, stages, **values):
        with open_database() as connection:
            connection.execute("UPDATE retail_pipeline_jobs SET stages = %s::jsonb, dataset_id = COALESCE(%s, dataset_id), status = %s, error = %s, completed_at = CASE WHEN %s <> 'Running' THEN NOW() ELSE NULL END WHERE id = %s", (json.dumps(stages), values.get("dataset_id"), values.get("status", "Running"), values.get("error"), values.get("status", "Running"), job_id))

    def pipeline(job_id, request, token):
        stages = [{"name": name, "status": "Queued", "seconds": None} for name in ("Generate" if not request.dataset_id else "Load dataset", "Clean and Parquet", "Analyze", "Train churn models", "Store customers", "Insights")]
        dataset_id = request.dataset_id
        try:
            for index, stage in enumerate(stages):
                stage["status"] = "Running"
                started = perf_counter()
                update_job(job_id, stages, dataset_id=dataset_id)
                if index == 0:
                    if not dataset_id:
                        generated = generate_transactions(request.size)
                    else:
                        frame, state = snapshot(dataset_id, token)
                elif index == 1:
                    if not dataset_id:
                        imported = store_import(generated.to_csv(index=False).encode(), f"Retail demo {request.size:,}.csv", token)
                        dataset_id = imported["dataset"]["id"]
                    else:
                        # Clean a captured current revision, never overwrite immutable raw.
                        cleaned = organize_csv(frame.to_csv(index=False).encode(), state["mapping"])
                        with open_database() as connection:
                            connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dataset_id,))
                            latest = connection.execute("SELECT revision FROM retail_dataset_state WHERE dataset_id = %s", (dataset_id,)).fetchone()
                            if latest["revision"] != state["revision"]:
                                raise ValueError("Dataset changed while cleaning. Run the pipeline again.")
                            save_version(connection, dataset_id, cleaned.frame, "Pipeline cleaning", cleaned.changes)
                            save_csv(cleaned.frame, organized_path(dataset_id))
                            connection.execute("UPDATE dataset_profiles SET summary = %s::jsonb, health_score = %s, profiled_at = NOW() WHERE dataset_id = %s", (json.dumps(cleaned.summary), round(cleaned.summary["quality_after"]["score"]), dataset_id))
                            connection.execute("UPDATE datasets SET record_count = %s, updated_at = NOW() WHERE id = %s", (len(cleaned.frame), dataset_id))
                    frame, state = snapshot(dataset_id, token)
                elif index == 2:
                    analysis = analytics(frame, state["mapping"])
                elif index == 3:
                    trained = train_churn(frame, state["mapping"])
                elif index == 4:
                    persist_model(dataset_id, state["revision"], trained, frame, state["mapping"])
                else:
                    # Evaluated rules run during analytics; this confirms the output is available.
                    analysis["insights"]
                stage["seconds"] = round(perf_counter() - started, 3)
                stage["status"] = "Done"
                update_job(job_id, stages, dataset_id=dataset_id)
            update_job(job_id, stages, dataset_id=dataset_id, status="Done")
        except Exception as error:
            logger.exception("Retail pipeline failed at %s", stage["name"])
            stage["status"] = "Failed"
            stage["seconds"] = round(perf_counter() - started, 3)
            for remaining in stages[index + 1:]:
                remaining["status"] = "Skipped"
            message = str(error) if isinstance(error, ValueError) else "Pipeline failed. Check the API log and retry."
            update_job(job_id, stages, dataset_id=dataset_id, status="Failed", error=message)

    @app.post("/retail/jobs", status_code=202)
    def start_pipeline(body: PipelineRequest, background: BackgroundTasks, token=Depends(selected_workspace)):
        if body.dataset_id:
            from uuid import UUID
            try:
                UUID(body.dataset_id)
            except ValueError as error:
                raise HTTPException(404, "Dataset not found") from error
        job_id = str(uuid4())
        try:
            with open_database() as connection:
                connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (token["workspace_id"],))
                if body.dataset_id:
                    if not connection.execute("SELECT 1 FROM datasets WHERE id=%s AND workspace_id=%s", (body.dataset_id, token["workspace_id"])).fetchone():
                        raise HTTPException(404, "Dataset not found")
                connection.execute("INSERT INTO retail_pipeline_jobs(id, workspace_id, dataset_id) VALUES (%s,%s,%s)", (job_id, token["workspace_id"], body.dataset_id))
        except UniqueViolation as error:
            raise HTTPException(409, "A pipeline is already running in this workspace. View its progress before starting another.") from error
        background.add_task(pipeline, job_id, body, dict(token))
        return {"id": job_id, "status": "Running"}

    @app.get("/retail/jobs")
    def jobs(token=Depends(selected_workspace)):
        with open_database() as connection:
            return connection.execute("SELECT * FROM retail_pipeline_jobs WHERE workspace_id = %s ORDER BY started_at DESC LIMIT 10", (token["workspace_id"],)).fetchall()

    @app.get("/retail/jobs/{job_id}")
    def job(job_id: str, token=Depends(selected_workspace)):
        try:
            from uuid import UUID
            UUID(job_id)
        except ValueError as error:
            raise HTTPException(404, "Job not found") from error
        with open_database() as connection:
            row = connection.execute("SELECT * FROM retail_pipeline_jobs WHERE id = %s AND workspace_id = %s", (job_id, token["workspace_id"])).fetchone()
        if not row:
            raise HTTPException(404, "Job not found")
        return row

    @app.get("/retail/report")
    def report(dataset_id: str, kind: Literal["csv", "pdf", "risk"] = "csv", start: str = "", end: str = "", category: str = "", city: str = "", state: str = "", country: str = "", store_id: str = "", customer_id: str = "", token=Depends(selected_workspace)):
        frame, state_data = snapshot(dataset_id, token)
        filters = {"start": start, "end": end, "category": category, "city": city, "state": state, "country": country, "store_id": store_id, "customer_id": customer_id}
        if kind == "risk":
            if not state_data["model"]:
                raise HTTPException(409, "Run the pipeline first")
            high = pd.DataFrame([c for c in state_data["model"]["customers"] if c["risk"] == "High"])
            output = safe_csv(high)
        else:
            try:
                result = analytics(frame, state_data["mapping"], filters)
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
            if kind == "csv":
                output = safe_csv(pd.DataFrame([{"section": "kpi", "name": key, "value": value} for key, value in result["kpis"].items()] + [{"section": "filter", "name": key, "value": value} for key, value in filters.items()] + [{"section": "daily_sales", "name": row["order_date"], "value": row["revenue"]} for row in result["trend"]]))
            else:
                from reportlab.lib.styles import getSampleStyleSheet
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
                from xml.sax.saxutils import escape
                buffer = BytesIO()
                styles = getSampleStyleSheet()
                text = ["RetailPlus retail report", f"Dataset {dataset_id}, revision {state_data['revision']}", "Filters: " + json.dumps(filters), result["basis"]]
                text += [f"{key.replace('_', ' ').title()}: {value:,.2f}" for key, value in result["kpis"].items()]
                text += result["insights"]
                elements = []
                for line in text:
                    elements.extend([Paragraph(escape(line), styles["BodyText"]), Spacer(1, 10)])
                SimpleDocTemplate(buffer).build(elements)
                output = buffer.getvalue()
        extension = "pdf" if kind == "pdf" else "csv"
        return StreamingResponse(iter([output]), media_type="application/pdf" if kind == "pdf" else "text/csv", headers={"Content-Disposition": f'attachment; filename="retailplus-report.{extension}"'})

    @app.get("/retail/simulation/sample")
    def simulation_sample(dataset_id: str, token=Depends(selected_workspace)):
        frame, state = snapshot(dataset_id, token)
        if not eligibility(state["mapping"])["eligible"]:
            raise HTTPException(422, eligibility(state["mapping"])["note"])
        data = transaction_frame(frame, state["mapping"])
        sample = data.loc[~data.invalid & (data.status == "Completed")].sample(n=min(500, int((~data.invalid & (data.status == "Completed")).sum())), random_state=SEED)
        return {"transactions": records(sample[["order_id", "customer_id", "product", "amount", "city", "store_id"]]), "simulated": True}

    @app.get("/retail/status")
    def technology_status(dataset_id: str | None = None, token=Depends(selected_workspace)):
        import importlib.util
        import shutil
        state = None
        versions = 0
        customer_count = 0
        if dataset_id:
            _, state = snapshot(dataset_id, token)
            with open_database() as connection:
                versions = connection.execute("SELECT COUNT(*) AS count FROM dataset_versions WHERE dataset_id = %s", (dataset_id,)).fetchone()["count"]
                customer_count = connection.execute("SELECT COUNT(*) AS count FROM retail_customers WHERE dataset_id = %s", (dataset_id,)).fetchone()["count"]
        spark_available = bool(importlib.util.find_spec("pyspark")) and spark_environment()[1]
        spark_evidence = DATA / "lake" / str(dataset_id) / "spark-result.json" if dataset_id else None
        spark_done = False
        if spark_evidence and spark_evidence.is_file():
            evidence = json.loads(spark_evidence.read_text(encoding="utf-8"))
            spark_done = state is not None and evidence.get("revision") == state["revision"]
        def tech(name, status, detail):
            return {"name": name, "status": status, "detail": detail}
        return {"technologies": [
            tech("FastAPI / React / PostgreSQL", "Implemented", "Authenticated, workspace-scoped API and responsive dashboard."),
            tech("CSV cleaning and quality score", "Implemented", "Per-change provenance, before/after completeness, uniqueness and validity; invalid rows retained."),
            tech("Parquet lake and immutable versions", "Implemented", f"{versions} recorded versions for selected dataset. Local files, PostgreSQL catalog; not a distributed lakehouse."),
            tech("Retail analytics and PDF/CSV reports", "Implemented", "Mapped, filtered retail KPIs and deterministic rule-based insights."),
            tech("Churn models / RFM clustering", "Implemented", "Evaluated results available for selected dataset." if state and state["model"] else "Training code implemented; run the pipeline on eligible historical data for results."),
            tech("Customer document store", "Implemented", f"PostgreSQL JSONB, {customer_count} persisted profiles for selected dataset. MongoDB is not used."),
            tech("PySpark DataFrame / RDD / SQL", "Implemented" if spark_done else "Available" if spark_available else "Unavailable", "Successful Spark run recorded for current dataset revision." if spark_done else "Executable worker; not yet successfully run for current dataset." if spark_available else "Executable worker provided. Install requirements-spark.txt and Java 17+ to run; not verified in this environment."),
            tech("Live transaction stream", "Simulated", "Browser session replays synthetic arrivals from selected transaction samples; no Kafka broker."),
            tech("Inventory and restocking", "Simulated", "Explicitly synthetic stock; rule-based scenario from observed sales."),
            tech("Hadoop / HDFS / YARN", "Conceptual", "Architecture explanations only; no Hadoop cluster."),
            tech("Kafka", "Conceptual", "Producer/topic/partition/consumer teaching material; no broker integration."),
            tech("Cloud deployment / CAP", "Conceptual", "Learning material only; no deployed cloud or partition demonstration."),
            tech("Assistant tools", "Planned", "Optional tool-based assistant is not implemented."),
        ]}

    @app.post("/retail/spark")
    def spark_demo(dataset_id: str, token=Depends(selected_workspace)):
        import importlib.util
        import os
        import shutil
        import subprocess
        import sys
        import tempfile
        from pathlib import Path
        _, state = snapshot(dataset_id, token)
        environment, java_available = spark_environment()
        if not importlib.util.find_spec("pyspark") or not java_available:
            raise HTTPException(503, "Spark demo needs Java 17+ on PATH and pip install -r services/api-service/requirements-spark.txt. No Spark results have been simulated.")
        if not state["mapping"].get("order_date") or not (state["mapping"].get("price") or state["mapping"].get("amount")):
            raise HTTPException(422, "Map order date and amount or price before running Spark")
        with open_database() as connection:
            version = connection.execute("SELECT parquet_path FROM dataset_versions WHERE dataset_id = %s AND revision = %s", (dataset_id, state["revision"])).fetchone()
        try:
            with tempfile.TemporaryDirectory(prefix="retailplus-spark-") as temporary:
                config_path = Path(temporary) / "config.json"
                output_path = Path(temporary) / "result.json"
                config_path.write_text(json.dumps({"parquet": str(DATA / version["parquet_path"]), "mapping": state["mapping"]}), encoding="utf-8")
                process = subprocess.run([sys.executable, "-m", "app.spark_demo", str(config_path), str(output_path)], cwd=Path(__file__).resolve().parents[1], env=environment, capture_output=True, text=True, timeout=150)
                if process.returncode or not output_path.is_file():
                    logger.error("Spark worker failed: %s", process.stderr[-4000:])
                    raise HTTPException(503, "Spark worker failed. Check Java/Python compatibility and API logs; no successful run was recorded.")
                result = {**json.loads(output_path.read_text(encoding="utf-8")), "revision": state["revision"]}
                evidence = DATA / "lake" / dataset_id / "spark-result.json"
                evidence.write_text(json.dumps(result), encoding="utf-8")
                return result
        except subprocess.TimeoutExpired as error:
            raise HTTPException(504, "Spark exceeded the 150-second demo limit. Check the local Spark environment.") from error


def safe_csv(frame):
    return frame.map(lambda value: "'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value).to_csv(index=False).encode("utf-8")
