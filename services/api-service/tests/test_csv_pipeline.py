from io import BytesIO
import os
import unittest
from uuid import uuid4

import bcrypt

from fastapi.testclient import TestClient

from app.csv_pipeline import organize_csv
from app.database import open_database
from app.main import app, edits_path, organized_path, styles_path, upload_directory


class CsvPipelineTests(unittest.TestCase):
    def selected_token(self, client: TestClient) -> str:
        login = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
        login_token = login.json()["access_token"]
        workspaces = client.get("/workspaces", headers={"Authorization": f"Bearer {login_token}"}).json()
        selected = client.post(f"/workspaces/{workspaces[0]['id']}/select", headers={"Authorization": f"Bearer {login_token}"})
        return selected.json()["access_token"]

    def test_cleaning_and_duplicate_review(self):
        source = b"Customer Name,Email,Category\nAlice,alice@example.com,Shirts\nAlice,alice@example.com,Shirts\nAlicee,alice@example.com,Shirts\nBob,,Shirts\n"
        result = organize_csv(source)
        self.assertEqual(result.summary["organized_rows"], 3)
        self.assertEqual(result.summary["exact_duplicates_removed"], 1)
        self.assertEqual(result.summary["missing_values"], {"email": 1})
        self.assertEqual(result.summary["possible_duplicates"][0]["field"], "customer_name")
        self.assertEqual(result.summary["understanding"]["dataset_type"], "customers")
        self.assertEqual(result.summary["understanding"]["likely_field_types"]["email"], "email text")
        self.assertTrue(any(change["action"] == "remove_exact_duplicate" for change in result.changes))

    def test_identifiers_keep_leading_zeroes_and_changes_keep_original_values(self):
        result = organize_csv(b"Product Code,Product Name\n00123,  Blue  shirt  \n")
        self.assertEqual(result.frame.loc[0, "product_code"], "00123")
        self.assertEqual(result.summary["understanding"]["likely_field_types"]["product_code"], "identifier text")
        self.assertTrue(any(change["original_value"] == "  Blue  shirt  " and change["new_value"] == "Blue shirt" for change in result.changes))

    def test_export_escapes_spreadsheet_formula(self):
        client = TestClient(app)
        token = self.selected_token(client)
        source = b"Item Name,Price\nWidget,=2+2\n"
        response = client.post(
            "/csv/export",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("sample.csv", BytesIO(source), "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("'=2+2", response.text)

    def test_upload_requires_login(self):
        client = TestClient(app)
        response = client.post("/csv/analyze", files={"file": ("sample.csv", BytesIO(b"Name\nAlice\n"), "text/csv")})
        self.assertEqual(response.status_code, 401)

    def test_change_log_can_be_downloaded(self):
        client = TestClient(app)
        token = self.selected_token(client)
        response = client.post(
            "/csv/changes",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("sample.csv", BytesIO(b"Customer Name\n Alice \n"), "text/csv")},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("normalize_whitespace", response.text)
        self.assertIn("original_value", response.text)

    def test_workspace_creation_and_selection(self):
        client = TestClient(app)
        login = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
        login_token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {login_token}"}
        self.assertEqual(client.get("/dashboard", headers=headers).status_code, 403)
        created = client.post("/workspaces", headers=headers, json={"name": "RetailPlus Test Workspace"})
        self.assertEqual(created.status_code, 201)
        workspace_id = created.json()["id"]
        try:
            self.assertIn(workspace_id, [item["id"] for item in client.get("/workspaces", headers=headers).json()])
            selected = client.post(f"/workspaces/{workspace_id}/select", headers=headers)
            self.assertEqual(selected.status_code, 200)
            dashboard = client.get("/dashboard", headers={"Authorization": f"Bearer {selected.json()['access_token']}"})
            self.assertEqual(dashboard.status_code, 200)
        finally:
            with open_database() as connection:
                connection.execute("DELETE FROM workspaces WHERE id = %s AND slug = %s", (workspace_id, created.json()["slug"]))

    def test_windows_csv_encoding_and_semicolon_separator(self):
        result = organize_csv("Customer Name;City\nRenée;Montréal\n".encode("cp1252"))
        self.assertEqual(result.summary["source_format"], {"encoding": "windows-1252", "delimiter": ";"})
        self.assertEqual(result.frame.loc[0, "city"], "Montréal")

    def test_new_user_must_create_first_workspace(self):
        user_id = uuid4()
        email = f"workspace-test-{user_id.hex}@retailplus.local"
        password = "local-test-password"
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        with open_database() as connection:
            connection.execute(
                "INSERT INTO users (id, email, password_hash, updated_at) VALUES (%s, %s, %s, NOW())",
                (user_id, email, password_hash),
            )
        try:
            client = TestClient(app)
            login = client.post("/auth/login", json={"email": email, "password": password})
            self.assertEqual(login.status_code, 200)
            token = login.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            self.assertEqual(client.get("/workspaces", headers=headers).json(), [])
            self.assertEqual(client.get("/dashboard", headers=headers).status_code, 403)
            created = client.post("/workspaces", headers=headers, json={"name": "My First Workspace"})
            self.assertEqual(created.status_code, 201)
            self.assertEqual(created.json()["role"], "ADMIN")
        finally:
            with open_database() as connection:
                connection.execute("DELETE FROM workspaces WHERE id IN (SELECT workspace_id FROM memberships WHERE user_id = %s)", (user_id,))
                connection.execute("DELETE FROM users WHERE id = %s", (user_id,))

    def test_saved_dataset_can_be_listed_reopened_and_downloaded(self):
        client = TestClient(app)
        headers = {"Authorization": f"Bearer {self.selected_token(client)}"}
        response = client.post(
            "/datasets/import",
            headers=headers,
            files={"file": ("customers.csv", BytesIO(b"Customer Name,Email\nAlice,alice@example.com\nBob,bob@example.com\n"), "text/csv")},
        )
        self.assertEqual(response.status_code, 201, response.text)
        dataset_id = response.json()["dataset"]["id"]
        try:
            self.assertIn(dataset_id, [item["id"] for item in client.get("/datasets", headers=headers).json()])
            detail = client.get(f"/datasets/{dataset_id}", headers=headers)
            self.assertEqual(detail.json()["summary"]["organized_rows"], 2)
            page = client.get(f"/datasets/{dataset_id}/rows?offset=1&limit=1", headers=headers)
            self.assertEqual(page.json()["rows"][0]["customer_name"], "Bob")
            edit = client.patch(f"/datasets/{dataset_id}/cells", headers=headers, json={"row_index": 1, "column": "customer_name", "value": "Robert"})
            self.assertEqual(edit.status_code, 200, edit.text)
            added = client.post(f"/datasets/{dataset_id}/rows", headers=headers)
            self.assertEqual(added.json()["record_count"], 3)
            removed = client.delete(f"/datasets/{dataset_id}/rows/2", headers=headers)
            self.assertEqual(removed.json()["record_count"], 2)
            page = client.get(f"/datasets/{dataset_id}/rows?offset=1&limit=1", headers=headers)
            self.assertEqual(page.json()["rows"][0]["customer_name"], "Robert")
            styled = client.patch(f"/datasets/{dataset_id}/cells/style", headers=headers, json={"row_index": 1, "column": "customer_name", "bold": True, "fill_color": "#fff2b2"})
            self.assertEqual(styled.status_code, 200, styled.text)
            self.assertEqual(client.get(f"/datasets/{dataset_id}/rows?offset=1&limit=1", headers=headers).json()["styles"]["1"]["customer_name"]["bold"], True)
            export = client.get(f"/datasets/{dataset_id}/download/organized", headers=headers)
            self.assertEqual(export.status_code, 200)
            self.assertIn("alice@example.com", export.text)
            self.assertIn("Robert", export.text)
            changes = client.get(f"/datasets/{dataset_id}/download/changes", headers=headers)
            self.assertIn("edit_cell", changes.text)
            login = client.post("/auth/login", json={"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
            user_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
            other = client.post("/workspaces", headers=user_headers, json={"name": "Dataset Isolation Test"}).json()
            try:
                scoped = client.post(f"/workspaces/{other['id']}/select", headers=user_headers).json()
                other_headers = {"Authorization": f"Bearer {scoped['access_token']}"}
                self.assertNotIn(dataset_id, [item["id"] for item in client.get("/datasets", headers=other_headers).json()])
                self.assertEqual(client.get(f"/datasets/{dataset_id}", headers=other_headers).status_code, 404)
            finally:
                with open_database() as connection:
                    connection.execute("DELETE FROM workspaces WHERE id = %s", (other["id"],))
        finally:
            with open_database() as connection:
                job = connection.execute("SELECT import_job_id FROM datasets WHERE id = %s", (dataset_id,)).fetchone()
                if job:
                    connection.execute("DELETE FROM import_jobs WHERE id = %s", (job["import_job_id"],))
                    connection.execute("DELETE FROM datasets WHERE id = %s", (dataset_id,))
            (upload_directory / f"{dataset_id}.csv").unlink(missing_ok=True)
            organized_path(dataset_id).unlink(missing_ok=True)
            edits_path(dataset_id).unlink(missing_ok=True)
            styles_path(dataset_id).unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
