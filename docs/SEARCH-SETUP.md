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
