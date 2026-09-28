import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  SquaresFour,
  Briefcase,
  CalendarBlank,
  ClipboardText,
  CheckCircle,
  ChartBar,
  Users,
  ArrowRight,
  SignOut,
  MagnifyingGlass,
  Plus,
  ArrowSquareOut,
  WarningCircle,
} from "@phosphor-icons/react";
import { aggregate } from "./domain";
import { BulkSheet } from "./BulkSheet";
import {WeeklyPlanner} from './WeeklyPlanner';
import {TeamsPanel} from './TeamsPanel';
import { CRMPanel } from "./CRMPanel";
import {ResearchPanel,PublicBrief} from "./ResearchPanel";
import { Setup } from './Setup';
import "./style.css";
type Row = Record<string, any>;
let workspace = sessionStorage.getItem("workspace") || "xqtiv";
async function api(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Workspace": workspace },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await r.json()) as any;
  if (!r.ok) throw new Error(data.error || "Request failed.");
  return data;
}
const fmt = (n: number) => new Intl.NumberFormat().format(n);
const today = () => new Date().toLocaleDateString("en-CA");
const dateLabel = (v: string) =>
  v
    ? new Date(v + "T12:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not recorded";
function App() {
  const [data, setData] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState("Overview"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [modal, setModal] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [repoTab,setRepoTab]=useState("Company universe");
  const [sheetDirty, setSheetDirty] = useState(false);
  const invite = location.pathname.startsWith('/join/') ? location.pathname.split('/')[2] : new URLSearchParams(location.hash.slice(1)).get("invite");
  const [invitation,setInvitation] = useState<Row|null>(null);
  const joining = !!invite && invitation?.status === 'active';
  const [showPassword,setShowPassword] = useState(false);
  async function load() {
    try {
      setData(await api("state"));
      setError("");
    } catch (e: any) {
      if (!data) setData(null);
      else setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (invite) {
      api('invitation',{token:invite}).then(info=>{
        setInvitation(info);
        if(info.status==='expired'||info.status==='invalid')setError('This invitation is no longer valid. Ask your administrator for a new invitation.');
      }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
    } else load();
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const b = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (!data) {
        const result = await api(joining ? "accept" : "login", {
          ...b,
          email: invitation?.email || b.email,
          token: invite,
        });
        workspace = result.memberships[0]?.tenant || "xqtiv";
        sessionStorage.setItem("workspace", workspace);
        history.replaceState({}, "", "/");
        await load();
      } else {
        const body = { ...modal, ...b };
        if (modal?.kind === "invite") {
          const result = await api("invite", body);
          setModal({ kind: "invitation", url: result.url, emailStatus: result.emailStatus });
          return;
        }
        await api("mutate", body);
        setModal(null);
        setNotice("Saved to your workspace.");
        await load();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="loading">
        <div className="skeleton w-64 h-8" />
        <div className="skeleton w-96 h-28" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!data)
    return (
      <main className="login">
        <section className="login-story">
          <div className="brand">
            <img src="/brand/xqtiv-logo.svg" alt="XQtiv"/><span>Search Operations</span>
          </div>
          <p className="eyebrow">THE SEARCH OPERATING WORKSPACE</p>
          <h1>
            Good searches
            <br />
            start with clarity.
          </h1>
          <p>
            One place for the week's priorities, the team's daily work, and the
            reviews that move a search forward.
          </p>
          <div className="login-flow">
            <span>Plan the work</span>
            <ArrowRight />
            <span>Find the people</span>
            <ArrowRight />
            <span>Review together</span>
          </div>
        </section>
        <section className="login-form">
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h2>{joining ? `Welcome, ${invitation?.name?.split(" ")[0] || "there"}` : "Welcome back"}</h2>
          <p>
            {joining
              ? invitation?.hasAccount ? "Enter your existing password to join this workspace." : "Choose a password. That’s all you need to get started."
              : invitation?.status==='used' ? "Your invitation was already accepted. Sign in with the password you chose." : "Sign in with your invited account."}
          </p>
          <form onSubmit={save}>
            <Field name="email" label="Work email" type="email" initial={invitation?.email || ""} readOnly={!!invitation?.email} required />
            <Field
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              minLength={joining ? 12 : undefined}
              required
              autoComplete={joining && !invitation?.hasAccount ? "new-password" : "current-password"}
            />
            <button type="button" onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide password':'Show password'}</button>
            {joining&&!invitation?.hasAccount&&<p className="fine">Use at least 12 characters. A memorable phrase works well.</p>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="primary">
              {busy
                ? "Opening workspace…"
                : joining
                  ? "Open my workspace"
                  : "Sign in"}
              <ArrowRight />
            </button>
          </form>
          <p className="fine">
            Access is invitation-only. Contact your workspace administrator for
            an invitation or help with access.
          </p>
        </section>
      </main>
    );
  const actor = data.actor,
    isAdmin = actor.role === "admin",
    planner = isAdmin || actor.role === "planner";
  const sBy = Object.fromEntries(data.searches.map((s: Row) => [s.id, s])),
    tBy = Object.fromEntries(data.teams.map((t: Row) => [t.id, t])),
    pBy = Object.fromEntries(data.staff.map((s: Row) => [s.id, s]));
  const filtered = data.entries.filter(
    (e: Row) =>
      (!from || e.work_date >= from) &&
      (!to || e.work_date <= to) &&
      (!selected || e.search_id === selected),
  );
  const totals = aggregate(filtered),
    flagged = filtered.filter((e: Row) => e.flag).length;
  const assignments = data.assignments.filter(
    (a: Row) =>
      (!from || a.work_date >= from) &&
      (!to || a.work_date <= to) &&
      (!selected || a.search_id === selected),
  );
  const list = data.searches.filter((s: Row) =>
    (s.title + " " + s.client + " " + s.external_id)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const queue = filtered.filter(
    (e: Row) => e.source!=='candidates' && !e.automated && e.mapped !== null && (e.peer === null || e.partner === null),
  );
  const nav: [string, React.ElementType][] = [
    ["Overview", SquaresFour],
    ["Searches", Briefcase],
    ["Role repository",Briefcase],
    ["My Work",ClipboardText],
    ["Workflow Monitor",ChartBar],
    ["Weekly plan", CalendarBlank],
    ["Daily work", ClipboardText],
    ["Spreadsheet", ClipboardText],
    ["Reviews", CheckCircle],
    ["Performance", ChartBar],
    ...(isAdmin ? [["Integrations", Briefcase] as [string, React.ElementType]] : []),
    ...(isAdmin ? [["Workspace", Users] as [string, React.ElementType]] : []),
  ];
  const open = (m: Row) => {
    setError("");
    setModal(m);
  };
  const entriesFor = (id: string) =>
    data.entries.filter((e: Row) => e.assignment_id === id);
  function cards(entries: Row[]) {
    const m = aggregate(entries as any);
    return (
      <div className="metrics">
        <Metric label="Profiles mapped" value={fmt(m.mapped)} />
        <Metric label="Peer approved" value={fmt(m.peer)} />
        <Metric label="Partner approved" value={fmt(m.partner)} />
        <Metric
          label="Partner / mapped"
          value={
            m.approvalRate === null
              ? "—"
              : (m.approvalRate * 100).toFixed(1) + "%"
          }
        />
      </div>
    );
  }
  function entryRows(entries: Row[]) {
    return entries.map((e: Row) => (
      <div className="entry" key={e.id}>
        <div>
          <strong>{pBy[e.staff_id]?.name || "Unassigned"}</strong>
          {e.flag && (
            <span className="flag">
              <WarningCircle />
              Needs reconciliation
            </span>
          )}
          {e.notes && <p>{e.notes}</p>}
        </div>
        <div>
          <small>Mapped</small>
          <strong>{e.mapped ?? "—"}</strong>
        </div>
        <div>
          <small>Peer</small>
          <strong>{e.peer ?? "Pending"}</strong>
        </div>
        <div>
          <small>Partner</small>
          <strong>{e.partner ?? "Pending"}</strong>
        </div>
        <div className="row-actions">
          {e.source==='candidates'&&<button onClick={()=>{setSelected(e.search_id);setRepoTab("Candidate mappings");setPage("Role repository");}}>View mappings</button>}
          {!e.automated&&e.source!=='candidates'&&(isAdmin || actor.staffId === e.staff_id) &&
            !e.peer_at &&
            !e.partner_at && (
              <button onClick={() => open({ kind: "entry", ...e })}>
                Log output
              </button>
            )}
          {!e.automated&&e.source!=='candidates'&&(isAdmin ||
            (actor.role === "researcher" &&
              actor.staffId &&
              actor.staffId !== e.staff_id)) &&
            e.mapped !== null &&
            !e.partner_at && (
              <button
                onClick={() => open({ kind: "review", ...e, stage: "peer" })}
              >
                Peer review
              </button>
            )}
          {!e.automated&&e.source!=='candidates'&&(isAdmin || actor.role === "partner") && e.peer !== null && (
            <button
              onClick={() => open({ kind: "review", ...e, stage: "partner" })}
            >
              Partner review
            </button>
          )}
          {!e.automated&&e.source!=='candidates'&&isAdmin && (e.peer_at || e.partner_at) && (
            <button onClick={() => open({ kind: "reopen", ...e })}>
              Reopen
            </button>
          )}
        </div>
      </div>
    ));
  }
  return (
    <div className="app">
      <aside>
        <div className="brand">
          <img src="/brand/xqtiv-logo.svg" alt="XQtiv"/><span>Search Operations</span>
        </div>
        <div className="workspace-label">
          <span className="workspace-initial">{data.name[0]}</span>
          <div>
            <strong>{data.name}</strong>
            <small>Private workspace</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "active" : ""}
              onClick={() => {
                if (sheetDirty && !confirm("Discard unsaved changes?")) return;
                setSheetDirty(false);
                setPage(label);
                setNotice("");
              }}
            >
              <Icon size={21} />
              {label}
              {label === "Reviews" && queue.length > 0 && (
                <span className="nav-count">{queue.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="identity">
          <strong>{actor.name}</strong>
          <small>{actor.role}</small>
          <button
            onClick={async () => {
              if (sheetDirty && !confirm("Discard unsaved changes and sign out?")) return;
              setSheetDirty(false);
              await api("logout", {});
              setData(null);
            }}
          >
            <SignOut />
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <header>
          <div>
            <p className="eyebrow">{data.name} / OPERATIONS</p>
            <h1>{page === "Overview" ? "A clear view of the work." : page}</h1>
            <p className="subheading">
              {
                {
                  Overview: "Keep priorities, output, and reviews connected.",
                  Searches:
                    "The complete search portfolio, with the details one click away.",
                  "Weekly plan":
                    "Set priorities and allocate teams across all seven days.",
                  "Daily work":
                    "Team assignments and individual contributions, together.",
                  Spreadsheet: "Update many records on one screen, then save them together.",
                  Reviews: "Peer review first. Partner review next.",
                  Performance: "Trace every result to the work behind it.",
                  Workspace: "People, access, and source data.",
                }[page]
              }
            </p>
          </div>
          {planner && ["Overview","Searches","Daily work"].includes(page) && (
            <button
              className="primary"
              onClick={() =>
                page === "Searches" ? open({kind:"search"}) : setPage("Weekly plan")
              }
            >
              <Plus />
              {page === "Searches" ? "New search" : "Plan week"}
            </button>
          )}
        </header>
        {notice && (
          <div className="notice" role="status">
            {notice}
          </div>
        )}
        {error && !modal && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {!["Role repository","My Work","Workflow Monitor"].includes(page) && page !== "Workspace" && page !== "Integrations" && page !== "Weekly plan" && (
          <div className="filters">
            <label>
              From
              <input
                type="date"
                value={from}
                disabled={sheetDirty}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                value={to}
                disabled={sheetDirty}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label className="search-filter">
              Search
              <select
                value={selected}
                disabled={sheetDirty}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">All searches</option>
                {data.searches.map((s: Row) => (
                  <option key={s.id} value={s.id}>
                    {s.client} · {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                if (sheetDirty) return;
                setFrom("");
                setTo("");
                setSelected("");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        {flagged > 0 && page !== "Workspace" && (
          <div className="source-note">
            <WarningCircle size={20} />
            <p>
              {flagged} entries in this view have inconsistent historical review
              counts. Totals use recorded individual values; affected results
              need reconciliation.
            </p>
          </div>
        )}
        {page === "Integrations" && <CRMPanel partners={data.partners || []} searches={data.searches} api={api} reload={load} />}
        {page === "Overview" && (
          <>
            {cards(filtered)}
            <div className="overview-grid">
              <section className="panel">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">NEXT ACTIONS</p>
                    <h2>Reviews waiting on a decision</h2>
                  </div>
                  <button onClick={() => setPage("Reviews")}>
                    View all <ArrowRight />
                  </button>
                </div>
                {queue.slice(0, 6).map((e: Row) => (
                  <button
                    className="work-row"
                    key={e.id}
                    onClick={() => {
                      setSelected(e.search_id);
                      setPage("Reviews");
                    }}
                  >
                    <span className="monogram">
                      {pBy[e.staff_id]?.name.slice(0, 1)}
                    </span>
                    <span>
                      <strong>
                        {pBy[e.staff_id]?.name} · {sBy[e.search_id]?.client}
                      </strong>
                      <small>{sBy[e.search_id]?.title}</small>
                    </span>
                    <span className="badge">
                      {e.peer === null ? "Peer review" : "Partner review"}
                    </span>
                  </button>
                ))}
                {!queue.length && (
                  <Empty
                    title="The review queue is clear"
                    body="New sourcing output appears here when it is ready for a decision."
                  />
                )}
              </section>
              <section className="panel dark">
                <p className="eyebrow">PORTFOLIO</p>
                <h2>
                  {data.searches.filter((s: Row) => s.status === "Open").length}{" "}
                  open searches
                </h2>
                <p>
                  Across {new Set(data.searches.map((s: Row) => s.client)).size}{" "}
                  clients and {data.teams.length} teams.
                </p>
                <div className="portfolio-number">
                  {fmt(totals.estimatedHours)}
                  <small>estimated effort hours</small>
                </div>
                <p className="fine">
                  {totals.personDays} unique researcher-days × 8 hours. Not
                  measured timesheets.
                </p>
                <button onClick={() => setPage("Performance")}>
                  Explore performance <ArrowRight />
                </button>
              </section>
            </div>
            <section className="panel">
              <div className="section-head">
                <h2>Recent work</h2>
                <button onClick={() => setPage("Daily work")}>
                  Open daily work <ArrowRight />
                </button>
              </div>
              {assignments.slice(0, 5).map((a: Row) => (
                <div className="work-row" key={a.id}>
                  <span className="date-tile">{dateLabel(a.work_date)}</span>
                  <span>
                    <strong>{sBy[a.search_id]?.client}</strong>
                    <small>{sBy[a.search_id]?.title}</small>
                  </span>
                  <span className="badge">{tBy[a.team_id]?.name}</span>
                  <strong>
                    {aggregate(entriesFor(a.id) as any).mapped} mapped
                  </strong>
                </div>
              ))}
            </section>
          </>
        )}
        {page === "Searches" && (
          <>
            <div className="searchbox">
              <MagnifyingGlass size={22} />
              <input
                aria-label="Find a search"
                placeholder="Search by client, role, or CRM ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="search-list">
              {list
                .filter((s: Row) => !selected || s.id === selected)
                .map((s: Row) => {
                  const es = filtered.filter((e: Row) => e.search_id === s.id),
                    m = aggregate(es as any);
                  return (
                    <details className="search-card" key={s.id}>
                      <summary>
                        <span>
                          <small>
                            {s.client}{" "}
                            {s.external_id && " / CRM " + s.external_id}{s.partner && ` · Partner: ${s.partner}`}
                          </small>
                          <strong>{s.title}</strong>
                        </span>
                        <span className="badge">{s.status}</span>
                        <span className="search-stat">
                          <strong>{m.mapped}</strong>
                          <small>mapped</small>
                        </span>
                        <span className="search-stat">
                          <strong>{m.partner}</strong>
                          <small>approved</small>
                        </span>
                      </summary>
                      <div className="search-detail">
                        <p>
                          Created {dateLabel(s.start_date)}
                          {s.partner && ` · Partner ${s.partner}`}
                        </p>
                        {s.notes && <p>{s.notes}</p>}
                        <button className="primary" onClick={()=>{setSelected(s.id);setRepoTab("Company universe");setPage("Role repository");}}>Open role repository</button>
                        <div className="row-actions">

                          <button
                            onClick={() => {
                              setSelected(s.id);
                              setPage("Daily work");
                            }}
                          >
                            View sourcing work
                          </button>
                          <button
                            onClick={() => {
                              setSelected(s.id);
                              setPage("Performance");
                            }}
                          >
                            View performance
                          </button>
                          {planner && (
                            <button
                              onClick={() =>
                                (setSelected(s.id), setPage("Weekly plan"))
                              }
                            >
                              Plan this search
                            </button>
                          )}
                        </div>
                        {planner&&<button onClick={()=>open({kind:'search-owner',...s})}>{s.partner?'Edit engagement partner':'Set engagement partner'}</button>}
                        {data.assignments.some((a:Row)=>a.search_id===s.id&&a.link)&&<details><summary>Reference links</summary><p className="fine">Legacy links to external candidate lists; not required for planning.</p>{Array.from(new Set<string>(data.assignments.filter((a:Row)=>a.search_id===s.id&&a.link).map((a:Row)=>a.link))).map(link=><a className="external-link" key={link} href={link} target="_blank" rel="noreferrer">Open candidate reference <ArrowSquareOut/></a>)}</details>}
                      </div>
                    </details>
                  );
                })}
            </div>
          </>
        )}
        {page === "Weekly plan" && <WeeklyPlanner data={data} api={api} reload={load} initialSearch={selected} onDirty={setSheetDirty} onTeams={()=>setPage('Workspace')}/>}
        {["Role repository","My Work","Workflow Monitor"].includes(page)&&<ResearchPanel key={page} data={data} api={api} reload={load} view={page} initialRole={page==='Role repository'?selected:''} initialTab={repoTab} onDirty={setSheetDirty}/>}
        {page === "Spreadsheet" && <BulkSheet onOpen={id=>{setSelected(id);setRepoTab("Candidate mappings");setPage("Role repository");}} data={data} entries={filtered} assignments={assignments} api={api} reload={load} onDirty={setSheetDirty} />}
        {page === "Daily work" && (
          <div className="assignment-list">
            {assignments.map((a: Row) => (
              <section className="panel" key={a.id}>
                <div className="section-head">
                  <div>
                    <p className="eyebrow">
                      {dateLabel(a.work_date)} / {tBy[a.team_id]?.name}
                    </p>
                    <h2>{sBy[a.search_id]?.client}</h2>
                    <p>{sBy[a.search_id]?.title}</p>
                  </div>
                  <span className="target">
                    {a.target ?? "—"}
                    <small>approval target</small>
                  </span>
                </div>
                <div className="assignment-meta">
                  {sBy[a.search_id]?.partner && <span>Partner: {sBy[a.search_id].partner}</span>}
                  {a.link && (
                    <a href={a.link} target="_blank" rel="noreferrer">
                      Candidate reference <ArrowSquareOut />
                    </a>
                  )}
                  {a.source_row && <span>Workbook row {a.source_row}</span>}
                </div>
                {entryRows(entriesFor(a.id))}
                {a.notes && <p>{a.notes}</p>}
                {!entriesFor(a.id).length && (
                  <Empty
                    title="No researchers assigned"
                    body="This imported session has no individual contributions recorded."
                  />
                )}
              </section>
            ))}
            {!assignments.length && (
              <Empty
                title="No work in this view"
                body="Clear the date filters or plan a new assignment."
              />
            )}
          </div>
        )}
        {page === "Reviews" && (
          <section className="panel">
            <h2>Historical count reviews</h2><p>For individual candidate reviews, open <button onClick={()=>setPage("My Work")}>My Work</button> or <button onClick={()=>setPage("Workflow Monitor")}>Workflow Monitor</button>.</p>
            <p className="fine">
              Zero approvals is a completed review. Missing counts remain
              pending.
            </p>
            {queue.map((e: Row) => (
              <div key={e.id} className="review-block">
                <p className="eyebrow">
                  {dateLabel(e.work_date)} / {sBy[e.search_id]?.client}
                </p>
                <h3>{sBy[e.search_id]?.title}</h3>
                {entryRows([e])}
              </div>
            ))}
            {!queue.length && (
              <Empty
                title="No pending reviews"
                body="All recorded sourcing output in this view has both review counts."
              />
            )}
          </section>
        )}
        {page === "Performance" && (
          <>
            {cards(filtered)}
            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>Researcher contributions</h2>
                  <p>Individual source counts for the selected period.</p>
                </div>
                {["admin", "founder"].includes(actor.role) && (
                  <button
                    onClick={() => {
                      const header = [
                        "Researcher",
                        "Date",
                        "Client",
                        "Search",
                        "Mapped",
                        "Peer approved",
                        "Partner approved",
                        "Flag",
                      ];
                      const rows = filtered.map((e: Row) => [
                        pBy[e.staff_id]?.name,
                        e.work_date,
                        sBy[e.search_id]?.client,
                        sBy[e.search_id]?.title,
                        e.mapped,
                        e.peer,
                        e.partner,
                        e.flag,
                      ]);
                      const csv = [header, ...rows]
                        .map((row) =>
                          row
                            .map(
                              (v: any) =>
                                '"' +
                                String(v ?? "")
                                  .replace(/^[=+@-]/, "'$&")
                                  .replaceAll('"', '""') +
                                '"',
                            )
                            .join(","),
                        )
                        .join("\r\n");
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(
                        new Blob([csv], { type: "text/csv" }),
                      );
                      a.download = "sourcing-output.csv";
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    Export CSV
                  </button>
                )}
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Researcher</th>
                      <th>Mapped</th>
                      <th>Peer</th>
                      <th>Partner</th>
                      <th>Approval rate</th>
                      <th>Person-days</th>
                      <th>Estimated hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.staff.map((p: Row) => {
                      const entries = filtered.filter(
                        (e: Row) => e.staff_id === p.id,
                      );
                      if (!entries.length) return null;
                      const m = aggregate(entries as any);
                      return (
                        <tr key={p.id}>
                          <th>{p.name}</th>
                          <td>{m.mapped}</td>
                          <td>{m.peer}</td>
                          <td>{m.partner}</td>
                          <td>
                            {m.approvalRate === null
                              ? "—"
                              : (m.approvalRate * 100).toFixed(1) + "%"}
                          </td>
                          <td>{m.personDays}</td>
                          <td>{m.estimatedHours}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="fine">
                Person-days count each researcher and work date once, including
                recorded zero output. Estimated hours = person-days × 8.
                Approval rate = total partner-approved ÷ total mapped. Missing
                counts are not zeros; totals sum only recorded values.
              </p>
            </section>
          </>
        )}
        {page === "Workspace" && (
          <>
            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>People and access</h2>
                  <p>Historical staff are separate from invited accounts.</p>
                </div>
                <button
                  className="primary"
                  onClick={() => open({ kind: "invite" })}
                >
                  <Plus />
                  Invite colleague
                </button>
              </div>
              <div className="row-actions">

                <button onClick={() => open({ kind: "staff" })}>
                  Add researcher
                </button>

                <button
                  onClick={async () =>
                    open({ kind: "members", members: await api("members") })
                  }
                >
                  Manage accounts
                </button>
              </div>
              <div className="people-grid">
                {data.staff.map((p: Row) => (
                  <span key={p.id}>{p.name}</span>
                ))}
              </div>
              <p className="fine">
                Everyone can view this workspace's searches. Editing, planning,
                and review permissions depend on their assigned access role.
              </p>
            </section>
            <TeamsPanel data={data} api={api} reload={load} onAdd={()=>open({kind:'team'})}/>
            <section className="panel">
              <h2>Import reconciliation</h2>
              <p>
                Arithmetic totals are rebuilt from individual entries. Source
                values remain preserved.
              </p>
              <details>
                <summary>{data.issues.length} source issues recorded</summary>
                {data.issues.map((i: Row) => (
                  <div className="issue" key={i.id}>
                    <strong>
                      {i.kind.replaceAll("_", " ")} · row {i.source_row}
                    </strong>
                    <pre>{JSON.stringify(JSON.parse(i.details), null, 2)}</pre>
                  </div>
                ))}
              </details>
            </section>
          </>
        )}
        <footer>
          Private workspace · Eight-hour person-day convention ·{" "}
          <button onClick={() => load()}>Refresh data</button>
        </footer>
      </main>
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setModal(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="modal"
          >
            <div className="section-head">
              <h2 id="modal-title">
                {
                  (
                    {
                      search: "Create a search",
                      "search-owner": "Search engagement partner",
                      entry: "Log sourcing output",
                      review:
                        modal.stage === "peer"
                          ? "Peer review"
                          : "Partner review",
                      reopen: "Reopen reviewed output",
                      invite: "Invite a colleague",
                      invitation: "Invitation ready",
                      staff: "Add a researcher",
                      team: "Add a team",
                      members: "Workspace accounts",
                    } as Record<string, string>
                  )[modal.kind]
                }
              </h2>
              <button
                aria-label="Close dialog"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Close
              </button>
            </div>
            {modal.kind === "invitation" ? (
              <>
                <p role="status">
                  {modal.emailStatus === 'accepted'
                    ? 'Invitation submitted for email delivery. You can also share the link below.'
                    : modal.emailStatus === 'unconfirmed'
                      ? 'Email delivery could not be confirmed. Your invitation is ready; copy the link below and share it privately.'
                      : 'Email invitations are not connected yet. Copy the link below and share it privately.'}
                </p>
                <p>
                  Share this single-use link privately with the intended
                  colleague. It expires in seven days.
                </p>
                <textarea readOnly value={modal.url} />
                <button
                  className="primary"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(modal.url)
                      .then(() => setNotice("Invitation copied."))
                  }
                >
                  Copy invitation
                </button>
              </>
            ) : modal.kind === "members" ? (
              <>
                {modal.members.map((m: Row) => (
                  <div className="work-row" key={m.id}>
                    <span>
                      <strong>{m.name}</strong>
                      <small>
                        {m.email} · {m.role} · {m.status}
                      </small>
                    </span>
                    {m.id !== actor.id && m.status === "active" && (
                      <button
                        onClick={async () => {
                          await api("revoke", { id: m.id });
                          setModal({ ...modal, members: await api("members") });
                        }}
                      >
                        Revoke access
                      </button>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <form onSubmit={save}>
                {modal.kind === "search" && (
                  <>
                    <Field name="client" label="Client company" required />
                    <Field name="title" label="Role / search title" required />
                    <Field
                      name="external_id"
                      label="Recruit CRM job ID (optional)"
                    />
                    <Field name="start_date" label="Start date" type="date" />
                    <Select name="partner_id" label="Engagement partner" values={[["","Not assigned"],...(data.partners || []).map((p:Row)=>[p.id,p.name])]}/>
                  </>
                )}
                {modal.kind === 'search-owner' && <><p>{modal.client} · {modal.title}</p>{modal.partner&&!modal.partner_id&&<p className="fine">Previously recorded: {modal.partner}. Select the partner’s account below.</p>}<Select name="partner_id" label="Engagement partner" initial={modal.partner_id || ''} values={[["","Not assigned"],...(data.partners || []).map((p:Row)=>[p.id,p.name])]}/><p className="fine">Set once for this search. Available partners are active Admin, Founder and Partner accounts. Invite any missing partner from Workspace.</p></>}
                {modal.kind === "entry" && (
                  <Field
                    name="mapped"
                    label="Profiles mapped"
                    type="number"
                    min={0}
                    initial={modal.mapped ?? ""}
                    required
                  />
                )}
                {modal.kind === "review" && (
                  <>
                    <p>
                      {modal.mapped ?? 0} mapped · {modal.peer ?? "Pending"}{" "}
                      peer-approved
                    </p>
                    <Field
                      name="approved"
                      label={
                        modal.stage === "peer"
                          ? "Profiles passing peer review"
                          : "Profiles approved by partner"
                      }
                      type="number"
                      min={0}
                      initial={modal[modal.stage] ?? ""}
                      required
                    />
                  </>
                )}
                {modal.kind === "invite" && (
                  <>
                    <Field name="name" label="Full name" required />
                    <Field
                      name="email"
                      label="Work email"
                      type="email"
                      required
                    />
                    <Select
                      name="role"
                      label="Access role"
                      values={[
                        "researcher",
                        "partner",
                        "planner",
                        "founder",
                        "admin",
                      ].map((s) => [s, s])}
                    />
                    <Select
                      name="staffId"
                      label="Link historical researcher (optional)"
                      values={[
                        ["", "No staff link"],
                        ...data.staff.map((s: Row) => [s.id, s.name]),
                      ]}
                    />
                    <p className="fine">
                      Link researchers to their staff record so they can log
                      their own output. Administrator access includes all
                      workspace data and member management.
                    </p>
                  </>
                )}
                {["staff", "team"].includes(modal.kind) && (
                  <Field name="name" label="Name" required />
                )}
                {!["invite", "staff", "team", "search-owner"].includes(modal.kind) && (
                  <label>
                    Notes{" "}
                    {modal.kind === "reopen" ? "(required)" : "(optional)"}
                    <textarea
                      name="notes"
                      defaultValue={modal.notes ?? ""}
                      required={modal.kind === "reopen"}
                      rows={3}
                    />
                  </label>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button className="primary" disabled={busy}>
                  {busy
                    ? "Saving…"
                    : modal.kind === "invite"
                      ? "Create invitation"
                      : "Save"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Field({ label, name, type = "text", initial, ...props }: any) {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={initial} {...props} />
    </label>
  );
}
function Select({ label, name, values, initial }: any) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={initial}>
        {values.map(([v, l]: string[]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
function Metric({ label, value }: any) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({ title, body }: any) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(location.pathname === '/brief' ? <PublicBrief/> : location.pathname === '/setup' ? <Setup /> : <App />);
