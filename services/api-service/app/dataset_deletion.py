"""Delete one scoped dataset, staging its UUID-owned files for rollback."""
import json
from uuid import UUID, uuid4
from fastapi import HTTPException
from .database import open_database
from .retail_store import DATA


def delete_saved_dataset(dataset_id, workspace_id):
    try:
        identifier = str(UUID(dataset_id))
    except ValueError as error:
        raise HTTPException(404, "Dataset not found") from error
    data_root = DATA.resolve()
    staging = data_root / ".deleting" / str(uuid4())
    manifest = staging / "manifest.json"
    moved = []
    directories = []
    try:
        with open_database() as connection:
            # The workspace lock also serializes pipeline creation against deletion.
            connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (workspace_id,))
            connection.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (identifier,))
            row = connection.execute("SELECT id, import_job_id FROM datasets WHERE id=%s AND workspace_id=%s FOR UPDATE", (identifier, workspace_id)).fetchone()
            if not row:
                raise HTTPException(404, "Dataset not found")
            if connection.execute("SELECT 1 FROM retail_pipeline_jobs WHERE workspace_id=%s AND status='Running' LIMIT 1", (workspace_id,)).fetchone():
                raise HTTPException(409, "Wait for the running pipeline to finish before deleting a dataset.")
            paths = [data_root / "raw" / f"{identifier}.csv"]
            paths += [data_root / "uploads" / f"{identifier}{suffix}" for suffix in (".csv", "-organized.csv", "-edits.csv", "-styles.json")]
            # Include catalog files and orphaned versions, but only under this dataset UUID.
            for folder in (data_root / "clean" / identifier, data_root / "lake" / identifier):
                directories.append(folder)
                if folder.is_symlink() or not folder.resolve().is_relative_to(data_root):
                    raise HTTPException(409, "Dataset storage needs review before deletion.")
                if folder.exists():
                    paths.extend(folder.iterdir())
            for path in paths:
                resolved = path.resolve()
                if path.is_symlink() or not resolved.is_relative_to(data_root) or (path.exists() and not path.is_file()):
                    raise HTTPException(409, "Dataset storage needs review before deletion.")
            staging.mkdir(parents=True)
            manifest.write_text(json.dumps({"dataset_id": identifier, "workspace_id": workspace_id,
                                           "files": [{"source": str(path.relative_to(data_root)), "staged": str(index)} for index, path in enumerate(paths)]}), encoding="utf-8")
            for index, path in enumerate(paths):
                if path.is_file():
                    target = staging / str(index)
                    path.replace(target)
                    moved.append((path, target))
            connection.execute("DELETE FROM datasets WHERE id=%s", (identifier,))
            if row["import_job_id"]:
                connection.execute("DELETE FROM import_jobs WHERE id=%s AND workspace_id=%s AND NOT EXISTS (SELECT 1 FROM datasets WHERE import_job_id=%s)", (row["import_job_id"], workspace_id, row["import_job_id"]))
    except Exception as error:
        for original, staged in reversed(moved):
            staged.replace(original)
        if staging.exists():
            manifest.unlink(missing_ok=True)
            staging.rmdir()
        if isinstance(error, OSError):
            raise HTTPException(503, "Dataset files are unavailable. Deletion was rolled back; try again after closing any open files.") from error
        raise
    # Database removal committed. Staged files contain no active dataset references.
    for _, staged in moved:
        staged.unlink(missing_ok=True)
    manifest.unlink()
    staging.rmdir()
    for folder in directories:
        if folder.exists() and not any(folder.iterdir()):
            folder.rmdir()
    return {"deleted": identifier}
