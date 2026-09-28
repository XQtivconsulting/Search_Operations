export type AccessRole =
  | "super_admin"
  | "admin"
  | "founder"
  | "planner"
  | "partner"
  | "researcher";
export type Actor = {
  id: string;
  name: string;
  email: string;
  tenant: string;
  role: AccessRole;
  roles?: AccessRole[];
  staffId: string | null;
};
export const roles: AccessRole[] = [
  "super_admin",
  "admin",
  "founder",
  "planner",
  "partner",
  "researcher",
];
export function roleList(a: {role?: unknown;roles?: unknown}): AccessRole[] {
  return (Array.isArray(a.roles)?a.roles:[a.role]).filter((v):v is AccessRole=>roles.includes(v as AccessRole));
}
export const hasRole=(a:{role?:unknown;roles?:unknown},role:AccessRole)=>roleList(a).includes(role)||(role==='admin'&&roleList(a).includes('super_admin'));
export const canPlan = (a: {role?:unknown;roles?:unknown}) => hasRole(a,'admin')||hasRole(a,'planner');
export const canPartnerReview = (a: {role?:unknown;roles?:unknown}) => hasRole(a,'admin')||hasRole(a,'partner');
export const roleLabel=(role:string)=>role==='super_admin'?'Super admin':role.charAt(0).toUpperCase()+role.slice(1);
export function requireThat(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw Object.assign(new Error(message), { status });
}
export function count(
  v: unknown,
  label: string,
  nullable = true,
): number | null {
  if (nullable && (v === null || v === "" || v === undefined)) return null;
  requireThat((typeof v === 'number' || typeof v === 'string') && String(v).trim() !== '', `${label} is required.`);
  const n = Number(v);
  requireThat(
    Number.isSafeInteger(n) && n >= 0 && n <= 100000,
    `${label} must be a whole number from 0 to 100,000.`,
  );
  return n;
}
export function text(v: unknown, max = 500): string {
  return String(v ?? "")
    .trim()
    .slice(0, max);
}
export function day(v: unknown): string {
  const s = text(v, 10);
  requireThat(
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s,
    "Choose a valid date.",
  );
  return s;
}
export function safeLink(v: unknown): string {
  const s = text(v, 3000);
  if (!s) return "";
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error("Use a complete https:// link.");
  }
  requireThat(
    u.protocol === "https:" && !u.username && !u.password,
    "Use an HTTPS link without embedded credentials.",
  );
  return u.href;
}
export function validateCounts(
  mapped: number | null,
  peer: number | null,
  partner: number | null,
) {
  requireThat(
    peer === null || (mapped !== null && peer <= mapped),
    "Peer approvals cannot exceed mapped profiles.",
  );
  requireThat(
    partner === null || (peer !== null && partner <= peer),
    "Partner approvals cannot exceed peer approvals.",
  );
}
export function aggregate(
  entries: {
    mapped: number | null;
    peer: number | null;
    partner: number | null;
    staff_id: string;
    work_date: string;
  }[],
) {
  const sum = (k: "mapped" | "peer" | "partner") =>
    entries.reduce((a, e) => a + (e[k] ?? 0), 0);
  const days = new Set(
    entries
      .filter((e) => e.mapped !== null)
      .map((e) => `${e.staff_id}:${e.work_date}`),
  ).size;
  const mapped = sum("mapped"),
    peer = sum("peer"),
    partner = sum("partner");
  return {
    mapped,
    peer,
    partner,
    personDays: days,
    approvalRate: mapped ? partner / mapped : null,
    mappingPerDay: days ? mapped / days : null,
    unknownMapped: entries.filter((e) => e.mapped === null).length,
  };
}
