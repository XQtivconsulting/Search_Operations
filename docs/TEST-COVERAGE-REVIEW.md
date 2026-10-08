# Test coverage review — 8 October 2026

The suite remains synthetic and runs against current source, with SQLite standing in for Durable Object SQL where needed. No customer data or real user accounts are used.

## Changes made

- Moved four retired manual-count mutation checks out of the active planning suite into `legacy-count-compatibility.test.ts`. They still run in CI because stored count history, zero values, locking and atomic rollback must remain recoverable. The HTTP tests continue to verify that manual-count endpoints are retired.
- Removed the unused automatic Board-to-List helper and its obsolete assertions. Engagement now has explicit List and Kanban selection inside the shared search workspace.
- Updated interview tracker assertions to the current round headings and inline recommendation control.
- Updated role setup tests to use current Research Team Lead/Partner templates, rather than assigning retired Planner/Founder roles. Added coverage that existing retired memberships keep their effective access until an administrator reassigns them.
- Added database and bulk-update duplicate Search ID rejection, status transition timestamps/notes/actor/stale-save checks, historical unknown-date handling, exact status-history backup recovery, and queue-to-dashboard cohort checks.

## Coverage retained deliberately

Authentication, tenant isolation, ownership, backend permissions, optimistic versions, imports, sequential numbering, backup/restore, destructive-reset restrictions, mapping review history, legacy assignment migration, URL normalization, sanitization and 20,000-record indexing checks remain relevant. Public role-document and invitation safety tests remain because the legacy endpoints and saved documents still exist even though publication controls were removed from the current UI. Removing a button does not remove the need to protect its old endpoint.

## Execution

`npm run typecheck`, `npm test`, and `npm run build` are release gates. Local runs may use `--test-concurrency=4` to limit memory. All root `tests/*.test.ts` files, including explicitly named compatibility coverage, remain included; no tests were silently skipped or archived outside the test glob.

Temporary synthetic component interaction checks exercised inline date editing without a dialog, preserved mapping/engagement versions in the save payload, automatic correction notes, queue routing and the comparison grid. A browser screenshot pass could not run because the browser binary download was truncated; do not treat component tests as visual or authenticated production verification.
