import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, LoaderCircle, Plus, Store } from "lucide-react";
import { retailRequest } from "./retailApi";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export default function WorkspaceSwitcher({
  token,
  current,
  onSelect,
}: {
  token: string;
  current: Workspace;
  onSelect: (token: string, workspace: Workspace) => void;
}) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    retailRequest<Workspace[]>(token, "/workspaces")
      .then((result) => {
        if (live) setWorkspaces(result);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      live = false;
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, token]);

  async function select(workspace: Workspace) {
    if (workspace.id === current.id) {
      setOpen(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await retailRequest<{ access_token: string }>(
        token,
        `/workspaces/${workspace.id}/select`,
        { method: "POST" },
      );
      setOpen(false);
      onSelect(result.access_token, workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch workspace");
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const workspace = await retailRequest<Workspace>(token, "/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      const result = await retailRequest<{ access_token: string }>(
        token,
        `/workspaces/${workspace.id}/select`,
        { method: "POST" },
      );
      setOpen(false);
      onSelect(result.access_token, workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create workspace");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-picker" ref={root}>
      <button
        ref={trigger}
        className="workspace-picker-trigger"
        aria-label={`Switch workspace: ${current.name}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(!open);
          setError("");
        }}
      >
        <span className="workspace-picker-icon">
          <Store size={16} />
        </span>
        <span>{current.name}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <section
          className="workspace-picker-menu"
          role="dialog"
          aria-label="Switch workspace"
        >
          <p>Your workspaces</p>
          <div className="workspace-picker-list">
            {!workspaces.length && !error && (
              <span className="workspace-picker-loading">
                Loading workspaces…
              </span>
            )}
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                disabled={busy}
                aria-current={current.id === workspace.id ? "true" : undefined}
                onClick={() => void select(workspace)}
              >
                <Store size={15} />
                <span>
                  {workspace.name}
                  <small>{workspace.role.toLowerCase()}</small>
                </span>
                {workspace.id === current.id && <Check size={14} />}
              </button>
            ))}
          </div>
          {creating ? (
            <form onSubmit={create}>
              <label htmlFor="quick-workspace-name">New workspace</label>
              <input
                id="quick-workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Workspace name"
                minLength={2}
                maxLength={80}
                required
                autoFocus
              />
              <div>
                <button type="button" onClick={() => setCreating(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={busy || name.trim().length < 2}>
                  {busy ? <LoaderCircle size={13} /> : <Plus size={13} />}Create
                </button>
              </div>
            </form>
          ) : (
            <button
              className="workspace-picker-create"
              disabled={busy}
              onClick={() => setCreating(true)}
            >
              <Plus size={15} />
              New workspace
            </button>
          )}
          {error && (
            <p className="workspace-picker-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
