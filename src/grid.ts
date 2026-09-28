// Excel tab-separated clipboard parsing, including quoted multiline cells.
export function parseClipboard(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && (quoted || cell === "")) {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === '\t' || c === '\n' || c === '\r')) {
      row.push(cell); cell = "";
      if (c !== '\t') { rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else cell += c;
  }
  if (quoted) throw new Error("The pasted text has an unclosed quoted cell.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
export function gridCount(value: string, required = false): number | null {
  if (value.trim() === "") { if (required) throw new Error("Enter an approval count, including 0 when none were approved."); return null; }
  if (!/^\d+$/.test(value.trim()) || Number(value) > 100000) throw new Error("Use whole numbers between 0 and 100,000.");
  return Number(value);
}
