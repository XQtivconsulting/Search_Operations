import React, { useEffect, useMemo, useState } from "react";
import { gridCount, parseClipboard } from "./grid";
type Row = Record<string, any>;
type Draft = { value: string; notes: string; version: number };
export function BulkSheet({data, entries, assignments, api, reload, onDirty}: {
  data: Row; entries: Row[]; assignments: Row[];
  api: (path: string, body?: unknown) => Promise<any>; reload: () => Promise<void>;
  onDirty: (dirty: boolean) => void;
}) {
  const [mode, setMode] = useState("output"), [team, setTeam] = useState(""), [person, setPerson] = useState("");
  const [draft, setDraft] = useState<Record<string, Draft>>({}), [undo, setUndo] = useState<Record<string, Draft>[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set()), [fill, setFill] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const a = data.actor, admin = a.role === "admin";
  const label = mode === "targets" ? "Approval target" : mode === "output" ? "Mapped" : "Approved";
  const searchBy = Object.fromEntries(data.searches.map((s: Row) => [s.id, s]));
  const teamBy = Object.fromEntries(data.teams.map((s: Row) => [s.id, s.name]));
  const staffBy = Object.fromEntries(data.staff.map((s: Row) => [s.id, s.name]));
  const rows = useMemo(() => (mode === "targets" ? assignments : entries).filter((e: Row) =>
    (!team || e.team_id === team) && (!person || mode === "targets" || e.staff_id === person)
  ).sort((x: Row, y: Row) => y.work_date.localeCompare(x.work_date) || x.id.localeCompare(y.id)), [entries, assignments, mode, team, person]);
  function editable(e: Row) {
    if (mode === "targets") return admin || a.role === "planner";
    if (mode === "output") return (admin || (a.role === "researcher" && a.staffId === e.staff_id)) && !e.peer_at && !e.partner_at;
    if (mode === "peer") return (admin || (a.role === "researcher" && a.staffId && a.staffId !== e.staff_id)) && e.mapped !== null && !e.partner_at;
    return (admin || a.role === "partner") && e.peer !== null;
  }
  function base(e: Row): Draft { return {value: String((mode === "targets" ? e.target : mode === "output" ? e.mapped : e[mode]) ?? ""), notes: mode === "output" || mode === "targets" ? e.notes || "" : "", version: e.version}; }
  const dirty = Object.keys(draft).length;
  useEffect(() => { onDirty(dirty > 0); }, [dirty]);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  function change(edits: {row: Row; col: number; value: string}[]) {
    const next = {...draft};
    for (const edit of edits) {
      if (!editable(edit.row)) throw new Error("The paste includes a locked row. No cells were changed.");
      const initial = base(edit.row), current = next[edit.row.id] || initial;
      const updated = {...current, [edit.col === 0 ? "value" : "notes"]: edit.value};
      if (updated.value === initial.value && updated.notes === initial.notes) delete next[edit.row.id];
      else next[edit.row.id] = updated;
    }
    setUndo(u => [...u.slice(-49), draft]); setDraft(next); setError(""); setNotice("");
  }
  function paste(e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) {
    e.preventDefault();
    try {
      const matrix = parseClipboard(e.clipboardData.getData("text/plain"));
      if (r + matrix.length > rows.length || matrix.some(row => row.length + c > 2)) throw new Error("The pasted range exceeds the editable cells. Paste only counts and notes.");
      if (matrix.length > 200) throw new Error("Paste up to 200 rows at a time.");
      change(matrix.flatMap((line, i) => line.map((value, j) => ({row: rows[r + i], col: c + j, value}))));
    } catch (err: any) { setError(err.message); }
  }
  function key(e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undoLast(); return; }
    if (!["Enter", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const direction = e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey) ? -1 : 1;
    for (let n = r + direction; n >= 0 && n < rows.length; n += direction) {
      const next = document.getElementById(`sheet-${n}-${c}`) as HTMLInputElement | null;
      if (next && !next.disabled) { next.focus(); next.select(); break; }
    }
  }
  function undoLast() { if (undo.length) { setDraft(undo[undo.length - 1]); setUndo(undo.slice(0, -1)); setError(""); } }
  async function save() {
    setError(""); setNotice("");
    try {
      if (dirty > 200) throw new Error("Save up to 200 changed rows at a time.");
      const changes = Object.entries(draft).map(([id, d]) => {
        const e = rows.find(r => r.id === id); if (!e) throw new Error("A changed row is outside this view. Restore the filters before saving.");
        const count = gridCount(d.value, mode === "peer" || mode === "partner");
        if (mode === "peer" && count! > e.mapped) throw new Error(`${staffBy[e.staff_id]}: approvals exceed mapped profiles.`);
        if (mode === "partner" && count! > e.peer) throw new Error(`${staffBy[e.staff_id]}: approvals exceed peer approvals.`);
        return {id, version: d.version, notes: d.notes, ...(mode === "targets" ? {kind: "assignment-edit", target: count} : mode === "output" ? {kind: "entry", mapped: count} : {kind: "review", stage: mode, approved: count})};
      });
      setBusy(true); await api("bulk", {changes});
      setDraft({}); setUndo([]); onDirty(false); setSelected(new Set());
      setNotice(`${changes.length} rows saved together.`); await reload();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="panel bulk-sheet">
    <div className="section-head"><div><h2>Spreadsheet workspace</h2><p className="fine">Paste counts and notes from Excel. Tab across; Enter moves down. Reviewed output stays locked.</p></div>
      <button className="primary" disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : `Save ${dirty || ""} changed rows`}</button></div>
    <div className="sheet-toolbar">
      <label>Work area<select aria-label="Work area" value={mode} disabled={!!dirty || busy} onChange={e => {setMode(e.target.value); setSelected(new Set()); setUndo([]); setError(""); setNotice("");}}>
        <option value="output">Sourcing output</option><option value="peer">Peer approvals</option><option value="partner">Partner approvals</option><option value="targets">Daily targets</option>
      </select></label>
      <label>Team<select value={team} disabled={!!dirty || busy} onChange={e => {setTeam(e.target.value); setSelected(new Set());}}><option value="">All teams</option>{data.teams.map((t: Row) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      {mode !== "targets" && <label>Researcher<select value={person} disabled={!!dirty || busy} onChange={e => {setPerson(e.target.value); setSelected(new Set());}}><option value="">All researchers</option>{data.staff.map((s: Row) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <button disabled={!undo.length || busy} onClick={undoLast}>Undo</button>
      <button disabled={!dirty || busy} onClick={() => {if (confirm("Discard all unsaved cell changes?")) {setDraft({}); setUndo([]); setError("");}}}>Discard changes</button>
    </div>
    <div className="sheet-toolbar"><label>Fill count<input value={fill} inputMode="numeric" onChange={e => setFill(e.target.value)} /></label>
      <button disabled={!selected.size || busy} onClick={() => {try {gridCount(fill, mode === "peer" || mode === "partner"); change(rows.filter(r => selected.has(r.id)).map(row => ({row, col: 0, value: fill})));} catch (e: any) {setError(e.message);}}}>Apply to {selected.size} selected</button>
      <span className="fine">{rows.length} rows · {dirty} changed · maximum 200 per save</span>
    </div>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    <div className="sheet-scroll" tabIndex={0} aria-label="Scrollable sourcing spreadsheet">
      <table className="sheet-table"><caption className="sr-only">{label} and notes by date, search and researcher</caption><thead><tr>
        <th><input type="checkbox" aria-label="Select editable rows (up to 200)" checked={selected.size > 0 && selected.size === Math.min(200, rows.filter(editable).length)} disabled={busy} onChange={e => setSelected(new Set(e.target.checked ? rows.filter(editable).slice(0,200).map(r => r.id) : []))}/></th>
        <th>Date / team</th><th>Client / search</th><th>{mode === "targets" ? "Partner" : "Researcher"}</th><th>Mapped / peer / partner</th><th>{label}</th><th>{mode === "peer" || mode === "partner" ? "Review comment" : "Notes"}</th>
      </tr></thead><tbody>{rows.map((row, i) => {
        const d = draft[row.id] || base(row), unlocked = editable(row);
        return <tr key={row.id} className={draft[row.id] ? "sheet-changed" : ""}>
          <td><input type="checkbox" aria-label={`Select row ${i + 1}`} disabled={!unlocked || busy} checked={selected.has(row.id)} onChange={e => {const n = new Set(selected); e.target.checked ? n.add(row.id) : n.delete(row.id); setSelected(n);}} /></td>
          <td>{row.work_date}<small>{teamBy[row.team_id]}</small></td><td><strong>{searchBy[row.search_id]?.client}</strong><small>{searchBy[row.search_id]?.title}</small></td>
          <td>{mode === "targets" ? row.partner || "—" : staffBy[row.staff_id]}{!unlocked && <small>Read only</small>}{row.flag && <small>Needs reconciliation</small>}</td>
          <td>{mode === "targets" ? "—" : `${row.mapped ?? "—"} / ${row.peer ?? "—"} / ${row.partner ?? "—"}`}</td>
          {[d.value, d.notes].map((value, col) => <td key={col}><input id={`sheet-${i}-${col}`} aria-label={`Row ${i + 1} ${col === 0 ? label : "notes"}`} inputMode={col === 0 ? "numeric" : "text"} disabled={!unlocked || busy} value={value} onChange={e => change([{row, col, value: e.target.value}])} onPaste={e => paste(e, i, col)} onKeyDown={e => key(e, i, col)}/></td>)}</tr>;
      })}</tbody></table>
      {!rows.length && <p className="sheet-empty">No rows match these filters. Plan work to create assignments, or clear the filters.</p>}
    </div>
  </section>;
}
