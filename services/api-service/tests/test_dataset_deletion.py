import os
from pathlib import Path
from uuid import uuid4
from unittest.mock import patch
import unittest
from fastapi.testclient import TestClient
from app.main import app, upload_directory, organized_path, styles_path, edits_path
from app.database import open_database
from app.retail_store import DATA


class DatasetDeletionTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        login = self.client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]}).json()
        self.login = {"Authorization": "Bearer " + login["access_token"]}
        self.workspace = self.client.post("/workspaces", headers=self.login, json={"name": "Deletion automated test"}).json()["id"]
        self.headers = {"Authorization": "Bearer " + self.client.post(f"/workspaces/{self.workspace}/select", headers=self.login).json()["access_token"]}
        self.dataset = self.client.post("/datasets/import", headers=self.headers, files={"file": ("Deletion fixture.csv", b"date,customer_id,product_name,price\n2026-01-01,C001,Notebook,100\n", "text/csv")}).json()["dataset"]["id"]
        styles_path(self.dataset).write_text("{}")
        edits_path(self.dataset).write_text("test edit\n")
        with open_database() as c:
            self.import_job = str(c.execute("SELECT import_job_id FROM datasets WHERE id=%s", (self.dataset,)).fetchone()["import_job_id"])
            c.execute("UPDATE retail_dataset_state SET model='{}'::jsonb, model_revision=revision WHERE dataset_id=%s", (self.dataset,))
            c.execute("INSERT INTO retail_customers(dataset_id,customer_id,revision,document) VALUES (%s,'C001',1,'{}'::jsonb)", (self.dataset,))
        self.paths = [DATA / "raw" / f"{self.dataset}.csv", upload_directory / f"{self.dataset}.csv", organized_path(self.dataset), styles_path(self.dataset), edits_path(self.dataset)]
        for folder in (DATA / "clean" / self.dataset, DATA / "lake" / self.dataset):
            self.paths.extend(folder.iterdir())

    def tearDown(self):
        with open_database() as c:
            c.execute("DELETE FROM retail_pipeline_jobs WHERE workspace_id=%s", (self.workspace,))
        self.client.delete(f"/datasets/{self.dataset}", headers=self.headers)
        with open_database() as c:
            c.execute("DELETE FROM workspaces WHERE id=%s", (self.workspace,))

    def test_delete_cascades_database_and_uuid_owned_files(self):
        neighbor = DATA / "raw" / f"unrelated-{uuid4()}.csv"
        neighbor.write_bytes(b"preserve")
        try:
            result = self.client.delete(f"/datasets/{self.dataset}", headers=self.headers)
            self.assertEqual(result.status_code, 200, result.text)
            self.assertTrue(all(not p.exists() for p in self.paths))
            self.assertEqual(neighbor.read_bytes(), b"preserve")
            self.assertEqual(self.client.get(f"/datasets/{self.dataset}", headers=self.headers).status_code, 404)
            self.assertEqual(self.client.delete(f"/datasets/{self.dataset}", headers=self.headers).status_code, 404)
            with open_database() as c:
                for table in ("datasets", "retail_customers", "dataset_versions", "retail_dataset_state", "dataset_profiles"):
                    field = "id" if table == "datasets" else "dataset_id"
                    self.assertEqual(c.execute(f"SELECT count(*) AS n FROM {table} WHERE {field}=%s", (self.dataset,)).fetchone()["n"], 0)
                self.assertEqual(c.execute("SELECT count(*) AS n FROM import_jobs WHERE id=%s", (self.import_job,)).fetchone()["n"], 0)
        finally:
            neighbor.unlink(missing_ok=True)

    def test_scope_auth_and_running_job_protect_dataset(self):
        self.assertEqual(self.client.delete(f"/datasets/{self.dataset}").status_code, 401)
        other = self.client.post("/workspaces", headers=self.login, json={"name": "Other deletion test"}).json()["id"]
        try:
            headers = {"Authorization": "Bearer " + self.client.post(f"/workspaces/{other}/select", headers=self.login).json()["access_token"]}
            self.assertEqual(self.client.delete(f"/datasets/{self.dataset}", headers=headers).status_code, 404)
        finally:
            with open_database() as c:
                c.execute("DELETE FROM workspaces WHERE id=%s", (other,))
        with open_database() as c:
            c.execute("INSERT INTO retail_pipeline_jobs(id,workspace_id,dataset_id) VALUES (%s,%s,%s)", (str(uuid4()),self.workspace,self.dataset))
        self.assertEqual(self.client.delete(f"/datasets/{self.dataset}", headers=self.headers).status_code, 409)
        self.assertTrue(all(p.exists() for p in self.paths))
        self.assertEqual(self.client.delete("/datasets/not-a-uuid", headers=self.headers).status_code, 404)

    def test_staging_failure_rolls_back_files_and_database(self):
        original = Path.replace
        failed = False

        def fail_once(path, target):
            nonlocal failed
            if ".deleting" in str(target) and not failed and Path(target).name == "1":
                failed = True
                raise OSError("Injected storage failure")
            return original(path, target)

        with patch.object(Path, "replace", fail_once):
            result = TestClient(app, raise_server_exceptions=False).delete(f"/datasets/{self.dataset}", headers=self.headers)
        self.assertEqual(result.status_code, 503)
        self.assertTrue(all(p.exists() for p in self.paths))
        self.assertEqual(self.client.get(f"/datasets/{self.dataset}", headers=self.headers).status_code, 200)

