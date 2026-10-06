# Search setup and candidate assignment

## Behavior

- Candidate Age and Gender are top-level dropdown filters, not directory columns. Age ranges use recorded age; no seniority inference is made.
- Company profile Industry → Sector → Subsector selectors cascade using saved company classifications. Changing a parent clears children. Missing values can be added by typing and are reused after save. The shared company form retains the agreed fields and website lookup.
- Planners can create a search directly in Search repository. A generated LOCAL reference distinguishes it from RecruitCRM jobs. New searches open on Search strategy and share the normal sourcing and engagement workflow. An engagement partner can be assigned now or later; submission requires an active partner.
- Search strategy has inline draft editing, optional fit criteria, a separate approval action and direct target/mapping navigation. A short company-and-keyword approach is valid. Saving a draft does not approve it; existing approved content remains active until replaced. Repository tabs persist when navigating away and back.
- Clone target companies previews the source companies, expected coverage and waves. It requires destination management permission and a current source version signature. Existing destination companies are skipped without overwriting coverage. New targets start unassigned and Not started; no candidates, actual coverage or research progress are copied.
- Candidate assignment creates target companies even for Draft mappings, without requiring coverage or a strategy. Existing company names/aliases reuse their master record. New companies get a master record. Team/researcher allocation is separate from assignment.
- A one-time transaction repairs preexisting Draft mappings lacking target links. It resolves the candidate's current company, creates or reuses targets and records audit events. It does not change approved mappings, allocate researchers or set coverage. Blank company names cannot be repaired automatically.
- Fit editing is disabled until a strategy exists. Team submission still requires an approved strategy and the candidate tracking start date, fit rationale and required evidence.

## Performance change

Record-only operations no longer load the full research event history. Candidate matching and mapped-candidate checks use maps/sets. Directory assignment links candidates in batches of 100, rather than repeating a full research load for each candidate. A synthetic 105-candidate test asserts zero research-event history reads and at most three full record reads during assignment. This is a query-count regression check, not a production latency benchmark; state refresh still loads workspace records and history.

## Local verification — 4 October 2026

TypeScript, all 270 synthetic tests and production build passed. Tests cover demographic boundaries, cascading options, local search permissions/identity, draft target creation, strategy prerequisites, clone authorization/conflicts/destination preservation, existing-draft repair and batched read counts. No business data or credentials are included in fixtures. Live deployment verification is recorded separately after release.

## Repository walkthrough follow-up

Search pages show only the search title. Search selection/status/actions move into a side drawer after selection; the landing view retains status and assigned-to-me filtering. Candidates replaces Candidate mappings in the repository tabs, with My mappings / All candidates; filters only apply in All candidates and live in a side drawer, including multi-select Mapped by. LinkedIn links sit beside candidate names. My target companies uses explicit researcher ownership, independently of mapping ownership.

Add candidates now opens a modal from either the candidate list or a target-company row. The target company and team are carried into the entry; server checks reject another researcher's target and existing candidates from a different current company. Saving shows the new draft at the top. Candidate Back returns to the originating view. Search/tab/filter/pagination state is retained, and browser Back/Forward participates in app navigation with unsaved-change protection.

Coverage remains manually set (Not started, In progress, Need help, Completed). A manual mismatch flag, Need help, or a completed target with differing planned/approved counts creates a red partner attention item in the repository and workflow summary. In-progress targets are not flagged merely because coverage is unfinished. My Work redesign is deferred.

The initial setup release `93cd91ea57b4b47dbddcf92fb0eb19d7b941b57a` deployed successfully in workflow `37212677658`. Follow-up local verification: TypeScript, 275 synthetic tests and production build passed. Browser verification of the follow-up is recorded after deployment.

Follow-up release `f7a576ab661a55898f7c6683abebc6094bffd9ca` deployed successfully in workflow `37213288205`. Live read-only checks confirmed: quiet search header; side search controls; hidden candidate filters with Mapped by; My mappings without filters; candidate profile return and browser Back restoring the same search and name filter; personal target-company view; Accenture website icon; and the Add candidates modal prefilled with its target company. A live-discovered candidate/company filter overlap was corrected by giving target companies a separate persisted filter. All 275 tests, typecheck and production build pass after that correction. No QA candidates, clones, searches or review decisions were saved.

Final correction `2452784ea39e25b03cb109080fd0e6e79b57abf7` deployed successfully in workflow `37213643184`. Live verification confirmed that a candidate-name filter stays on Candidates while Target companies retains an empty independent filter and shows its company rows. Manual coverage controls expose Need help and the partner mismatch flag. Company profile layout was visually checked. No test records were saved.

## October 4: repository, tables, candidate identity and navigation polish

- Repository landing uses a searchable, sortable search table with compact status/scope controls and a normal-size New search action. Search tabs share a navigation row; target-company operations are grouped in Company actions. Active personal/all views have a strong selected state. Candidate sorting, including total fit and individual criteria, is visible outside the filter drawer in both views.
- Shared data-table headers sort numeric/text/date values. Complete rows are sorted before page slicing for CRM import previews, My Work mappings, work-queue candidates and candidate search history. Existing directory/repository sorting remains data-driven before pagination. Existing planning/calendar and grouped grids retain their specialized sorting; the spreadsheet paste editor retains physical row order so paste/keyboard coordinates remain correct. Table type, alignment and compact links are consistent in pages and dialogs.
- Clone search, candidate entry/import and company destination selectors reuse the searchable search picker. Its dropdown has sufficient width for readable search names.
- Engagement Assignments has search across search/client/partner/member, compact rows and sortable headers. Per-funnel details are available through View assignments and View assigned funnels; edit permissions remain unchanged.
- LinkedIn identity normalization is shared by client, directory saves, inline mappings and imports: missing scheme, HTTP/HTTPS, www/mobile hostname, case, surrounding/embedded whitespace, tracking and trailing slash resolve to the same account. Invalid hosts/credentials/paths are rejected. Exact matches reuse the existing candidate; similar name/account suggestions require an explicit different-person acknowledgment in entry forms. No fuzzy auto-merging or historical deletion occurs.
- LinkedIn profile links use an accessible icon beside candidate names, including directory/profile, mapping/review, pipeline/work queue and import preview. Input labels remain explicit. Single-team entry auto-selects; multi-team membership requires a team choice.
- Navigation snapshots now include directory/weekly-plan/pipeline/tracker/table view choices, with remount on history restoration. Browser history snapshots survive refresh for the same signed-in workspace/account, restore destinations without recording intermediate renders, and guard concurrent Back/Forward requests. Labels identify the actual search/tab or candidate. Sidebar Candidates opens the directory; Search repository opens its search list.

Local verification: typecheck passed; 282 tests passed, including normalization/security, server reuse across entry/import, similar-profile suggestions, numeric sorting across three pages, single/multiple team behavior, and repeated navigation snapshot round trips. Production build passed. Deployment and browser interaction verification are recorded separately after release. All fixtures are synthetic; no production mutations were used for testing.

Production verification for `317375c0b2d6341567001185a354db8621cb699b`: GitHub Actions run `37221040756` succeeded, including typecheck, tests, build, private backup-storage connection and Cloudflare deploy. On the deployed app, verified readable aligned target table, ascending/descending company header sort, strong active view styling, compact grouped company actions, visible fit sort, filtered repository table, name duplicate suggestions and scheme-free/space-padded exact LinkedIn recognition. Existing mapped candidates were correctly blocked from duplicate mapping. Clone-source search narrowed to the typed search name. Engagement assignment search and both read-only detail dialogs worked. App Back/Forward restored weekly date plus allocation view and candidate fit sort; history survived refresh. Native browser Back/Forward restored the assignment query. All browser checks were read-only or discarded unsaved entry; no candidates, mappings, assignments or coverage records were changed.

Follow-up: make repository landing destinations read simply Search repository and persist candidate-profile section, scope and page in navigation snapshots. Assessment/note links pointing to LinkedIn also use the shared icon. Local typecheck, all 282 tests and production build passed again; live profile-section verification follows deployment.

Final production source `2b64daec925f839b05df56f05d6893fb76eec682` deployed successfully in GitHub Actions run `37221489788`; all validation and deploy steps succeeded. After reloading the deployed app, opened a candidate's Searches section, followed a linked search, and used app Back: the same candidate and active Searches section were restored. Forward named the correct search and Candidates tab. Returned the live UI to the compact repository table. No production data mutations were performed.

## Local ownership and Excel migration

Search settings lets a planner explicitly take over an imported search. Its RecruitCRM identifier remains for provenance and candidate imports, but search refresh/import no longer overwrites its local name, client or status. Local searches support Open, On Hold, Closed, Abandoned and Canceled.

Integrations has All searches, Import searches and Import candidates by search tabs. The all-sources register includes historical/closed searches and lets admins assign unique XQtiv Search IDs, with optimistic versions and atomic swaps.

Both Excel entry points download `public/templates/xqtiv-search-candidate-import.xlsx`. Searches and Candidates sheets share XQtiv Search ID. Candidate-only uploads remain supported in Candidates. A combined import previews all rows and commits transactionally; existing profiles and mappings are reused, existing searches are preserved. Imported mappings are drafts attributed to the importing researcher. Historical reviews, dates and engagement stages are not fabricated. Existing admin, data-quality and researcher permissions apply.

People & teams combines People & access, Sourcing teams and Engagement teams. Only admins can access account management; team planning permissions are unchanged. Both team directories are searchable and sortable, with sourcing leads edited alongside the roster.

## Candidate executive summaries

Candidate Overview shows the published Executive summary above Searches. Editors can paste a transcript, upload TXT/DOCX/text-based PDF, or select stored resumes/transcripts. The newest resume is selected initially. Pasted transcripts are retained as candidate documents; full source text is not duplicated in the workspace-state draft. Combined source text is limited to 200,000 characters.

Draft creation uses local source excerpts and explicit standardized tag matches, not a generative AI service. Each suggestion carries evidence. Geography, compensation and demographic attributes are not inferred. Drafts do not update the public profile fields. An authorized candidate editor reviews/edits the summary and explicitly selects tags before Approve & publish. Existing tags are retained by default. Publication updates summary and tags atomically, records the reviewer and source documents, and rejects stale candidate/draft versions or repeat publication. Scanned PDF and audio require text extraction/transcription first.

Verification: 328 local tests passed, including shared workbook parsing, import rollback, summary draft isolation, permission checks, stale versions and evidence-backed suggestions. The People & teams/import deployment (753fa721) succeeded and was checked read-only in the live browser. No production records were created for tests.
