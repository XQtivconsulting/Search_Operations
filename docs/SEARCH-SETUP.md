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
