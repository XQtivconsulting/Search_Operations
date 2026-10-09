# Historical mappings and interviews

Integrations contains **Import mappings** and **Import interviews**, with blank XLSX templates. Both require `integrations.manage`, including server-side authorization. Imports run in the existing tenant transaction, with optimistic preview signatures, research events and audit records. No invitations or messages are sent by either import.

## Researcher records before accounts

Access Management → People and teams → **Add researcher without login** creates a staff record with a required name and optional contact email. No identity account is created. The separate Invite action uses that same staff ID later, preserving work attribution. Creating/editing directory records requires `users.profile`; archiving requires `users.access`. Duplicate researcher names are rejected.

The HTTP mutation route permits these directory-only records. An older blanket retirement restriction was removed; account-linked researcher edits still use the person/account workflow. Regression coverage exercises creation and editing through the Worker HTTP endpoint, not just Workspace methods.

## Mapping import

Skip row excludes the selected row locally without repeating the entire workbook request. It invalidates the preview signature; Import ready rows explicitly excludes unresolved errors and candidate confirmations, obtains a fresh server preview for that selection, and applies only that verified selection. Unresolved rows remain in the screen for correction after a successful import. A Show unresolved rows filter exposes issues across all pages. Failed preview requests retain the table and selections. Non-JSON API responses report HTTP status and Cloudflare request reference when available. A read-only dry run of the supplied 263-row workbook confirmed skip validation; production data was not imported. The reported HTML response was not reproduced locally.

One row per candidate/Search ID, up to 500 rows. Required fields: Search ID, Researcher Name, Mapping Date, First Name and LinkedIn URL. The original Mapped By, Name, Date and LI Link headers are also accepted. Candidate Name and Full Name columns are accepted instead of separate name columns. A full name in First Name with an empty Last Name is also split. The first word becomes First Name and the remaining words become Last Name; Last, First notation is supported. Explicit first and last names are preserved. The preview displays both parsed fields. Single-word names retain a blank last name. When a date is supplied, it must be a full calendar date; yearless dates are rejected. The template uses `yyyy-mmm-dd`.

Researchers resolve by exact normalized staff/member name or ID. Unmatched names are preserved and warned about, with no invented staff identity or performance attribution. Add the researcher before importing and refresh the preview to resolve attribution. Team review is optional. Partner decisions require the original reviewer and date. Historical team decisions can be retained without a reviewer or date; unknown details remain blank. Former reviewers can remain named historical reviewers without an account. Importer identity is stored separately.

Locations are matched against the existing city/state/country catalog on the server. A unique match is standardized automatically. Ambiguous and unmatched names show warnings but do not block importing. The original text is retained in the editable candidate location unless a canonical match is selected. Unresolved text does not create a geography tag. Names can optionally be searched with more detail. A location choice applies to all rows with that original location. Explicitly leaving a location blank preserves the source text in mapping history. New candidate geography tags use the canonical location. Existing populated candidate fields remain unchanged.

Existing candidate matches need confirmation. Missing profile fields can be filled, but populated values are retained. Conflicting identities, duplicate mapping rows and conflicting profile values are flagged. Unreviewed, unsubmitted SharePoint and RecruitCRM links can receive their original sourcing history without changing their ID, integration metadata or engagement/interview records. Other existing mappings receive only missing researcher identity/name and mapping work/submission dates. Existing review decisions, review dates and profile fields remain unchanged. A conflicting researcher or original mapping date blocks that row with saved/file values; it must be corrected or excluded. Repeat imports leave complete matching mappings unchanged. Preview totals account separately for new mappings, existing links to enrich, attribution updates, unchanged rows, skipped/duplicate rows and unresolved rows. Overlapping aggregate output blocks import until reconciled, preventing duplicate performance counts. Submitted/work dates reflect the original mapping date; no effort hours or team memberships are invented.

## Interview import and transition

The supplied SharePoint CSV format is supported directly, including its ListSchema preamble and quoted multiline notes. XLSX uses the Interviews tab. Files support up to 5,000 source rows and 10 MB browser uploads, subject to the existing 8 MB structured API request limit. Preview groups rows by candidate/search and paginates 25 groups per page. Name-only candidate matches require confirmation; a bulk confirmation action covers unique name matches. Ambiguous identities remain unresolved. Candidates must exist first. Searches resolve by Search ID or exact client/job names, with explicit search selection when needed.

Unused Not started rounds are skipped, while recommendation dates survive. Interview status, date, feedback outcome, notes, interviewer, next step/date and partner contact are retained. Positive, Negative, Mixed and Hold remain source feedback labels rather than fabricated pipeline decisions. Unknown historical interview/cancellation/outcome dates are not invented. Recommendation conflicts and conflicting duplicate rounds block the group. The preview allows skipping groups and resolving existing-record conflicts.

Repeat imports store source baselines linked to candidate/search identities. Unchanged source fields never overwrite app edits. Changed source values can update unchanged imported values; changes on both sides require explicit Use file or Keep app/skip. Existing rounds absent from a file are not deleted. Existing engagement stages and search statuses stay unchanged. For a new interview record, an exact source stage label is retained and shown in preview; a missing or unrecognized label requires an explicit initial stage selection. Unknown stage-entry dates stay blank. CSV job status and stage are also retained as source context. New interview-only search links do not create sourcing counts or fabricate partner approval.

**Finish SharePoint transition** closes subsequent imports server-side. Authorized integration users can explicitly reopen imports. App interview editing continues after cutover.

## Verification

Typecheck, 394 automated tests and the production build passed before deployment. New integration tests cover original dates/review identities, optional team review, duplicate/conflicting records, candidate matching, transaction safety, stale previews, permissions, cutover, repeated import protection, aggregate-count overlap, interview-first enrichment and researcher attribution before account creation. Blank XLSX templates were rendered and read back through the app's Excel parser. The supplied CSV was parsed in a read-only local dry run; no customer records or source files are committed or imported into production. Local browser visual testing was unavailable because the installed Playwright runtime has no browser executable. Live deployment is verified separately through Actions and served assets.

### Researcher list correction

The HTTP state response previously removed all staff without an active account, even after a successful researcher-only save. It now preserves directory records and keeps account-derived names/status for linked records. The regression case verifies save, reload, edit, reload and rendering the real no-login researcher table. See TEST-AUDIT-2026-10-08.md for the full test relevance review.

### Cloudflare mapping import correction

The location lookup used a null-prototype dictionary. Cloudflare Durable Object RPC rejects that object type before calling Workspace.research, so mapping previews returned a generic server error even for valid input. Return a plain own-property copy at the RPC boundary. A workerd/Miniflare regression runs the actual Worker research endpoint against a real SQLite Durable Object, resolves Dallas TX, previews and applies a synthetic mapping, checks split names and researcher attribution, then confirms a repeated preview recognizes the existing mapping. The earlier runtime probe reproduced DataCloneError before this fix. No customer workbook was used or imported for this check.

### Optional historical team-review details

Historical team decisions no longer require a reviewer or date. Completely blank team-review fields remain supported. Supplied decisions are preserved without inventing a reviewer or review date; the audit event records the import time when the original review date is unknown, and the UI explicitly labels the review date as not recorded. Partner review requirements remain unchanged. Regression coverage previews and imports an approved partner mapping with an undated, unattributed team decision and checks the stored unknown values.

Unresolved location regression coverage confirms an import can complete with the original text and no fabricated geography tag. Existing populated candidate fields remain protected.

### Companies and later location corrections

Mapping import previews company creation or reuse. Nonblank company names match the master by the existing normalized-name/alias rules; ambiguous aliases block the batch. New names create one shared master per normalized company, and mappings carry that company ID. New candidates and candidates with a compatible missing company link receive the ID; an existing candidate current-company value is never replaced by a historical mapping company. Company writes share the import transaction and audit trail. Repeat imports do not duplicate companies. Import completion reports the number created.

Candidate profile editing now accepts Location and stores corrections without rewriting the original mapping location. Tests cover company alias reuse, duplicate names across rows, repeat imports, ambiguity rollback and correcting an imported location through candidate-save.

### Historical mapping attribution and partial imports (2026-10-08)

Typecheck, all 389 automated tests and the production build passed locally. Regression checks cover RecruitCRM-first enrichment, preserving existing decisions while filling missing attribution, conflicting saved attribution, repeat imports, and excluding unresolved rows from a fresh validated selection. No customer workbook or production data is used by these tests. Deployment verification is separate from local validation.

## Durable mapping batches

Mapping uploads now save a private, tenant-local, owner-scoped batch in SQLite. Resume saved import restores pending rows and choices after navigation, refresh or a failed response. Completed source rows have a durable outcome ledger. Skips and location/candidate choices are saved before further processing; failed saves explicitly report the failure. Existing in-memory previews from older releases cannot be recovered without uploading the source again.

Processing applies at most ten eligible rows per request. Each chunk's business records, audits, outcome ledger and request receipt share the Workspace transaction. Replaying the last request returns saved progress without rewriting records. Stale versions from other tabs are rejected. Transient network/HTTP 502–504 errors receive two bounded retries; further failure pauses processing and offers retrieval of saved progress. Processing pauses when the page is left; this is resumable foreground processing, not a background job. Validation conflicts remain pending and do not overwrite existing history. Location lookup occurs during save/preview, not during chunk execution.

Verification added: synthetic lost-response replay with no duplicate audit events; 13 mappings over two chunks plus a retained invalid row; stale-tab rejection; owner and permission isolation; injected storage failure rolls back mappings and progress together. These checks do not establish the cause of the previously observed production HTTP 503 or constitute a production load test.

Actual local verification for this change: TypeScript passed, all 391 tests passed, and the Vite production build passed (existing bundle-size advisory remains). Production deployment and authenticated UI verification are separate checks.

### Import response-time correction

Saving a new batch or changing a row no longer runs location catalog searches for the whole file. Original location text is retained with a warning; Find location searches only the requested location. Previously verified location choices stay attached to the saved batch. A failed save/process keeps the last confirmed preview visible, marks it stale and disables import until saved progress is reloaded.

Candidate, company and mapping matching now use per-preview indexes. Only candidate/company/mapping records are read for import planning; unrelated research documents and activities are excluded. Batch listings read counts rather than decoding all uploaded workbooks, and saves no longer plan the same workbook twice.

A local synthetic planner benchmark with 263 rows, 10,000 candidates and 5,000 unrelated records measured 3,443 ms before and 41 ms after, with no row errors. This measures planning alone, not production end-to-end latency. The production 503 cause remains unconfirmed because runtime log access was unavailable. Worker observability and structured import timing logs are enabled; logs contain request ID, operation, HTTP status and duration, not source rows or candidate details.

Actual verification: TypeScript, all 392 tests and the production build passed. The new HTTP regression uses 263 rows and asserts that save, skip and resume make zero location-service requests, explicit lookup is scoped, verified selections persist, and injected client location matches are not trusted.
