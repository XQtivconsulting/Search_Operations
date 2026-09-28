# Architecture

## Runtime

React/TypeScript/Vite serves the browser UI. Cloudflare Workers serves authenticated APIs and static assets. Each tenant has a separate SQLite-backed Workspace Durable Object; a separate Identity Durable Object stores users, memberships, invitations and sessions. Workspace routing follows authenticated membership, never an unverified tenant ID.

Cloudflare’s SQLite storage reference: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/

This model isolates tenants physically. Large individual tenants still need load testing, server pagination and reporting queries. It is not a claim of unlimited scale. Private file attachments can be added in Cloudflare R2 later.

## Product model

Role is the search engagement; Position is one seat. The pilot’s `searches` table represents Roles and its UI uses Searches. Separate Position, candidate, strategy and delivery objects belong to the next phase. Aggregate historical output must never be combined with candidate-derived counts for the same work.

Current tables: searches, teams, staff, assignments, entries, reviews, weekly_decisions, audit, imports, issues, settings. Integration tables: crm_jobs and integration_runs. Identity tables: users, memberships, sessions, invites, limits.

## Components

- src/main.tsx: sign-in, portfolio, weekly plan, daily work, review and performance views.
- src/BulkSheet.tsx and src/grid.ts: spreadsheet editing, clipboard parsing, staged edits, row selection, undo and validation.
- src/CRMPanel.tsx: administrator job preview and selected import.
- src/worker.ts: session authentication, origin checks, API routing and response security headers.
- src/workspace.ts: tenant storage, domain permissions, transactions, audit and import.
- src/identity.ts and src/password.ts: identity lifecycle and password hashing.
- src/schema.ts: additive SQLite schema.
- src/recruitcrm.ts: paginated server-side job fetch, normalized fields and URL restrictions.

## Bulk editing

POST /api/bulk accepts 1–200 operations. Each record includes its last-read version. All operations execute inside one synchronous SQLite transaction, including audit events. Any validation, permission or version failure rolls back the batch. Repeating a completed save with stale versions fails safely rather than duplicating review events. Output that has been reviewed must be reopened before editing. Zero approvals means completed review; null means pending.

The UI edits two adjacent columns (count and notes), supports Excel TSV paste, selected-row fill and undo. It blocks filter/mode changes while edits are pending and warns before navigation. It does not implement spreadsheet formulas, arbitrary columns, drag-fill or bulk assignment creation.

## RecruitCRM

GET /api/crm/status returns connection state and staged jobs, only to administrators. POST /api/crm/fetch pulls all paginated jobs into a preview without changing operational records. POST /api/crm/apply atomically applies selected preview records with version checks.

Job numeric IDs match explicit external_id values; names are never fuzzy-matched. Duplicate local IDs block application. RecruitCRM owns title, company name and external status. The adapter fetches paginated companies and joins company_slug to the exact company slug. Selected applies update client names along with title/status; plans, output and review history stay intact. If no company name is available, existing clients are retained and new jobs require manual client entry. The staging table gains company_name through an additive, idempotent migration. Preview headers toggle ascending/descending sort without clearing selections; rows use compact spacing. Manual inspection of initial ID matches is required before applying.

RECRUITCRM_TOKENS is a Worker secret containing a JSON object keyed by tenant ID. Tokens are never returned to browsers, written to source or logged. This is a small-pilot connection mechanism; external customer onboarding should move to managed tenant secret references. The HTTP adapter restricts pagination to the known RecruitCRM HTTPS endpoint and rejects redirects. Rate limits produce a retry message. There is no scheduler, writeback, candidate handoff or automatic retry queue yet.

Official API reference: https://help.recruitcrm.io/en/articles/11142291-commonly-used-api-endpoints-for-careers-page-part-1

## Metrics

Partner approval rate = summed partner approvals / summed mapped output in the same scope. Never average row percentages. A person-day is a unique staff/date with known mapped output, including zero. No effort-hour conversion is calculated or displayed. Blank counts remain unknown. Person-days for separate searches are not additive if the same person worked on multiple searches that day. Historical source contradictions remain flagged, not silently corrected.

## Security and operational limits

Invitation membership, Secure/HttpOnly/SameSite cookies, same-origin writes, action authorization, version checks and transactional audits are implemented. Password recovery, SSO/MFA, device/session management, independent security assessment, authenticated accessibility walkthrough, restore drills and load testing remain release gates before wider use. Pilot queries load the authorized tenant dataset into the client; server paging is required before larger deployments.

## Weekly planning

See [Weekly planning](WEEKLY-PLANNING.md). `team_members` and versioned `team_rosters` define research teams. New assignments snapshot members into entries. `weekly_priorities` provides a unique current record per search/Monday week; legacy `weekly_decisions` stays append-only. Startup migration retains all historical events and materializes the latest per calendar week. `searches.partner_id` stores the selected account; the API validates active eligible membership in the authenticated tenant and stores its name for display.

The `week-plan` mutation saves seven days atomically, with assignment and roster versions, duplicate checks, and protection of recorded output. The planner displays these same assignments by search or team. Roster changes do not rewrite existing work.

## Brand and integration controls

The UI uses the supplied XQtiv Colors palette, with an original logo extracted from the brand guide. `/brand/xqtiv-logo.svg` wraps the unmodified PNG in a tight SVG viewport. Poppins Latin webfonts are self-hosted under `/fonts` with the SIL license; other character sets use the system fallback. No font requests leave the app at runtime.

The CRM preview supports text filters for IDs/titles and multi-select column filters for statuses, companies and engagement partners. Values within a column combine with OR; columns combine with AND. Filters clear row selection, and imports only apply selected visible rows. Existing engagement partners can be saved independently of CRM field changes; new jobs can receive a partner during selected import. The server validates every chosen account against active eligible members in the authenticated workspace before applying the batch. An ordinary CRM refresh preserves local ownership.

Weekly priority labels and allocation borders share distinct Start, Continue, Recalibrate, Pause and Stop colors, with visible text retained for accessibility.

## Candidate research workflow

`research_records` stores typed, versioned tenant objects with unique `(kind, record_key)` identities for brief/strategy by role, company by normalized name, target by role/company, candidate by canonical LinkedIn URL, mapping by role/candidate and reviewer pairings by team/researcher (with legacy team defaults retained). `research_events` preserves immutable old/new snapshots for review and lifecycle actions. SQL transactions include domain writes, events and audit records. `brief_shares` is a retired legacy table; anonymous reads are disabled. `role_publications` holds an allowlisted approved page snapshot. Private `candidate_invites`, `candidate_codes`, `candidate_sessions` and `candidate_limits` enforce email verification, expiry, throttling and revocation.

POST `/api/research` authenticates membership, loads authoritative active members, and dispatches permission-checked operations inside the tenant Durable Object. Bulk submit/review is atomic. Legacy GET `/api/public-brief` always denies access. POST `/api/candidate/code`, `/verify` and `/page` use an invitation capability followed by a separately scoped HttpOnly session; the chosen tenant alone never grants access. The normal state includes a directory of active names/roles/staff links, with no email or credentials.

Derived daily entries are calculated from submitted candidate mappings, never written into legacy entries. Manual counts on/after the strategy activation date are prohibited, including via the bulk API. Historical counts remain separate dated records. All company assignments, review ownership, document publication and cutover rules are described in [Research workflow](RESEARCH-WORKFLOW.md).

## Daily views, company master and team peer routing

Daily Work uses compact assignment rows, including unplanned candidate-derived work. Headers sort date/team/client/role/partner and numerical outputs; grouping supports team, date, Monday week, client, role and partner. Browser-local layout preferences are scoped to user and tenant. Group researcher-days are recomputed over underlying person/date records rather than summed across roles. Expanded rows retain researcher-level historical actions and mapping links.

Company master records now carry optional company type, industry tags, offerings, specialties, geographies, website and notes. Facet filters combine with AND across attributes. Adding selected company IDs to a role is an atomic batch. Target company scope, titles, category, priority, team and owner are optional; strategy approval is required for candidate submission, not for building a target list. Renaming a company retains its ID and role references; candidate mappings retain their historical snapshots.

`peer-route` records map team/staff to an active teammate account. Submit resolves explicit pairing, automatic reciprocal pairing if there is one other researcher, then a valid legacy team default. Explicit mapping reassignment remains versioned and audited. Setup, submission, reassignment and peer decisions all enforce current team membership and exclude the mapper's staff identity. Pending decisions are not silently reassigned when team configuration changes.

## Role document and company ingestion

DOCX/PDF/XLSX parsing is browser-side and loaded on demand. Only plain text and structured metadata reach storage, never document HTML or scripts. The role page renders escaped React text. Video embeds are restricted to YouTube privacy-enhanced embeds and Vimeo, with click-to-load UI and CSP host restrictions. Approved and published snapshots are separate from drafts. Candidate invitation email uses the existing configured Resend sender, per-message idempotency and bounded delivery calls. Codes and tokens are never in standard workspace state or mail-status responses.

Company imports are planned deterministically and applied atomically with a company-list version signature. Case-insensitive tags union across repeated rows. Identifier conflicts fail before writes. Lookup uses only a fixed Wikidata endpoint, bounded responses/timeouts and manual redirect rejection. A user confirms the suggested identity before filling missing fields. Revenue includes currency, reporting year where available, and source.

Password changes verify the current credential, limit attempts by user and IP, write a credential-free account event, and atomically update the password and rotate all sessions. No administrator password-change shortcut or password recovery was added.

## Document-only page correction

The former upload handler merged new body sections into old page fields and used search title/client for the hero. The replacement upload handler constructs a fresh document object with no old page or role inputs. PDF geometry/font cues and Word heading/list structure drive formatting; this is deterministic layout extraction, not an external generative model. Every text field on a document-origin page is checked against extracted source text when saved. Publication uses the document's own title/client fields and excludes internal extracted-source text from candidate responses. The previous active/published snapshot remains until an explicit new publication.

`brief-release` saves, approves and publishes a document-origin page within the existing single SQLite transaction; failures roll back all three actions. Preview, Save draft and Publish are visible in the editor's top action bar. Original file binaries are not retained, so earlier uploads require re-uploading. The company importer shares a header-definition module with template validation; a blank, branded XLSX is served as a static app asset.
