from io import BytesIO
import json
import os
from pathlib import Path
from time import perf_counter
import unittest

import pandas as pd
from fastapi.testclient import TestClient

from app.csv_pipeline import organize_csv
from app.retail import generate_transactions, guess_mapping, analytics, train_churn, transaction_frame
from app.main import app
from app.database import open_database
from app.retail_store import DATA


class RetailMathTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.generated = generate_transactions(10000)
        cls.cleaned = organize_csv(cls.generated.to_csv(index=False).encode())

    def test_generator_count_identifiers_reproducibility_and_mess(self):
        self.assertEqual(len(self.generated), 10000)
        pd.testing.assert_frame_equal(self.generated, generate_transactions(10000))
        self.assertTrue({"customer_id", "product_id", "store_id", "country", "city", "state", "postal_code"}.issubset(self.generated.columns))
        self.assertGreater(self.generated.duplicated().sum(), 0)
        self.assertTrue(self.generated.customer_id.str.startswith("C-").all())

    def test_cleaning_scores_duplicates_and_invalid_rows_are_retained(self):
        summary = self.cleaned.summary
        self.assertEqual(len(self.cleaned.frame), 9800)
        self.assertEqual(summary["exact_duplicates_removed"], 200)
        for key in ("quality_before", "quality_after"):
            self.assertGreaterEqual(summary[key]["score"], 0)
            self.assertLessEqual(summary[key]["score"], 100)
        self.assertGreater(summary["quality_after"]["score"], summary["quality_before"]["score"])
        self.assertGreater(summary["invalid_transactions"]["count"], 0)
        self.assertTrue((self.cleaned.frame.price == "-10").any())
        self.assertTrue(any(change["action"] == "fill_from_key" for change in self.cleaned.changes))

    def test_mapped_kpis_filters_and_order_grain(self):
        frame = pd.DataFrame({"buyer": ["001", "001", "002", "003", "004"], "when": ["2025-01-01"] * 5,
                              "paid": ["20", "30", "70", "-1", "12"], "state_of_order": ["Completed", "Completed", "Cancelled", "Completed", "Returned"],
                              "invoice": ["A", "A", "B", "C", "D"], "town": ["X", "X", "Y", "X", "Y"], "item": ["SKU1"] * 5}, dtype="string")
        mapping = {"customer_id": "buyer", "order_date": "when", "amount": "paid", "status": "state_of_order", "order_id": "invoice", "city": "town", "product_id": "item"}
        result = analytics(frame, mapping)
        self.assertEqual(result["kpis"]["revenue"], 50)
        self.assertEqual(result["kpis"]["orders"], 3)
        self.assertEqual(result["kpis"]["average_order_value"], 50)
        self.assertEqual(result["kpis"]["cancellation_rate"], 33.33)
        self.assertEqual(result["kpis"]["excluded_rows"], 1)
        filtered = analytics(frame, mapping, {"city": "Y"})
        self.assertEqual(filtered["kpis"]["revenue"], 0)
        self.assertEqual(filtered["kpis"]["orders"], 2)
        self.assertEqual(filtered["best_products"], [])

    def test_empty_filtered_view_has_zero_kpis(self):
        result = analytics(self.cleaned.frame, self.cleaned.summary["mapping"], {"city": "No such city"})
        self.assertEqual(result["kpis"]["revenue"], 0)
        self.assertEqual(result["kpis"]["products"], 0)

    def test_date_filter_includes_the_whole_end_day(self):
        frame = pd.DataFrame({"when": ["2025-01-01T23:59:59", "2025-01-02T00:00:00"], "paid": ["10", "20"]}, dtype="string")
        result = analytics(frame, {"order_date": "when", "amount": "paid"}, {"start": "2025-01-01", "end": "2025-01-01"})
        self.assertEqual(result["kpis"]["revenue"], 10)

    def test_customer_behavior_uses_history_and_distinct_orders(self):
        frame = pd.DataFrame({"customer_id": ["A", "A", "A", "B"], "date": ["2025-01-01", "2025-01-01", "2025-02-01", "2025-02-01"], "order_id": ["first", "first", "repeat", "new-b"], "amount": ["10", "15", "20", "30"]}, dtype="string")
        result = analytics(frame, guess_mapping(frame.columns), {"start": "2025-02-01"}, "monthly")
        self.assertEqual(result["customer_behavior"]["new_orders"], 1)
        self.assertEqual(result["customer_behavior"]["returning_orders"], 1)
        self.assertEqual(result["trend"][0]["orders"], 2)
        self.assertEqual(result["trend"][0]["new_orders"], 1)
        self.assertEqual(result["trend"][0]["returning_orders"], 1)

    def test_next_month_product_baseline_uses_only_prior_three_months(self):
        frame = pd.DataFrame({"date": ["2025-09-01", "2025-10-01", "2025-11-01", "2025-12-15"], "product_id": ["SKU-1"] * 4, "product_name": ["Headphones"] * 4, "quantity": ["10", "20", "30", "999"], "price": ["10"] * 4}, dtype="string")
        result = analytics(frame, guess_mapping(frame.columns))["product_outlook"]
        self.assertTrue(result["available"])
        self.assertEqual(result["month"], "2026-01")
        self.assertEqual(result["products"][0]["baseline_units"], 20)
        self.assertEqual(result["products"][0]["last_month_units"], 30)
        self.assertEqual(result["products"][0]["direction"], "Cooling")
        self.assertEqual(result["products"][0]["change_percent"], -33.3)
        # The partial December observation must not contaminate the baseline.
        self.assertEqual([row["units"] for row in result["products"][0]["history"]], [10, 20, 30])

    def test_product_baseline_requires_enough_filtered_history(self):
        frame = pd.DataFrame({"date": ["2025-11-01", "2025-12-15"], "quantity": ["10", "20"], "price": ["5", "5"]}, dtype="string")
        result = analytics(frame, guess_mapping(frame.columns))["product_outlook"]
        self.assertFalse(result["available"])
        self.assertEqual(result["products"], [])

    def test_product_baseline_does_not_invent_unmapped_products(self):
        frame = pd.DataFrame({"date": ["2025-09-01", "2025-10-01", "2025-11-01", "2025-12-15"], "amount": ["10"] * 4}, dtype="string")
        result = analytics(frame, guess_mapping(frame.columns))["product_outlook"]
        self.assertFalse(result["available"])
        self.assertIn("product name or SKU", result["note"])
        self.assertEqual(analytics(frame, guess_mapping(frame.columns))["kpis"]["products"], 0)

    def test_product_count_uses_names_when_no_sku_is_mapped(self):
        frame = pd.DataFrame({"date": ["2025-09-01", "2025-10-01", "2025-11-01"], "product_name": ["Headphones", "Headphones", "Shirt"], "amount": ["10"] * 3}, dtype="string")
        result = analytics(frame, guess_mapping(frame.columns))
        self.assertEqual(result["kpis"]["products"], 2)

    def test_financial_imputation_excluded_and_markers_survive_recleaning(self):
        frame = pd.DataFrame({"customer_id": ["A", "B"], "date": ["2025-01-01"] * 2, "price": ["10", ""], "quantity": ["1", "1"]}, dtype="string")
        result = organize_csv(frame.to_csv(index=False).encode())
        self.assertEqual(analytics(result.frame, result.summary["mapping"])["kpis"]["revenue"], 10)
        recleaned = organize_csv(result.frame.to_csv(index=False).encode())
        self.assertEqual(analytics(recleaned.frame, recleaned.summary["mapping"])["kpis"]["revenue"], 10)

    def test_models_compute_real_metrics_and_no_future_features(self):
        model = train_churn(self.cleaned.frame, self.cleaned.summary["mapping"])
        self.assertLessEqual(pd.Timestamp(model["feature_max_date"]), pd.Timestamp(model["cutoff"]))
        self.assertGreater(pd.Timestamp(model["label_min_date"]), pd.Timestamp(model["cutoff"]))
        self.assertGreater(model["test_customers"], 0)
        for metrics in model["models"]:
            tn, fp = metrics["confusion_matrix"][0]
            fn, tp = metrics["confusion_matrix"][1]
            self.assertAlmostEqual(metrics["accuracy"], (tn + tp) / (tn + fp + fn + tp))
            self.assertAlmostEqual(metrics["precision"], tp / max(1, tp + fp))
            self.assertAlmostEqual(metrics["recall"], tp / max(1, tp + fn))
            self.assertAlmostEqual(metrics["f1"], 2 * tp / max(1, 2 * tp + fp + fn))
        for customer in model["customers"]:
            p = customer["probability"]
            self.assertEqual(customer["risk"], "Low" if p < .33 else "Medium" if p <= .66 else "High")
        self.assertEqual({c["segment"] for c in model["customers"]}, {"Champions", "Loyal", "At Risk", "Lost"})


class RetailApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        response = cls.client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
        cls.login_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
        workspace = cls.client.post("/workspaces", headers=cls.login_headers, json={"name": "Retail automated integration test"}).json()
        cls.workspace_id = workspace["id"]
        cls.headers = {"Authorization": "Bearer " + cls.client.post(f"/workspaces/{cls.workspace_id}/select", headers=cls.login_headers).json()["access_token"]}
        started = perf_counter()
        job = cls.client.post("/retail/jobs", headers=cls.headers, json={"size": 10000}).json()
        cls.job = cls.client.get(f"/retail/jobs/{job['id']}", headers=cls.headers).json()
        cls.seconds = perf_counter() - started
        cls.dataset_id = cls.job["dataset_id"]

    @classmethod
    def tearDownClass(cls):
        with open_database() as connection:
            datasets = connection.execute("SELECT id FROM datasets WHERE workspace_id = %s", (cls.workspace_id,)).fetchall()
            connection.execute("DELETE FROM workspaces WHERE id = %s", (cls.workspace_id,))
        # Delete only this test's UUID-scoped files, never a shared data directory.
        for row in datasets:
            identifier = str(row["id"])
            for folder in (DATA / "clean" / identifier, DATA / "lake" / identifier):
                if folder.is_dir():
                    for path in folder.iterdir():
                        if path.is_file():
                            path.unlink()
                    folder.rmdir()
            for path in (DATA / "uploads").glob(f"{identifier}*"):
                if path.is_file():
                    path.unlink()
            (DATA / "raw" / f"{identifier}.csv").unlink(missing_ok=True)

    def test_full_pipeline_completes_with_timed_stages(self):
        self.assertEqual(self.job["status"], "Done", self.job)
        self.assertTrue(all(stage["status"] == "Done" for stage in self.job["stages"]))
        self.assertLess(self.seconds, 60)

    def test_customer_jsonb_queries_profile_predict_and_exports(self):
        d = self.dataset_id
        response = self.client.get(f"/retail/customers?dataset_id={d}&segment=At+Risk&min_spend=1000", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["storage"], "PostgreSQL JSONB")
        self.assertGreater(data["total"], 0)
        for customer in data["customers"]:
            self.assertEqual(customer["segment"], "At Risk")
            self.assertGreaterEqual(customer["total_spend"], 1000)
        customer_id = data["customers"][0]["customer_id"]
        profile = self.client.get(f"/customers/{customer_id}?dataset_id={d}", headers=self.headers).json()
        self.assertGreater(len(profile["orders"]), 0)
        prediction = self.client.get(f"/predict/{customer_id}?dataset_id={d}", headers=self.headers)
        self.assertEqual(prediction.status_code, 200)
        for kind in ("csv", "pdf", "risk"):
            report = self.client.get(f"/retail/report?dataset_id={d}&kind={kind}", headers=self.headers)
            self.assertEqual(report.status_code, 200)
            if kind == "pdf":
                self.assertTrue(report.content.startswith(b"%PDF"))

    def test_product_planning_search_category_pagination_and_scope(self):
        d = self.dataset_id
        result = self.client.get(f"/retail/product-planning?dataset_id={d}&limit=1", headers=self.headers)
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertTrue(data["available"])
        self.assertGreater(data["total"], 1)
        first = data["products"][0]
        page = self.client.get(f"/retail/product-planning?dataset_id={d}&limit=1&offset=1", headers=self.headers).json()
        self.assertNotEqual(page["products"][0]["key"], first["key"])
        filtered = self.client.get("/retail/product-planning", headers=self.headers, params={"dataset_id": d, "search": first["product_id"], "category": first["category"], "product_key": first["key"]}).json()
        self.assertEqual(filtered["total"], 1)
        self.assertEqual(filtered["selected"]["key"], first["key"])
        self.assertEqual(self.client.get(f"/retail/product-planning?dataset_id={d}&limit=0", headers=self.headers).status_code, 422)
        self.assertEqual(self.client.get(f"/retail/product-planning?dataset_id={d}").status_code, 401)

    def test_gender_filter_and_profile_metadata(self):
        d = self.dataset_id
        for gender in ("Male", "Female"):
            response = self.client.get(f"/retail/customers?dataset_id={d}&gender={gender}&limit=25", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertGreater(data["total"], 0)
            self.assertTrue(all(c["gender"] == gender for c in data["customers"]))
            customer = data["customers"][0]
            profile = self.client.get(f"/customers/{customer['customer_id']}?dataset_id={d}", headers=self.headers).json()
            self.assertEqual(profile["gender"], gender)
            self.assertEqual(profile["currency"], "INR")
            self.assertTrue(profile["email"].endswith("@example.test"))
            self.assertTrue(profile["avatar_seed"])

    def test_customer_overview_and_server_sorting(self):
        d = self.dataset_id
        response = self.client.get(f"/retail/customer-overview?dataset_id={d}", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(sum(s["customers"] for s in result["segments"]), result["summary"]["customers"])
        self.assertAlmostEqual(sum(s["spend"] for s in result["segments"]), result["summary"]["revenue"])
        self.assertEqual(result["summary"]["low_risk"] + result["summary"]["medium_risk"] + result["summary"]["high_risk"], result["summary"]["customers"])
        for sort, field in (("spend", "monetary"), ("orders", "frequency"), ("risk", "probability"), ("recency", "recency")):
            response = self.client.get(f"/retail/customers?dataset_id={d}&sort={sort}&direction=asc&limit=25", headers=self.headers)
            self.assertEqual(response.status_code, 200)
            values = [c[field] for c in response.json()["customers"]]
            self.assertEqual(values, sorted(values))
        self.assertEqual(self.client.get(f"/retail/customers?dataset_id={d}&sort=unknown", headers=self.headers).status_code, 422)

    def test_mapping_validation_and_workspace_isolation(self):
        d = self.dataset_id
        response = self.client.put(f"/retail/datasets/{d}/mapping", headers=self.headers, json={"mapping": {"customer_id": "nonexistent"}})
        self.assertEqual(response.status_code, 422)
        other = self.client.post("/workspaces", headers=self.login_headers, json={"name": "Retail isolated workspace"}).json()["id"]
        try:
            headers = {"Authorization": "Bearer " + self.client.post(f"/workspaces/{other}/select", headers=self.login_headers).json()["access_token"]}
            for path in (f"/retail/product-planning?dataset_id={d}", f"/retail/analytics?dataset_id={d}", f"/retail/model?dataset_id={d}", f"/retail/datasets/{d}/versions", f"/retail/customers?dataset_id={d}", f"/retail/customer-overview?dataset_id={d}", f"/retail/jobs/{self.job['id']}"):
                self.assertEqual(self.client.get(path, headers=headers).status_code, 404, path)
        finally:
            with open_database() as connection:
                connection.execute("DELETE FROM workspaces WHERE id = %s", (other,))

    def test_versions_preserve_raw_and_invalidate_models_after_edit(self):
        # Independent dataset so other tests retain trained results.
        source = b"customer_id,order_date,amount\n001,2025-01-01,10\n002,2025-01-02,20\n"
        response = self.client.post("/datasets/import", headers=self.headers, files={"file": ("version-test.csv", BytesIO(source), "text/csv")})
        self.assertEqual(response.status_code, 201, response.text)
        d = response.json()["dataset"]["id"]
        edit = self.client.patch(f"/datasets/{d}/cells", headers=self.headers, json={"row_index": 0, "column": "amount", "value": "99"})
        self.assertEqual(edit.status_code, 200, edit.text)
        versions = self.client.get(f"/retail/datasets/{d}/versions", headers=self.headers).json()
        self.assertEqual(len(versions), 2)
        old = self.client.get(f"/retail/datasets/{d}/versions/1/download", headers=self.headers)
        self.assertIn("001,2025-01-01,10", old.text)
        current = self.client.get(f"/datasets/{d}/rows", headers=self.headers).json()
        self.assertEqual(current["rows"][0]["amount"], "99")
        raw = self.client.get(f"/retail/datasets/{d}/raw", headers=self.headers)
        self.assertEqual(raw.content, source)
        parquet = self.client.get(f"/retail/datasets/{d}/versions/2/download?kind=parquet", headers=self.headers)
        self.assertEqual(pd.read_parquet(BytesIO(parquet.content)).iloc[0]["amount"], "99")
        self.assertEqual(self.client.get(f"/retail/model?dataset_id={d}", headers=self.headers).status_code, 409)

    def test_failed_ineligible_pipeline_reports_stage_error(self):
        response = self.client.post("/datasets/import", headers=self.headers, files={"file": ("general.csv", BytesIO(b"name\nAlice\n"), "text/csv")})
        d = response.json()["dataset"]["id"]
        result = self.client.post("/retail/jobs", headers=self.headers, json={"dataset_id": d}).json()
        job = self.client.get(f"/retail/jobs/{result['id']}", headers=self.headers).json()
        self.assertEqual(job["status"], "Failed")
        self.assertIn("Map an order date", job["error"])
        self.assertTrue(any(s["status"] == "Skipped" for s in job["stages"]))

    def test_z_edit_invalidates_previously_trained_model_and_customer_documents(self):
        d = self.dataset_id
        self.assertEqual(self.client.get(f"/retail/model?dataset_id={d}", headers=self.headers).status_code, 200)
        edit = self.client.patch(f"/datasets/{d}/cells", headers=self.headers, json={"row_index": 0, "column": "quantity", "value": "2"})
        self.assertEqual(edit.status_code, 200)
        self.assertEqual(self.client.get(f"/retail/model?dataset_id={d}", headers=self.headers).status_code, 409)
        self.assertEqual(self.client.get(f"/retail/customers?dataset_id={d}", headers=self.headers).json()["total"], 0)


if __name__ == "__main__":
    unittest.main()
