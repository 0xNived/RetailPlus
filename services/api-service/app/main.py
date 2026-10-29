from io import StringIO
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
import csv
import hashlib
import json
import os
import re
import tempfile
from uuid import UUID, uuid4

import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import allowed_origin
from .csv_pipeline import MAX_CSV_BYTES, organize_csv
from .database import open_database
from .schemas import CreateWorkspaceRequest, LoginRequest, LoginResult
from pydantic import BaseModel, Field
from .security import make_token, read_token, verify_password
from .retail_store import DATA, save_version


@asynccontextmanager
async def lifespan(app):
    # Local, single-process worker: an interrupted job is retryable, never left running.
    with open_database() as connection:
        connection.execute("""UPDATE retail_pipeline_jobs SET status = 'Failed',
            error = 'API restarted before completion. Run the pipeline again.', completed_at = NOW(),
            stages = COALESCE((SELECT jsonb_agg(CASE WHEN stage->>'status' = 'Running' THEN jsonb_set(stage, '{status}', '\"Failed\"') WHEN stage->>'status' = 'Queued' THEN jsonb_set(stage, '{status}', '\"Skipped\"') ELSE stage END) FROM jsonb_array_elements(stages) stage), '[]'::jsonb)
            WHERE status = 'Running'""")
    yield


app = FastAPI(title="RetailPlus API", version="0.2.0", lifespan=lifespan)
upload_directory = Path(__file__).resolve().parents[3] / "data" / "uploads"


class CellEdit(BaseModel):
    row_index: int = Field(ge=0)
    column: str
    value: str = Field(max_length=10000)


class CellStyleEdit(BaseModel):
    row_index: int = Field(ge=0)
    column: str
    bold: bool | None = None
    italic: bool | None = None
    underline: bool | None = None
    align: Literal["left", "center", "right"] | None = None
    fill_color: str | None = None
    font_color: str | None = None


def organized_path(dataset_id: str) -> Path:
    return upload_directory / f"{dataset_id}-organized.csv"


def edits_path(dataset_id: str) -> Path:
    return upload_directory / f"{dataset_id}-edits.csv"


def styles_path(dataset_id: str) -> Path:
    return upload_directory / f"{dataset_id}-styles.json"


def read_styles(dataset_id: str) -> dict[str, dict[str, dict[str, object]]]:
    path = styles_path(dataset_id)
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}


def save_styles(dataset_id: str, styles: dict[str, dict[str, dict[str, object]]]) -> None:
    descriptor, temporary_name = tempfile.mkstemp(dir=upload_directory, suffix=".json")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(styles, output)
        os.replace(temporary_name, styles_path(dataset_id))
    finally:
        Path(temporary_name).unlink(missing_ok=True)


def save_csv(frame: pd.DataFrame, path: Path) -> None:
    descriptor, temporary_name = tempfile.mkstemp(dir=upload_directory, suffix=".csv")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as output:
            frame.fillna("").to_csv(output, index=False)
        os.replace(temporary_name, path)
    finally:
        Path(temporary_name).unlink(missing_ok=True)


def read_organized(dataset_id: str, source: bytes) -> pd.DataFrame:
    # The committed catalog is authoritative; a failed cache write cannot replace a version.
    with open_database() as connection:
        version = connection.execute("SELECT csv_path FROM dataset_versions WHERE dataset_id = %s ORDER BY revision DESC LIMIT 1", (dataset_id,)).fetchone()
    if version:
        return pd.read_csv(DATA / version["csv_path"], dtype="string", keep_default_na=False).fillna("")
    path = organized_path(dataset_id)
    if path.is_file():
        return pd.read_csv(path, dtype="string", keep_default_na=False).fillna("")
    return organize_csv(source).frame.fillna("")


def append_edit(dataset_id: str, row_index: int, column: str, before: str, after: str, action: str) -> None:
    path = edits_path(dataset_id)
    with path.open("a", encoding="utf-8", newline="") as output:
        writer = csv.writer(output)
        writer.writerow([row_index + 1, column, before, after, action, "manual"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def check_health() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/auth/login", response_model=LoginResult)
def sign_in(login: LoginRequest) -> LoginResult:
    with open_database() as connection:
        user = connection.execute(
            """
            SELECT users.id, users.email, users.display_name, users.password_hash
            FROM users
            WHERE users.email = %s AND users.is_active = TRUE
            """,
            (login.email,),
        ).fetchone()
    if not user or not user["password_hash"] or not verify_password(login.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect")
    token = make_token(str(user["id"]))
    return LoginResult(
        access_token=token,
        token_type="bearer",
        user={"email": user["email"], "name": user["display_name"] or user["email"], "role": ""},
    )


@app.get("/workspaces")
def list_workspaces(token: dict[str, str] = Depends(read_token)) -> list[dict[str, str]]:
    with open_database() as connection:
        rows = connection.execute(
            """
            SELECT workspaces.id, workspaces.name, workspaces.slug, memberships.role
            FROM memberships
            JOIN workspaces ON workspaces.id = memberships.workspace_id
            WHERE memberships.user_id = %s
            ORDER BY memberships.created_at, workspaces.name
            """,
            (token["sub"],),
        ).fetchall()
    return [{"id": str(row["id"]), "name": row["name"], "slug": row["slug"], "role": row["role"]} for row in rows]


@app.post("/workspaces", status_code=201)
def create_workspace(request: CreateWorkspaceRequest, token: dict[str, str] = Depends(read_token)) -> dict[str, str]:
    name = request.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Workspace name must have at least 2 characters")
    slug_base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "workspace"
    slug = f"{slug_base}-{uuid4().hex[:8]}"
    workspace_id = uuid4()
    with open_database() as connection:
        workspace = connection.execute(
            "INSERT INTO workspaces (id, name, slug, updated_at) VALUES (%s, %s, %s, NOW()) RETURNING id, name, slug",
            (workspace_id, name, slug),
        ).fetchone()
        connection.execute(
            "INSERT INTO memberships (workspace_id, user_id, role) VALUES (%s, %s, 'ADMIN')",
            (workspace["id"], token["sub"]),
        )
    return {"id": str(workspace["id"]), "name": workspace["name"], "slug": workspace["slug"], "role": "ADMIN"}


@app.post("/workspaces/{workspace_id}/select")
def select_workspace(workspace_id: str, token: dict[str, str] = Depends(read_token)) -> dict[str, str]:
    try:
        UUID(workspace_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Workspace not found") from error
    with open_database() as connection:
        membership = connection.execute(
            """
            SELECT memberships.role, workspaces.name
            FROM memberships JOIN workspaces ON workspaces.id = memberships.workspace_id
            WHERE memberships.user_id = %s AND workspaces.id = %s
            """,
            (token["sub"], workspace_id),
        ).fetchone()
    if not membership:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return {"access_token": make_token(token["sub"], workspace_id, membership["role"]), "role": membership["role"], "workspace_name": membership["name"]}


def selected_workspace(token: dict[str, str] = Depends(read_token)) -> dict[str, str]:
    workspace_id = token.get("workspace_id")
    if not workspace_id:
        raise HTTPException(status_code=403, detail="Select a workspace first")
    with open_database() as connection:
        membership = connection.execute(
            "SELECT role FROM memberships WHERE user_id = %s AND workspace_id = %s",
            (token["sub"], workspace_id),
        ).fetchone()
    if not membership:
        raise HTTPException(status_code=403, detail="Workspace access has changed")
    token["role"] = membership["role"]
    return token


@app.get("/dashboard")
def get_dashboard(token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    workspace_id = token["workspace_id"]
    with open_database() as connection:
        totals = connection.execute(
            """
            SELECT
              (SELECT COUNT(*) FROM datasets WHERE workspace_id = %s) AS datasets,
              (SELECT COUNT(*) FROM import_jobs WHERE workspace_id = %s) AS imports,
              (SELECT COUNT(*) FROM data_quality_issues issues
               JOIN datasets ON datasets.id = issues.dataset_id
               WHERE datasets.workspace_id = %s AND issues.resolved_at IS NULL) AS open_issues,
              (SELECT COUNT(*) FROM source_files files
               JOIN import_jobs jobs ON jobs.id = files.import_job_id
               WHERE jobs.workspace_id = %s) AS source_files
            """,
            (workspace_id, workspace_id, workspace_id, workspace_id),
        ).fetchone()
        recent_imports = connection.execute(
            """
            SELECT id, name, status, created_at
            FROM import_jobs
            WHERE workspace_id = %s
            ORDER BY created_at DESC
            LIMIT 6
            """,
            (workspace_id,),
        ).fetchall()
    return {"stats": totals, "recent_imports": recent_imports, "role": token["role"]}


@app.get("/datasets")
def list_datasets(token: dict[str, str] = Depends(selected_workspace)) -> list[dict[str, object]]:
    with open_database() as connection:
        rows = connection.execute(
            """SELECT datasets.id, datasets.name, datasets.status, datasets.record_count,
                      datasets.updated_at, source_files.original_name
               FROM datasets
               LEFT JOIN source_files ON source_files.import_job_id = datasets.import_job_id
               WHERE datasets.workspace_id = %s
               ORDER BY datasets.updated_at DESC, datasets.id""",
            (token["workspace_id"],),
        ).fetchall()
    return [{**row, "id": str(row["id"])} for row in rows]


@app.post("/datasets/import", status_code=201)
async def import_dataset(file: UploadFile = File(...), token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    content = await read_csv_upload(file)
    return store_import(content, file.filename or "dataset.csv", token)


def store_import(content: bytes, filename: str, token: dict[str, str]) -> dict[str, object]:
    try:
        result = organize_csv(content)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    dataset_id = uuid4()
    job_id = uuid4()
    source_id = uuid4()
    source_path = upload_directory / f"{dataset_id}.csv"
    upload_directory.mkdir(parents=True, exist_ok=True)
    source_path.write_bytes(content)
    raw_path = DATA / "raw" / f"{dataset_id}.csv"
    raw_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path.write_bytes(content)
    name = Path(filename).stem[:120] or "Untitled dataset"
    try:
        with open_database() as connection:
            connection.execute(
                """INSERT INTO import_jobs (id, workspace_id, created_by_id, status, name, metadata, started_at, completed_at, updated_at)
                   VALUES (%s, %s, %s, 'READY', %s, %s::jsonb, NOW(), NOW(), NOW())""",
                (job_id, token["workspace_id"], token["sub"], name, json.dumps({"pipeline": "csv"})),
            )
            connection.execute(
                """INSERT INTO source_files (id, import_job_id, kind, original_name, mime_type, byte_size, storage_key, checksum)
                   VALUES (%s, %s, 'CSV', %s, 'text/csv', %s, %s, %s)""",
                (source_id, job_id, filename, len(content), str(dataset_id), hashlib.sha256(content).hexdigest()),
            )
            connection.execute(
                """INSERT INTO datasets (id, workspace_id, import_job_id, name, status, schema, record_count, updated_at)
                   VALUES (%s, %s, %s, %s, 'READY', %s::jsonb, %s, NOW())""",
                (dataset_id, token["workspace_id"], job_id, name, json.dumps({"columns": result.summary["columns"]}), result.summary["organized_rows"]),
            )
            connection.execute(
                "INSERT INTO dataset_profiles (id, dataset_id, summary) VALUES (%s, %s, %s::jsonb)",
                (uuid4(), dataset_id, json.dumps(result.summary)),
            )
            save_csv(result.frame, organized_path(str(dataset_id)))
            save_version(connection, str(dataset_id), result.frame, "Initial cleaning", result.changes, result.summary["mapping"])
    except Exception:
        source_path.unlink(missing_ok=True)
        organized_path(str(dataset_id)).unlink(missing_ok=True)
        raw_path.unlink(missing_ok=True)
        raise
    return {"dataset": {"id": str(dataset_id), "name": name, "status": "READY", "record_count": result.summary["organized_rows"]}, "summary": result.summary}


def load_dataset(dataset_id: str, workspace_id: str) -> tuple[dict[str, object], bytes]:
    try:
        UUID(dataset_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Dataset not found") from error
    with open_database() as connection:
        row = connection.execute(
            """SELECT datasets.id, datasets.name, datasets.status, datasets.record_count,
                      dataset_profiles.summary, source_files.storage_key
               FROM datasets
               JOIN dataset_profiles ON dataset_profiles.dataset_id = datasets.id
               JOIN source_files ON source_files.import_job_id = datasets.import_job_id
               WHERE datasets.id = %s AND datasets.workspace_id = %s""",
            (dataset_id, workspace_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Dataset not found")
    source_path = upload_directory / f"{row['id']}.csv"
    if not source_path.is_file():
        raise HTTPException(status_code=404, detail="Dataset source file is missing")
    return row, source_path.read_bytes()


@app.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: str, token: dict[str, str] = Depends(selected_workspace)):
    from .dataset_deletion import delete_saved_dataset
    return delete_saved_dataset(dataset_id, token["workspace_id"])


@app.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str, token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    row, _ = load_dataset(dataset_id, token["workspace_id"])
    return {"id": str(row["id"]), "name": row["name"], "status": row["status"], "record_count": row["record_count"], "summary": row["summary"]}


@app.get("/datasets/{dataset_id}/rows")
def get_dataset_rows(dataset_id: str, offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=100), token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    _, content = load_dataset(dataset_id, token["workspace_id"])
    frame = read_organized(dataset_id, content)
    rows = frame.iloc[offset:offset + limit].fillna("").to_dict(orient="records")
    styles = read_styles(dataset_id)
    visible_styles = {str(index): styles[str(index)] for index in range(offset, min(offset + limit, len(frame))) if str(index) in styles}
    return {"columns": frame.columns.tolist(), "rows": rows, "styles": visible_styles, "total": len(frame), "offset": offset}


@app.patch("/datasets/{dataset_id}/cells/style")
def style_dataset_cell(dataset_id: str, edit: CellStyleEdit, token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    _, source = load_dataset(dataset_id, token["workspace_id"])
    values = edit.model_dump(exclude_unset=True, exclude={"row_index", "column"})
    for name in ("fill_color", "font_color"):
        if name in values and values[name] is not None and not re.fullmatch(r"#[0-9a-fA-F]{6}", values[name]):
            raise HTTPException(status_code=422, detail=f"{name} must be a hex color")
    with open_database() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dataset_id,))
        frame = read_organized(dataset_id, source)
        if edit.row_index >= len(frame) or edit.column not in frame.columns:
            raise HTTPException(status_code=422, detail="Cell is outside the dataset")
        styles = read_styles(dataset_id)
        cell = styles.setdefault(str(edit.row_index), {}).setdefault(edit.column, {})
        cell.update(values)
        save_styles(dataset_id, styles)
        save_version(connection, dataset_id, frame, "Format cell", [{"row": edit.row_index, "column": edit.column, "style": cell}])
        connection.execute("UPDATE datasets SET updated_at = NOW() WHERE id = %s", (dataset_id,))
    return {"row_index": edit.row_index, "column": edit.column, "style": cell}


@app.patch("/datasets/{dataset_id}/cells")
def edit_dataset_cell(dataset_id: str, edit: CellEdit, token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    _, source = load_dataset(dataset_id, token["workspace_id"])
    with open_database() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dataset_id,))
        frame = read_organized(dataset_id, source)
        if edit.row_index >= len(frame) or edit.column not in frame.columns:
            raise HTTPException(status_code=422, detail="Cell is outside the dataset")
        before = str(frame.at[edit.row_index, edit.column])
        frame.at[edit.row_index, edit.column] = edit.value
        save_csv(frame, organized_path(dataset_id))
        append_edit(dataset_id, edit.row_index, edit.column, before, edit.value, "edit_cell")
        save_version(connection, dataset_id, frame, "Edit cell", [{"row": edit.row_index, "column": edit.column, "before": before, "after": edit.value}])
        connection.execute("UPDATE datasets SET updated_at = NOW() WHERE id = %s", (dataset_id,))
    return {"row_index": edit.row_index, "column": edit.column, "value": edit.value}


@app.post("/datasets/{dataset_id}/rows", status_code=201)
def add_dataset_row(dataset_id: str, token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    _, source = load_dataset(dataset_id, token["workspace_id"])
    with open_database() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dataset_id,))
        frame = read_organized(dataset_id, source)
        row_index = len(frame)
        frame.loc[row_index] = {column: "" for column in frame.columns}
        save_csv(frame, organized_path(dataset_id))
        append_edit(dataset_id, row_index, "*", "", "", "add_row")
        save_version(connection, dataset_id, frame, "Add row", [{"row": row_index, "action": "add_row"}])
        connection.execute("UPDATE datasets SET record_count = %s, updated_at = NOW() WHERE id = %s", (len(frame), dataset_id))
    return {"row_index": row_index, "record_count": len(frame)}


@app.delete("/datasets/{dataset_id}/rows/{row_index}")
def delete_dataset_row(dataset_id: str, row_index: int, token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    _, source = load_dataset(dataset_id, token["workspace_id"])
    with open_database() as connection:
        connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dataset_id,))
        frame = read_organized(dataset_id, source)
        if row_index < 0 or row_index >= len(frame):
            raise HTTPException(status_code=422, detail="Row is outside the dataset")
        before = json.dumps(frame.iloc[row_index].to_dict())
        frame = frame.drop(index=row_index).reset_index(drop=True)
        save_csv(frame, organized_path(dataset_id))
        styles = read_styles(dataset_id)
        shifted = {str(int(index) - 1 if int(index) > row_index else int(index)): columns for index, columns in styles.items() if int(index) != row_index}
        save_styles(dataset_id, shifted)
        append_edit(dataset_id, row_index, "*", before, "", "delete_row")
        save_version(connection, dataset_id, frame, "Delete row", [{"row": row_index, "before": before}])
        connection.execute("UPDATE datasets SET record_count = %s, updated_at = NOW() WHERE id = %s", (len(frame), dataset_id))
    return {"record_count": len(frame)}


@app.get("/datasets/{dataset_id}/download/{kind}")
def download_dataset(dataset_id: str, kind: str, token: dict[str, str] = Depends(selected_workspace)) -> StreamingResponse:
    if kind not in {"organized", "changes"}:
        raise HTTPException(status_code=404, detail="Export not found")
    _, content = load_dataset(dataset_id, token["workspace_id"])
    result = organize_csv(content)
    output = StringIO()
    if kind == "organized":
        frame = read_organized(dataset_id, content)
    else:
        columns = ["data_row", "field", "original_value", "new_value", "action", "decision"]
        with open_database() as connection:
            versions = connection.execute("SELECT reason, changes, revision FROM dataset_versions WHERE dataset_id = %s ORDER BY revision", (dataset_id,)).fetchall()
        changes = [] if any(v["reason"] == "Initial cleaning" for v in versions) else result.changes.copy()
        for version in versions:
            for change in version["changes"]:
                if "data_row" in change:
                    changes.append({**change, "action": change["action"] + f" (v{version['revision']})"})
                else:
                    changes.append({"data_row": change.get("row", -1) + 1, "field": change.get("column", "*"), "original_value": change.get("before", ""), "new_value": change.get("after", json.dumps(change.get("style", change.get("mapping", "")))), "action": version["reason"].lower().replace(" ", "_") + f" (v{version['revision']})", "decision": "manual"})
        frame = pd.DataFrame(changes, columns=columns)
        if not versions and edits_path(dataset_id).is_file():
            manual = pd.read_csv(edits_path(dataset_id), names=columns, dtype="string", keep_default_na=False)
            frame = pd.concat([frame, manual], ignore_index=True)
    safe_frame = frame.map(lambda value: "'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value)
    safe_frame.to_csv(output, index=False)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f"attachment; filename=retailplus-{kind}.csv"})


async def read_csv_upload(file: UploadFile) -> bytes:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Choose a CSV file")
    content = await file.read(MAX_CSV_BYTES + 1)
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="CSV exceeds the 50 MB limit")
    return content


@app.post("/csv/analyze")
async def analyze_csv(file: UploadFile = File(...), token: dict[str, str] = Depends(selected_workspace)) -> dict[str, object]:
    try:
        return organize_csv(await read_csv_upload(file)).summary
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/csv/export")
async def export_csv(file: UploadFile = File(...), token: dict[str, str] = Depends(selected_workspace)) -> StreamingResponse:
    try:
        result = organize_csv(await read_csv_upload(file))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    output = StringIO()
    safe_frame = result.frame.map(lambda value: "'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value)
    safe_frame.to_csv(output, index=False)
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=retailplus-organized.csv"})


@app.post("/csv/changes")
async def export_changes(file: UploadFile = File(...), token: dict[str, str] = Depends(selected_workspace)) -> StreamingResponse:
    try:
        result = organize_csv(await read_csv_upload(file))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    columns = ["data_row", "field", "original_value", "new_value", "action", "decision"]
    output = StringIO()
    changes = pd.DataFrame(result.changes, columns=columns)
    safe_changes = changes.map(lambda value: "'" + value if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")) else value)
    safe_changes.to_csv(output, index=False)
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=retailplus-changes.csv"})


from .retail_routes import install_retail_routes
install_retail_routes(app, selected_workspace, load_dataset, read_organized, store_import, save_csv, organized_path)
