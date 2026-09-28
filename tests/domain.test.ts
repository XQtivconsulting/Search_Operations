import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { aggregate, validateCounts, safeLink, count } from "../src/domain";
import { workspaceSchema, identitySchema } from "../src/schema";
test("counts distinguish pending from a completed zero approval", () => {
  assert.equal(count("", "mapped"), null);
  assert.equal(count(0, "mapped"), 0);
  assert.doesNotThrow(() => validateCounts(10, 0, 0));
  assert.throws(() => validateCounts(10, null, 0));
  assert.throws(() => validateCounts(10, 4, 5));
});
test("aggregate ratios use shared totals and person-days deduplicate sessions", () => {
  const m = aggregate([
    { staff_id: "a", work_date: "2026-09-01", mapped: 10, peer: 8, partner: 5 },
    {
      staff_id: "a",
      work_date: "2026-09-01",
      mapped: 20,
      peer: 10,
      partner: 10,
    },
    { staff_id: "b", work_date: "2026-09-01", mapped: 0, peer: 0, partner: 0 },
  ]);
  assert.equal(m.approvalRate, 0.5);
  assert.equal(m.personDays, 2);
  assert.equal(m.estimatedHours, 16);
  assert.equal(m.mappingPerDay, 15);
});
test("breakdown links reject executable and credential-bearing URLs", () => {
  assert.throws(() => safeLink("javascript:alert(1)"));
  assert.throws(() => safeLink("https://user:secret@example.com"));
  assert.equal(
    safeLink("https://example.com/candidates"),
    "https://example.com/candidates",
  );
});
test("schemas execute and enforce reference and entry identity constraints", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  db.exec(identitySchema);
  db.exec(workspaceSchema);
  db.exec(
    "INSERT INTO teams VALUES('team','Blue'); INSERT INTO staff VALUES('staff','Researcher'); INSERT INTO searches(id,client,title) VALUES('search','Example client','Role'); INSERT INTO assignments(id,search_id,team_id,work_date) VALUES('work','search','team','2026-09-01'); INSERT INTO entries(id,assignment_id,staff_id) VALUES('entry','work','staff');",
  );
  assert.throws(() =>
    db.exec(
      "INSERT INTO entries(id,assignment_id,staff_id) VALUES('other','work','staff')",
    ),
  );
  assert.throws(() =>
    db.exec(
      "INSERT INTO entries(id,assignment_id,staff_id) VALUES('missing','no-work','staff')",
    ),
  );
  db.close();
});

