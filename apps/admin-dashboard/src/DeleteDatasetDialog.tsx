import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { retailRequest } from "./retailApi";

export default function DeleteDatasetDialog({
  token,
  dataset,
  onCancel,
  onDeleted,
}: {
  token: string;
  dataset: { id: string; name: string };
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  async function remove() {
    setBusy(true);
    setError("");
    try {
      await retailRequest(token, `/datasets/${dataset.id}`, {
        method: "DELETE",
      });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete dataset");
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="delete-dataset-dialog"
      aria-labelledby="delete-dataset-title"
      aria-describedby="delete-dataset-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="delete-dataset-symbol">
        <Trash2 size={22} />
      </div>
      <h2 id="delete-dataset-title">Delete “{dataset.name}”?</h2>
      <p id="delete-dataset-description">
        This permanently removes this saved dataset, its source copy, saved
        versions, customer profiles, models and processing history from this
        workspace. This cannot be undone.
      </p>
      {error && (
        <p className="csv-error" role="alert">
          {error}
        </p>
      )}
      <div className="delete-dataset-actions">
        <button
          className="secondary-button"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          Keep dataset
        </button>
        <button
          className="dataset-delete-confirm"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? <LoaderCircle size={15} /> : <Trash2 size={15} />}{" "}
          {busy ? "Deleting…" : "Delete dataset"}
        </button>
      </div>
    </dialog>
  );
}
