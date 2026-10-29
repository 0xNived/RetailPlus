import { FormEvent, useEffect, useState } from "react";
import DatasetsPage from "./DatasetsPage";
import WorkspaceGate from "./WorkspaceGate";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Database,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  X,
} from "lucide-react";

type Screen = "landing" | "login" | "workspaces" | "dashboard";
type WorkspaceTab = "home" | "datasets" | "analytics" | "customers" | "predictions" | "assistant";
type Workspace = { id: string; name: string; slug: string; role: string };

type DashboardData = {
  stats: { datasets: number; imports: number; open_issues: number; source_files: number };
  recent_imports: { id: string; name: string; status: string; created_at: string }[];
  role: string;
};

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function Brand() {
  return <div className="brand"><span className="brand-mark">R</span><span>RetailPlus</span></div>;
}

function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [token, setToken] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [user, setUser] = useState({ name: "", email: "", role: "" });

  function openLogin() {
    setScreen("login");
  }

  function finishLogin(nextToken: string, nextUser: { name: string; email: string; role: string }) {
    setLoginToken(nextToken);
    setUser(nextUser);
    setScreen("workspaces");
  }

  function openWorkspace(nextToken: string, nextWorkspace: Workspace) {
    setToken(nextToken);
    setWorkspace(nextWorkspace);
    setUser(current => ({ ...current, role: nextWorkspace.role }));
    setScreen("dashboard");
  }

  function signOut() {
    setToken("");
    setLoginToken("");
    setWorkspace(null);
    setUser({ name: "", email: "", role: "" });
    setScreen("landing");
  }

  if (screen === "login") return <LoginPage onBack={() => setScreen("landing")} onSuccess={finishLogin} />;
  if (screen === "workspaces") return <WorkspaceGate token={loginToken} userName={user.name} onSelect={openWorkspace} onSignOut={signOut} />;
  if (screen === "dashboard" && workspace) return <Dashboard token={token} workspace={workspace} user={user} onSignOut={signOut} onSwitch={() => setScreen("workspaces")} />;
  return <LandingPage onLogin={openLogin} />;
}

function LandingPage({ onLogin }: { onLogin: () => void }) {
  return <main className="landing-shell">
    <nav className="landing-nav"><Brand /><div className="nav-links"><a href="#workflow">Workflow</a><a href="#sources">Sources</a><a href="#security">Security</a></div><button className="text-button" onClick={onLogin}>Log in</button></nav>
    <section className="landing-hero">
      <div className="eyebrow"><Sparkles size={15} /> Your data, ready for work</div>
      <h1>From source files<br />to clear decisions.</h1>
      <p>RetailPlus turns scattered business data into trusted datasets, dashboard insights, and model-ready workflows.</p>
      <div className="hero-actions"><button className="primary-button" onClick={onLogin}>Open workspace <ArrowRight size={17} /></button><a className="secondary-button" href="#workflow">See the workflow</a></div>
    </section>
    <section className="product-preview" aria-label="RetailPlus workspace preview">
      <aside><Brand /><button className="new-button"><FileUp size={16} /> New import</button><span className="active-link"><LayoutDashboard size={16} /> Home</span><span><FileUp size={16} /> Imports</span><span><Database size={16} /> Data</span><span><BarChart3 size={16} /> Analytics</span></aside>
      <div className="preview-content"><div className="preview-heading"><div><p>Workspace overview</p><h2>Everything is ready to review.</h2></div><button className="primary-button">New import <ArrowRight size={16} /></button></div><div className="preview-stats"><Metric label="Datasets" value="12" detail="3 updated today" /><Metric label="Data health" value="92%" detail="Up 4% this week" /><Metric label="Open issues" value="08" detail="2 need review" /></div><div className="preview-table"><div><strong>Recent imports</strong><span>View all</span></div><p><i className="status-dot ready" /> Customer master file <small>Ready</small></p><p><i className="status-dot review" /> Q3 supplier invoices <small>Needs review</small></p><p><i className="status-dot process" /> Store inventory <small>Profiling</small></p></div></div>
    </section>
    <section className="landing-grid" id="workflow"><div><span className="section-number">01</span><h2>Bring source data together.</h2><p>Start with CSV today. Excel, PDF, Word, PNG, and JPEG imports are planned.</p></div><div><span className="section-number">02</span><h2>Know what needs attention.</h2><p>Review field matches, missing values, and possible duplicates before exporting.</p></div><div><span className="section-number">03</span><h2>Move from data to action.</h2><p>Download an organized CSV and a change log. Saved datasets and analytics are next.</p></div></section>
    <footer id="security"><Brand /><span>Built for the work behind every decision.</span><button className="text-button" onClick={onLogin}>Enter RetailPlus</button></footer>
  </main>;
}

function LoginPage({ onBack, onSuccess }: { onBack: () => void; onSuccess: (token: string, user: { name: string; email: string; role: string }) => void }) {
  const [email, setEmail] = useState("admin@retailplus.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? "Unable to sign in");
      onSuccess(result.access_token, result.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return <main className="login-page"><button className="back-button" onClick={onBack}>← Back to RetailPlus</button><section className="login-card"><Brand /><div><p className="eyebrow">Workspace access</p><h1>Welcome back.</h1><p className="login-copy">Sign in to review your data operations workspace.</p></div><form onSubmit={submitLogin}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button full-button" disabled={loading}>{loading ? "Signing in…" : "Sign in"}<ArrowRight size={17} /></button></form><p className="login-note"><ShieldCheck size={15} /> Your workspace access is protected.</p></section></main>;
}

function Dashboard({ token, workspace, user, onSignOut, onSwitch }: { token: string; workspace: Workspace; user: { name: string; email: string; role: string }; onSignOut: () => void; onSwitch: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("home");

  function showTab(tab: WorkspaceTab) {
    setActiveTab(tab);
    setMenuOpen(false);
  }

  useEffect(() => {
    fetch(`${apiUrl}/dashboard`, { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json()).then(setData).catch(() => setData({ stats: { datasets: 0, imports: 0, open_issues: 0, source_files: 0 }, recent_imports: [], role: user.role }));
  }, [token, user.role, activeTab]);

  const stats = data?.stats ?? { datasets: 0, imports: 0, open_issues: 0, source_files: 0 };
  return <main className="app-shell">
    <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
      <div className="sidebar-top"><Brand /><button className="close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <button className="workspace-switch" onClick={onSwitch}>{workspace.name}<span>Switch workspace ↗</span></button>
      <nav className="workspace-navigation" aria-label="Workspace sections">
        <button className={activeTab === "home" ? "active-link" : ""} onClick={() => showTab("home")} aria-current={activeTab === "home" ? "page" : undefined}><LayoutDashboard size={17} /> Home</button>
        <div className="sidebar-nav-group"><p className="sidebar-section-title">Data</p><button className={activeTab === "datasets" ? "active-link" : ""} onClick={() => showTab("datasets")} aria-current={activeTab === "datasets" ? "page" : undefined}><Database size={17} /> Datasets</button></div>
        <div className="sidebar-nav-group"><p className="sidebar-section-title">Analyze</p><button className={activeTab === "analytics" ? "active-link" : ""} onClick={() => showTab("analytics")} aria-current={activeTab === "analytics" ? "page" : undefined}><BarChart3 size={17} /> Analytics</button><button className={activeTab === "customers" ? "active-link" : ""} onClick={() => showTab("customers")} aria-current={activeTab === "customers" ? "page" : undefined}><UsersRound size={17} /> Customers</button><button className={activeTab === "predictions" ? "active-link" : ""} onClick={() => showTab("predictions")} aria-current={activeTab === "predictions" ? "page" : undefined}><TrendingUp size={17} /> Predictions</button></div>
        <div className="sidebar-nav-group"><p className="sidebar-section-title">AI</p><button className={activeTab === "assistant" ? "active-link" : ""} onClick={() => showTab("assistant")} aria-current={activeTab === "assistant" ? "page" : undefined}><Bot size={17} /> Assistant</button></div>
      </nav>
      <div className="sidebar-bottom"><button className="profile" onClick={onSignOut}><b>{user.name.slice(0, 1).toUpperCase()}</b><span>{user.name}<small>{user.role.toLowerCase()}</small></span><LogOut size={16} /></button></div>
    </aside>
    <section className={activeTab === "datasets" ? "dashboard-main dashboard-main-datasets" : "dashboard-main"}>
      {activeTab === "datasets" ? <div className="datasets-mobile-top"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button><span>{workspace.name} / Datasets</span></div> : <header><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div><p className="crumb">{workspace.name} / {activeTab === "home" ? "Home" : activeTab[0].toUpperCase() + activeTab.slice(1)}</p><h1>{activeTab === "home" ? `Good morning, ${user.name.split(" ")[0] || "there"}.` : activeTab[0].toUpperCase() + activeTab.slice(1)}</h1></div></header>}
      <div className="dashboard-tab" hidden={activeTab !== "home"}><section className="overview"><div className="section-heading"><div><p className="eyebrow">Workspace overview</p><h2>Data operations at a glance.</h2></div><span className="live-pill"><i /> Live</span></div><div className="stats-grid"><Metric label="Datasets" value={String(stats.datasets).padStart(2, "0")} detail="Published data sources" /><Metric label="Source files" value={String(stats.source_files).padStart(2, "0")} detail="Across all imports" /><Metric label="Imports" value={String(stats.imports).padStart(2, "0")} detail="Tracked in this workspace" /><Metric label="Open issues" value={String(stats.open_issues).padStart(2, "0")} detail="Awaiting review" warning /></div></section>
      <section className="dashboard-grid"><article className="imports-card"><div className="card-title"><div><p className="eyebrow">Import activity</p><h2>Recent imports</h2></div></div>{data?.recent_imports.length ? data.recent_imports.map((item) => <div className="import-row" key={item.id}><span className="file-icon"><FileUp size={17} /></span><div><strong>{item.name}</strong><small>{new Date(item.created_at).toLocaleDateString()}</small></div><span className="status-label"><i className={`status-dot ${item.status.toLowerCase()}`} />{item.status.replaceAll("_", " ")}</span></div>) : <div className="empty-state"><CheckCircle2 size={22} /><strong>Your workspace is ready.</strong><span>Open Datasets to analyze a CSV, review its data quality, and export an organized copy.</span><button className="secondary-button" onClick={() => showTab("datasets")}>Go to Datasets</button></div>}</article></section></div>
      <div className="dashboard-tab" hidden={activeTab !== "datasets"}><DatasetsPage token={token} /></div>
      {activeTab !== "home" && activeTab !== "datasets" && <section className="planned-workspace-page"><p className="eyebrow">Coming next</p><h2>{activeTab[0].toUpperCase() + activeTab.slice(1)}</h2><p>{activeTab === "analytics" ? "Explore saved dataset trends and quality metrics here when analytics is connected." : activeTab === "customers" ? "Review customer profiles and segments here when customer analysis is ready." : activeTab === "predictions" ? "Run evaluated predictions here after model training and review are available." : "Ask questions about your workspace data here when the assistant is connected."}</p><button className="secondary-button" onClick={() => showTab("datasets")}>Open datasets <ArrowRight size={16} /></button></section>}
    </section>
  </main>;
}

function Metric({ label, value, detail, warning = false }: { label: string; value: string; detail: string; warning?: boolean }) {
  return <article className={warning ? "metric metric-warning" : "metric"}><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

export default App;
