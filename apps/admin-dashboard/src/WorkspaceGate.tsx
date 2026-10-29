import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Building2, Plus, X } from "lucide-react";
import Brand from "./Brand";

type Workspace = { id: string; name: string; slug: string; role: string };

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function WorkspaceGate({
  token,
  userName,
  onSelect,
  onSignOut,
}: {
  token: string;
  userName: string;
  onSelect: (token: string, workspace: Workspace) => void;
  onSignOut: () => void;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/workspaces`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your workspaces");
        return response.json() as Promise<Workspace[]>;
      })
      .then((items) => {
        if (active) {
          setWorkspaces(items);
          setCreating(items.length === 0);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function openWorkspace(workspace: Workspace) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/workspaces/${workspace.id}/select`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.detail ?? "Could not open workspace");
      onSelect(result.access_token, workspace);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not open workspace",
      );
      setBusy(false);
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/workspaces`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Could not create workspace",
        );
      setWorkspaces((items) => [...items, result]);
      await openWorkspace(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create workspace",
      );
      setBusy(false);
    }
  }

  return (
    <main className="workspace-gate">
      <header inert={creating}>
        <Brand />
        <button className="text-button" onClick={onSignOut}>
          Sign out
        </button>
      </header>
      <section className="workspace-list" inert={creating}>
        <p className="eyebrow">Your workspaces</p>
        <h1>Where are we working, {userName.split(" ")[0]}?</h1>
        <p>Choose a workspace to see its datasets and processing activity.</p>
        {loading && (
          <div className="workspace-loading" role="status">
            Loading workspaces…
          </div>
        )}
        {!loading && workspaces.length > 0 && (
          <div className="workspace-cards">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => openWorkspace(workspace)}
                disabled={busy}
              >
                <span className="workspace-icon">
                  <Building2 size={21} />
                </span>
                <span>
                  <strong>{workspace.name}</strong>
                  <small>
                    {workspace.role.toLowerCase()} · {workspace.slug}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        )}
        {!loading && workspaces.length > 0 && (
          <button
            className="workspace-add"
            onClick={() => {
              setError("");
              setCreating(true);
            }}
          >
            <Plus size={16} /> Create another workspace
          </button>
        )}
        {error && !creating && (
          <p className="csv-error" role="alert">
            {error}
          </p>
        )}
      </section>
      {creating && (
        <div className="workspace-modal-backdrop">
          <section
            className="workspace-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-modal-title"
          >
            {workspaces.length > 0 && (
              <button
                className="workspace-close"
                onClick={() => setCreating(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            )}
            <span className="workspace-icon">
              <Building2 size={22} />
            </span>
            <p className="eyebrow">Workspace setup</p>
            <h2 id="workspace-modal-title">Name your workspace.</h2>
            <p>
              A workspace keeps its datasets, team access, and reports together.
              You can create more later.
            </p>
            <form onSubmit={createWorkspace}>
              <label htmlFor="workspace-name">Workspace name</label>
              <input
                id="workspace-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                placeholder="e.g. North Region Retail"
                required
              />
              {error && (
                <p className="csv-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary-button"
                disabled={busy || name.trim().length < 2}
              >
                {busy ? "Creating…" : "Create workspace"}
                <ArrowRight size={16} />
              </button>
            </form>
            {workspaces.length === 0 && (
              <button className="workspace-modal-signout" onClick={onSignOut}>
                Sign out
              </button>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
