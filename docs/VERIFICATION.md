# Verification status

## Completed

- Document-only regression tests verify cross-role title/client isolation, clearing previous partner/link fields, source-text validation, multi-line titles, PDF line reconstruction, column reading order, visible save/publish controls, and atomic publication rollback. The downloadable XLSX was rendered, inspected and read through the same import library; all columns map and the Companies sheet contains no sample records.
- The local page preview could not be opened by the cloud browser (ERR_BLOCKED_BY_CLIENT). No interactive visual pass is claimed. The supplied Evalueserve PDF is not accessible in this workspace; document tests use synthetic inputs. Exact conversion of that file still needs validation after re-upload.


- Candidate-page tests cover approved/published snapshot separation, anonymous-link denial, mapped-candidate/manager authorization, secret exclusion, email-code attempts, single use, expiry, cross-invitation binding and immediate revocation. Password tests exercise current-password verification, attempt counters, new-password validation, session rotation and same-origin API enforcement.
- Company-import tests cover repeated rows, tag union, protected scalar values, explicit replacement, ambiguous/conflicting identifiers, stale previews and permissions. Research-wave tests cover transactional rollback and role-specific identity.
- Synthetic DOCX, PDF and XLSX files were processed with the installed parsers; no customer files or accounts were used. Rendering tests verify escaped document text and allowlisted video providers. Public lookup and candidate email tests use synthetic transports, never real recipients.
- workerd tests validate candidate token/code cryptography and role-email Request options, in addition to the existing CRM/email adapter tests.


- Daily Work grouping/sorting tests verify researcher-day deduplication across roles, target preservation, unplanned work and zero-versus-unknown output. Company master tests cover metadata, durable identity on rename, role targets without upfront strategy/assignment, version checks and atomic selection. Peer tests cover reciprocal two-person routing, same-team restrictions, reassignment and membership removal.
- Estimated effort hours removed from domain output and all application views. Review turnaround still measures elapsed time, not researcher effort.


- Candidate workflow tests cover reusable candidate identity across roles, duplicate and atomic batch rollback, two-stage authorization, self-review prevention, stale versions, rework/reopening without count inflation, immutable review snapshots, company claim races, manual/derived cutover, linked-plan removal protection, revocable client-safe publication, same-origin API writes and authenticated tenant routing.
- React server-render smoke checks cover repository tabs and cross-role views with synthetic data. These are not interactive browser checks.


- Applied supplied brand-guide palette (navy #001B50, crimson #EF233C, slate #8D99AF, paper #EDF2F5) and the original XQtiv logo. Poppins Latin fonts are self-hosted with their SIL Open Font License.
- CRM filter tests verify OR within selected column values, AND across columns, empty versus unrestricted selections, text filtering, and partner filters. Partner import tests verify authoritative member names, whole-batch validation, ownership preservation, and explicit clearing.

- Weekly planning tests cover seven days including weekends, team roster snapshots, atomic rollback, stale versions, duplicate prevention, removal protection for recorded zero output, planning permissions, partner API validation, and migration of legacy duplicate decisions with history retained.
- The owner confirmed RecruitCRM company-name import works.

- Compact workspace CSS reduces repeated row, card, form and section spacing. Fixed checkbox inputs inheriting the global 48px form minimum height. Typecheck, all tests and build passed after this CSS change; authenticated visual verification remains outstanding.

- TypeScript checking, 78 automated tests and the Vite production build pass locally.
- Bulk-write tests cover rollback, audit records, permissions, optimistic versions, review locks and clipboard handling.
- CRM company tests cover paginated exact-slug name joins, hostile company pagination, automatic client creation/update, and preservation of existing client names when absent. Workspace fixtures exercise migration from the prior staging schema.
- CRM tests cover configuration formats, tenant isolation for plain-token fallback, pagination, hostile URLs, access errors, timeouts, invalid responses, staging and selected apply.
- The edge transport regression test executes the actual CRM and email adapters inside workerd via Miniflare. Synthetic responses avoid external traffic and real credentials. It verifies supported Request options and rejection of redirects without forwarding credentials.
- Root cause reproduced: workerd rejects redirect mode `error` before network dispatch. Both adapters now use `manual` and reject redirect responses.
- The application has been deployed to the owner's Cloudflare account through GitHub Actions. The first-administrator setup page was checked in the browser, and the owner confirmed signing in.
- Setup tests cover secret rejection, concurrent first-admin invitation prevention and denial after an existing membership.

## Still unverified

- Live end-to-end candidate email delivery, hosted video playback and Wikidata lookup. No real candidate invitations were sent. Original documents/video files are not stored; PDF OCR is not supported.
- Interactive visual checks of the new page editor and XLSX column-mapping flow in a browser. Automated parser and React render checks passed; these do not substitute for an authenticated browser walkthrough.


- Full browser walkthrough of new research screens with live authenticated personas. No customer records or real accounts were used in automated tests.

- Weekly planning visual/interactive browser verification: the cloud browser rejected the local synthetic preview with ERR_BLOCKED_BY_CLIENT. No live authenticated planning writes were attempted. Automated tests use synthetic accounts and data.
- Invitation inbox delivery after the transport fix.
- Full authenticated persona walkthrough, backup restoration, load testing and independent security review.
- Historical workbook migration: source inspection is complete, but no spreadsheet data was imported by this build.

The runtime tests use synthetic provider responses and do not claim live API success.

## Researcher editing and reviewer setup — 2026-09-28

- Actual local checks: TypeScript passed, all 87 tests passed, Vite production build passed and Wrangler Worker dry-run packaging passed.
- Added SQLite tests for versioned staff edits, duplicate names, admin permission, missing staff, contact privacy, archive/restore, roster invalidation and preservation of historical entries.
- Added peer routing tests for account-free setup, self/outsider rejection, activation at submission, no silent fallback and preservation of already-pending review ownership. React render checks cover enabled unlinked researcher selectors and staff actions.
- Added identity tests for replacement-invitation invalidation, duplicate account prevention, current-password/email proof, session binding, expiry, rate limits, email uniqueness, membership preservation and session rotation. Worker checks cover admin-only directory access and same-origin/method enforcement. Mail transport tests use synthetic responses.
- No customer records were edited and no real verification emails were sent during testing. Live email inbox delivery and an authenticated browser walkthrough remain unverified. Deployment status must be checked separately in the GitHub Actions run for the release commit.

## People, candidate workflow and assignment release — 2026-09-28

Local verification: TypeScript passed, all 106 Node tests passed, Vite production build passed, and Wrangler deployment dry-run passed. Added coverage for owner migration, multiple roles, stale account sessions, candidate uniqueness and multi-role relationships, permissions, target assignment, company keyword matching, workflow summary rendering, and atomic weekly move/unassign (targets/notes/rosters, recorded-zero protection, collisions, stale versions and authorization). Existing data is retained; manual count write endpoints are retired. No real accounts, customer records or outbound invitations were used in tests. Authenticated browser interactions and actual customer account records were not inspected. Deployment must additionally be confirmed by the GitHub Actions result.

## Candidate bulk import — 2026-09-28

Typecheck, all 110 tests, and production build passed locally. New tests cover header/row validation, canonical duplicate reuse, repeated-import idempotency, independent mappings by different researchers, permission checks, stale previews and atomic rollback. No live candidate data was imported and authenticated browser interaction was not tested. GitHub Actions independently runs the gates before Cloudflare deployment.

Individual researcher selection was also verified: new allocations snapshot only selected researchers, unstarted selections can change, outsiders are rejected, and recorded zero output protects existing allocation.
