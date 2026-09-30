## Performance formatting — September 29, 2026

Removed broad details margins from the custom role filter; normalized Performance control heights, label typography, borders and responsive wrapping. Replaced dense metric-definition paragraphs with spaced, bold-labeled bullets while retaining native expand/collapse. No metric calculations changed. Typecheck, 152 tests and production build passed. Browser visual verification was unavailable.

## Automatic person-days and PTO — September 29, 2026

Person-days now derive from daily researcher allocations before reporting filters, excluding future work and full-day PTO. Prior recorded corrections remain preserved; no effort-confirmation UI remains. Weekly Plan provides self/planner PTO controls with versioning/audit and allocation annotations. No production data was rewritten.

Actual verification: typecheck, 152 synthetic tests and production build passed. Cases cover cross-role/team split conservation, repeated/derived entry deduplication, three-way rounding, future exclusion, prior corrections, PTO precedence/removal and self/planner permission/version/audit behavior. Browser visual verification was not available.

## Performance and confirmed effort — September 29, 2026

Implemented researcher/team comparison, per-search breakdowns, a one-measure matrix, search effort/yield, first-mapping age, weekly/work-date results and contribution shares. Added per-person/date confirmed effort with fractional search/team splits, audit/version checks, ownership/scope checks, and a one-day maximum. Positive effort protects allocations and effort history prevents role removal. Legacy output was not backfilled as effort.

Actual verification: typecheck passed, 147 synthetic tests passed, production build passed. New cases cover pending/returned versus final quality denominators, pooled team metrics, zero-output effort, unknown effort/rates, date filters and age, combined rendering, correction rollback/version conflicts, ownership and scope rejection, future/duplicate/invalid inputs, and allocation protection through both removal paths. No live user data used and no browser visual verification available. See PERFORMANCE.md for definitions and limitations.

## Delivery Monitor consolidation — September 29, 2026

Combined navigation, daily period/team/role filtering, attention indicators, an all-date review pipeline, candidate/repository links and contextual Team Allocation navigation. Retained coverage/blocker details and existing backend permission checks. Added synthetic tests for date boundaries, role selection, prior-period pending work, daily reconciliation, future/current-day attention rules, combined rendering and multi-researcher unplanned work. Typecheck, 139 tests and production build passed. No live user data used; browser visual verification remains unavailable.

## Shared content styling — September 29, 2026

Implemented Team Allocation table density/palette in shared main-content CSS; navigation is excluded. Removed the global third-column minimum width and constrained Search Decisions columns with wrapping headers. Standardized row labels, secondary text, compact decision badges/actions. Typecheck, 133 tests and production build passed. No browser visual verification was available; responsive behavior should be checked in the live app.

# Verification status

## Sortable planning sheets and company alignment — 2026-09-28

Search Decisions headers sort evidence, decisions and weekly history; Team Allocation headers sort role/team names, daily target totals and week totals. Headers expose direction and aria-sort. A shared comparator sorts numbers numerically and leaves missing values last. Company Universe explicitly left-aligns table headers, cells and header buttons, overriding a legacy global right-alignment rule. Typecheck, all 133 tests and production build passed. Comparator tests cover numeric, natural-text, date and blank ordering. Browser visual verification was not performed. Deployment is checked separately.

## Consistent sourcing colors — 2026-09-28

Start uses light green, Continue a deeper green, and Pause soft red. Decision/history badges and team-allocation cards use the same background, foreground and border palette. Typecheck, all 132 tests and production build passed. Browser visual verification was not performed. Deployment is checked separately.

## Shared application typography — 2026-09-28

Added typography.css as the single application type scale and removed 127 competing size/weight declarations from component styling, preserving font-face definitions, sign-in styling and candidate-facing role-document typography. Page headings use 23px, section headings 16px, table/body text 13px, controls and dropdown rows 12px, supporting text 11px, and compact weekly annotations 10px. Weights use 400/500/600 for content/controls/emphasis. Representative Weekly Plan, Candidates, Company Universe and Repository components rendered to static HTML with synthetic data. Typecheck, all 132 tests and production build passed. Browser computed-style/visual checking could not run: the browser executable was unavailable and its download was invalid. No authenticated browser verification occurred. Deployment is checked separately.

## Decision-first weekly planning — 2026-09-28

Search Decisions is the default view, with current sourcing evidence, sourcing-decision filters and an eight-week carry-forward history. Team Allocation defaults to active decisions. Backend checks require active decisions for new/moved assignments, target increases and researcher changes; unassigning unstarted work remains possible and recorded history is preserved. Inherited decisions have an optimistic source-version guard. Typecheck, all 132 tests and production build passed. Added tests cover carry-forward/future isolation, Eastern mapping dates, evidence counts, paused/stopped/undecided allocation rejection, active resumption, protected work, safe unassignment and stale inherited edits. Existing allocation tests now explicitly establish sourcing decisions. No live data was modified during verification; signed-in browser verification was not performed. Deployment is checked separately.

## Multi-role delivery filters and weekly cleanup — 2026-09-28

Weekly Plan and Daily Work share a role checkbox filter with client grouping, typed role/client/ID search, All, None and Show matching only. Weekly visible assignments/totals and Daily Work entries/assignments use selected IDs; an empty selection shows no roles. The weekly instruction paragraph, priority legend and priority-save notice are removed. Assigned priorities retain colored badges; unset priority remains plain text. Row borders and banding are lighter, with a bottom border beneath date headers. Typecheck, all 128 tests and production build passed. Signed-in browser interaction/visual verification was not performed; deployment is checked separately.

## Quieter weekly controls and Daily Work header — 2026-09-28

Weekly assignment plus controls are smaller and borderless at rest. Priority is plain muted text, with a distinct underlined Set/Edit action. Daily Work uses the shared compact page header. Typecheck, all 128 tests and production build passed. Signed-in browser visual verification was not performed. Deployment is checked separately.

## Candidate header and weekly plan readability — 2026-09-28

Candidates uses the compact page header and removes its duplicate directory heading. Manual role creation is removed from repository controls and rejected by the mutation API; RecruitCRM import remains the new-role route. Weekly role options use aligned ID/text columns. Weekly rows gain horizontal separators and alternating shading; compact labelled icon buttons and a legend replace repeated assignment-action text. Typecheck, all 128 tests and production build passed. Regression coverage confirms manual creation is rejected before any workspace write. Signed-in browser visual verification was not performed. Deployment is checked separately.

## Weekly plan role picker — 2026-09-28

Replaced the separate search dropdown and Find field with the shared searchable RolePicker, including role ID/company/title matching, internal sort controls and All roles reset. Team view retains its team selector. Typecheck, all 127 tests and production build passed. Signed-in browser verification was not performed; deployment is checked separately.

## Compact repository and company layout — 2026-09-28

Candidate mappings is the first/default repository tab, including sidebar entry. Explicit links to target companies retain their destination. Compact page headers, one repository control row, sorting inside the role picker, and secondary action menus reduce space above the table. Company Universe removes its duplicated heading/help blocks, groups filters/actions in one toolbar and reveals role-assignment controls after company selection. Typecheck, all 127 tests and production build passed. Signed-in browser visual verification was not performed. Deployment is checked separately through GitHub Actions.

## Role lifecycle and independent partner save — 2026-09-28

Role Repository replaces Searches in navigation, with a filter over actual RecruitCRM statuses, selected-role status, partner editing and guarded removal of empty roles. Workspace status reads use the latest fetched CRM snapshot. Integrations saves a partner separately from adding/updating repository roles; saved assignments persist across fetches in a versioned tenant-local table. Removal rejects any planning, research, publication or invitation history, checks permissions/version and audits the deletion; RecruitCRM is untouched and the partner is retained for re-addition. Typecheck, 127 tests and production build passed; regression coverage includes independent save, refresh persistence, stale saves/imports, permissions, guarded removal and status refresh. No live records were changed during verification. Signed-in browser verification was not performed; deployment is checked separately.

## Compact candidate directory — 2026-09-28

Directory shows 25/50/100 rows per page, immediate global and per-column filters, sortable identity columns, distinct mapped-role counts and profile links. Expanded mapping attribution is removed from directory rows. Typecheck, all 125 tests and production build passed. Tests exercise combined filters, LinkedIn/company sorting, 3,001-record pagination, empty/shrinking results and distinct role counts. Existing mapping integration coverage now asserts compact counts without mapper attribution. No live records were changed and signed-in browser verification was not performed. Pagination is client-side; records still arrive in workspace state. Deployment is verified separately in GitHub Actions.

## Role repository clarity — 2026-09-28

Removed the workflow tutorial and Team, Person, Strategy subcategory and Status filters. The selected role updates the main screen title, with company and role ID beneath it. Role selection has a full-width input and aligned option columns; Sort and Find remain. Typecheck, all 122 tests and production build passed. Signed-in browser visual verification was not performed. Deployment is checked separately through GitHub Actions.

## Searches filter cleanup — 2026-09-28

Removed the shared From/Through and All searches controls, including Clear filters, from Searches. Portfolio cards and totals now ignore those shared filters; the client/role/CRM text search remains. Typecheck, all 122 tests and production build passed locally. Signed-in browser verification was not performed. Deployment is verified separately through GitHub Actions.

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

## Accepted accounts and UI clarity — 2026-09-28

Typecheck, all 112 tests and production build passed locally. Updated tests replace pre-activation reviewer support with accepted-account-only assignment and pairing. New tests verify owner-only cleanup, preserved owner credentials/session, revoked other workspace access, cancelled invitations, stale preview rejection and cross-workspace isolation. Researcher role upgrades now use the existing account identity. Invitations create no assignable person until acceptance. Searches and Company Universe controls were regrouped, and action buttons use consistent tinted/primary treatments. Authenticated visual QA and live cleanup were not performed: the available browser shows the sign-in page. Cleanup remains an explicit owner action after deployment.

## Legacy duplicate-name fix — 2026-09-28

The accounts-only synchronization could hit the legacy UNIQUE staff.name constraint when an accepted account shared a name with an unlinked historical record or another account. Synchronization now disambiguates its internal storage label while state returns the authoritative account display name. Historical staff IDs and work are unchanged. Regression coverage verifies same-name legacy/account records, two accepted accounts with the same name, repeated state loads and assigning both accepted accounts. All 113 tests, typecheck and production build passed. The reported production error was not inspected in a signed-in session; this database failure was identified and reproduced through the regression scenario.

## Role-first My Work — 2026-09-28

All 120 tests, typecheck and production build passed. New tests cover inline company/target creation and rollback, canonical candidate reuse, duplicate role rejection, stale profile versions, actual researcher/team attribution, independent coverage vs candidate review, inline entry without dialog/contact fields, role-first screen rendering and explicit Daily Work labels. No customer data was imported, changed or deleted during testing. Authenticated browser interaction was not verified.

Additional coverage verifies atomic multi-company assignment, stale/cross-role/permission failures, role-plan team inference for Assign to me, enforcement of an explicitly assigned company team, and no-talent completion counted with zero mappings and retained researcher/team attribution.

## Focused work and repository navigation — 2026-09-28

Daily Work excludes removed-user entries and their totals, including rows populated only by removed people; genuine empty plans remain visible. Stored history is unchanged. My Work focuses one role with mapping/coverage tabs, retained inputs while switching tabs, and a guarded Back action. Repository role selection supports typed ID/company/title search and numeric ID or company sorting. Target selection and Wave are separate columns. Shared tables use stronger blue row contrast.

All 122 tests, typecheck and production build passed locally. Regression tests cover mixed/removed-only Daily Work rows and role search/sort behavior. No live data was modified for verification. Signed-in browser visual/interaction verification was not performed. Deployment is checked separately through GitHub Actions.

## 2026-09-29 — clean-start reset and landing page

Implemented original-owner-only full reset with record-count preview, email confirmation, stale-state checks, transactional per-record backup/deletion, downloadable retained snapshots, and explicit partial-result handling for separate identity cleanup. Preserves owner credentials/roles, other tenants, integration secrets, and immutable audit/research events. Removed Overview and redundant navigation workspace label; default landing is Delivery Monitor or researcher My Work.

Verified locally: typecheck, 156 passing tests, production build. Added actual SQLite foreign-key reset/archive, stale preview/no-write, rollback, and authenticated worker owner/email tests; existing identity test verifies preserved owner password/session and other-tenant membership. Production reset has not been run: the available browser is signed out. No live dataset counts or recovery drill are claimed. Reset is an explicit owner operation, never a migration on deployment.

## 2026-09-29 — named clean baseline

Added original-owner-only, non-destructive Save clean baseline action and named snapshot listing. SQLite test verifies non-empty rejection, preserved owner staff, saved contents, idempotence and admin rejection. Typecheck, all 157 tests and production build passed. The preceding live reset was successfully executed: all displayed operating counts were zero, only the owner and their researcher identity remained, and recovery snapshot 5c37649a-c12f-4caa-8f09-eaf4380c049a was reported saved. Baseline creation requires the separate live owner action after deployment.

## 2026-09-30 — search workflow revision

Typecheck, 166 tests and production build passed before deployment. Added actual SQLite tests for original-document storage independent of publication, strategy evidence enforcement, lead self-review/pending rerouting, returned information, rejection of Hold decisions, permission-scoped setup tasks, roster transfer preserving history and canonical alias matching. Added person-day task deduplication and date formatting tests. Updated superseded UI/auto-pairing expectations to explicit team lead and optional publication behavior. No production records were created, reset or used as test fixtures. Existing baseline and reset snapshots remain intact. Browser validation follows deployment; local tests do not establish visual quality or live behavior.

Fit-criteria usability update: local typecheck, all 168 tests and production build pass. New SQLite coverage verifies that inline mapping creation saves criterion justification and the approved requirement snapshot before submission, and that it can then enter team review. Criteria-count coverage exercises more than 30 entries. Live visual verification follows deployment; no production sample data was created for these tests.

Fit ratings and compact mapping lists: local typecheck, 171 tests and production build pass. Tests cover rating validation, equal-weight averages, incomplete and N/A treatment, and exclusion of changed requirements from current-strategy comparisons. No live candidate ratings were added by verification.

Missing strategy submission fix: local typecheck, all 173 tests and production build passed. Shared readiness checks distinguish missing/unapproved strategy from an approved future start, never display null as a date, and permit an approved strategy on its start date. The researcher fit panel keeps draft saving available and disables submission with the prerequisite shown. Production strategy approvals and candidate records were not changed.

Performance focused-detail redesign: typecheck, all 173 existing tests and production build passed locally. Metric calculations are unchanged. Detail views replace nested expanded rows; separate tabs, narrower six-column breakdowns and compact summary strips reduce simultaneous information. Live visual verification follows deployment; production data is not modified for screenshots.

CRM refresh propagation: local typecheck, 174 tests and production build pass. SQLite tests verify title/status/client propagation, preserved local partner and entry history, no automatic addition of new jobs, no version churn on identical refresh, and retention of searches absent from the snapshot. Existing stale-version protection is retained.

Weighted fit update: typecheck and production build passed; all 178 tests passed. Coverage verifies 60/40 scoring, exact equal distribution, invalid/mixed weights, all/any criterion filters with independent thresholds, N/A handling, weight-only recalculation, and transactional strategy save/approval persistence. No live strategy weights or candidate ratings were changed for testing. Live layout inspection follows deployment.

Weekly task visibility: typecheck, all 180 tests and production build passed. New synthetic tests cover cross-team task/allocation overlap, candidate-output deduplication, completed/cancelled tasks, date boundaries and PTO. No production planning records were changed. Live deployment and visual verification are checked separately.

Candidate 360 and engagement: local typecheck, all 186 tests and production build passed. New actual SQLite tests verify transactional partner handoff, retained sourcing/partner ownership, separate engagement team validation, unauthorized/stale writes, dated sequence completion and next-step scheduling, response/reopened-sourcing pauses, reapproval deduplication, active-membership enforcement, candidate tags and scoped notes, attachment round-trip and access boundaries. Synthetic server-render checks cover the engagement list and profile tabs. No live roles, teams, candidate stages or outreach messages were changed by verification. Live deployment and layout inspection are checked separately. Candidate files are included in reset snapshots; deployment itself never resets data.

Lifecycle regression: a weekly Stop sourcing decision still permits engagement sequence work; overall Closed/Abandoned/Cancelled search statuses block outreach while preserving sourcing approval, notes and candidate outcomes.

First engagement publish attempt passed GitHub tests/build but failed before upload because Wrangler resolved a case-colliding module name. Renamed the server module to engagement-domain.ts. Typecheck, 186 tests, production build and Wrangler deployment dry-run then passed locally; the retry deployment is verified separately.

Search-level engagement assignment correction: supersedes candidate ownership in the initial release. The API rejects the retired candidate-assignment action. Tests cover multiple engagement members working on the same candidate queue, search reassignment revoking former-member access, and later partner approvals inheriting search membership without any candidate allocation. Interaction authorship remains immutable; sourcing and search-partner attribution stay unchanged. Local typecheck, 188 tests, build and Worker dry-run are the release gates for this correction.

## Global engagement pipeline (30 September 2026)
- Replaced per-search sequence controls with a global Admin stage configuration and separate Engagement navigation for Pipeline / Search assignments.
- Synthetic coverage now includes global admin permissions, stale configuration and record versions, occupied-stage removal protection, immutable transition notes/duration, same-stage age preservation, multiple search assignees, later handoffs, exited/late funnel classification, unknown historical ages, and closed-search restrictions independent of sourcing Stop.
- Local typecheck, all 190 tests, production build and Worker dry-run passed. Live production data is not changed for QA; browser checks inspect navigation, board/list, Admin and unsaved movement controls only.
