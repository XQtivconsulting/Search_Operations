# Change audit and draft removal

Every persisted row insert, update and deletion in the Identity and Workspace application tables is journaled by SQLite triggers. Journal entries retain authenticated actor ID, workspace where available, action, request correlation, table, row identity, timestamp, and before/after snapshots. Existing business/review histories remain intact. Triggers run in the same statement/transaction as the change; rollback also rolls back its journal. Replacement writes retain both deleted and inserted row snapshots. No-op updates are omitted.

AsyncLocalStorage carries actor context across asynchronous work. The SQL context row is set immediately before each synchronous write. Constructor migrations reset context to system:initialization; scheduled jobs and setup identify themselves as system actions. Account-level sessions use the verified user ID without inventing a workspace. Unauthenticated candidate verification requests use an explicit external identity.

Audit tables are append-only (updates, deletes and replacement inserts are rejected). Audit/context tables and rate-limit counters are excluded from recursive journaling. Credentials, tokens and verification hashes are redacted. Attachment chunks record size and file/part identity rather than duplicating binary content. Workspace exports include change_events. Identity history stays in the separate identity database. This captures changes going forward; missing historical events cannot be reconstructed. It does not log cosmetic UI interactions or every read.

New tables/columns receive trigger coverage on initialization. New mutating RPC entry points must establish trusted actor context using withAudit. Direct SQL migrations use an explicit system actor; never take actor IDs from a request body.

## Remove from search

The mapping table offers Remove from search only on never-submitted Draft mappings to the original mapper with candidates.add or the assigned search partner with reviews.partner. The server rechecks permissions, ownership, version, status, submission/review flags and immutable event history. Review history permanently prevents removal, including returned or reopened records.

Removal changes the retained record to mapping-removed, records who/when and preserves audit history. It leaves the candidate, company, target and mappings to other searches intact. Removed records are excluded from active application state and mapping metrics. A later intentional import can create a fresh draft linked to the same candidate; the previous removal remains in history.

## Verification

Synthetic tests cover actor isolation across interleaved async requests, rollback, before/after values, no-op updates, credential redaction, schema changes, replacement writes, audit immutability, authorized/unauthorized removal, stale versions, prior review history, cross-search preservation and re-addition. The real workerd/SQLite import test verifies the authenticated actor in the journal. No production candidate records were modified for testing.
