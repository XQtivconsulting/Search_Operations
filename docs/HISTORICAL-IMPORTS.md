# Historical mappings and interviews

Integrations contains **Import mappings** and **Import interviews**, with blank XLSX templates. Both require `integrations.manage`, including server-side authorization. Imports run in the existing tenant transaction, with optimistic preview signatures, research events and audit records. No invitations or messages are sent by either import.

## Researcher records before accounts

Access Management → People and teams → **Add researcher without login** creates a staff record with a required name and optional contact email. No identity account is created. The separate Invite action uses that same staff ID later, preserving work attribution. Creating/editing directory records requires `users.profile`; archiving requires `users.access`. Duplicate researcher names are rejected.

The HTTP mutation route permits these directory-only records. An older blanket retirement restriction was removed; account-linked researcher edits still use the person/account workflow. Regression coverage exercises creation and editing through the Worker HTTP endpoint, not just Workspace methods.

## Mapping import

One row per candidate/Search ID, up to 500 rows. Required fields: Search ID, Researcher Name, Mapping Date, First Name and LinkedIn URL. The original Mapped By, Name, Date and LI Link headers are also accepted. Candidate Name and Full Name columns are accepted instead of separate name columns. A full name in First Name with an empty Last Name is also split. The first word becomes First Name and the remaining words become Last Name; Last, First notation is supported. Explicit first and last names are preserved. The preview displays both parsed fields. Single-word names retain a blank last name. Full calendar dates are required; yearless dates are rejected. The template uses `yyyy-mmm-dd`.

Researchers resolve by exact normalized staff/member name or ID. Unmatched names are preserved and warned about, with no invented staff identity or performance attribution. Add the researcher before importing and refresh the preview to resolve attribution. Team review is optional. Recorded team/partner decisions require the original reviewer and date. Former reviewers can remain named historical reviewers without an account. Importer identity is stored separately.

Locations are matched against the existing city/state/country catalog on the server. A unique match is standardized automatically. Ambiguous names require a selection in preview, and unmatched names can be searched with more detail. A location choice applies to all rows with that original location. Explicitly leaving a location blank preserves the source text in mapping history. New candidate geography tags use the canonical location. Existing populated candidate fields remain unchanged.

Existing candidate matches need confirmation. Missing profile fields can be filled, but populated values are retained. Conflicting identities, duplicate mapping rows and conflicting profile values are flagged. Existing mappings are left unchanged, except interview-only SharePoint links can receive their original sourcing history without changing their ID or interviews. Overlapping aggregate output blocks import until reconciled, preventing duplicate performance counts. Submitted/work dates reflect the original mapping date; no effort hours or team memberships are invented.

## Interview import and transition

The supplied SharePoint CSV format is supported directly, including its ListSchema preamble and quoted multiline notes. XLSX uses the Interviews tab. Files support up to 5,000 source rows and 10 MB browser uploads, subject to the existing 8 MB structured API request limit. Preview groups rows by candidate/search and paginates 25 groups per page. Name-only candidate matches require confirmation; a bulk confirmation action covers unique name matches. Ambiguous identities remain unresolved. Candidates must exist first. Searches resolve by Search ID or exact client/job names, with explicit search selection when needed.

Unused Not started rounds are skipped, while recommendation dates survive. Interview status, date, feedback outcome, notes, interviewer, next step/date and partner contact are retained. Positive, Negative, Mixed and Hold remain source feedback labels rather than fabricated pipeline decisions. Unknown historical interview/cancellation/outcome dates are not invented. Recommendation conflicts and conflicting duplicate rounds block the group. The preview allows skipping groups and resolving existing-record conflicts.

Repeat imports store source baselines linked to candidate/search identities. Unchanged source fields never overwrite app edits. Changed source values can update unchanged imported values; changes on both sides require explicit Use file or Keep app/skip. Existing rounds absent from a file are not deleted. Existing engagement stages and search statuses stay unchanged. For a new interview record, an exact source stage label is retained and shown in preview; a missing or unrecognized label requires an explicit initial stage selection. Unknown stage-entry dates stay blank. CSV job status and stage are also retained as source context. New interview-only search links do not create sourcing counts or fabricate partner approval.

**Finish SharePoint transition** closes subsequent imports server-side. Authorized integration users can explicitly reopen imports. App interview editing continues after cutover.

## Verification

Typecheck, 394 automated tests and the production build passed before deployment. New integration tests cover original dates/review identities, optional team review, duplicate/conflicting records, candidate matching, transaction safety, stale previews, permissions, cutover, repeated import protection, aggregate-count overlap, interview-first enrichment and researcher attribution before account creation. Blank XLSX templates were rendered and read back through the app's Excel parser. The supplied CSV was parsed in a read-only local dry run; no customer records or source files are committed or imported into production. Local browser visual testing was unavailable because the installed Playwright runtime has no browser executable. Live deployment is verified separately through Actions and served assets.
