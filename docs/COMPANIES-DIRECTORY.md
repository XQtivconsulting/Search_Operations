# Companies directory

The directory contains Company, Industry, Sector, Subsector, Revenue and Company size, plus row selection for adding companies to a search. Industry uses the candidate industry vocabulary; sector and subsector accept new values. Revenue and employee bands have graduated ranges. Filtering and sorting happen before pagination; default page size is 100. Search strategy embeds the same company records and supports adding/importing linked targets. Existing metadata remains stored.

## Company coverage within a search

Target coverage is the expected candidate count on the search/company target (existing `expected` field). Actual coverage counts distinct partner-approved candidates for that search and company, including direct mappings linked by company ID. It is independent of research-completion status and may exceed target. Unset and zero targets are distinct. Authorized search managers can revise targets; changing an existing target requires a reason and retains the actor, timestamp, versioned event and audit trail. Coverage is available in Target companies and the embedded Search strategy company table.

The Excel template places the six directory attributes first; revenue and company size have validation lists. Optional legacy metadata columns follow, and old headers remain accepted. The import preview uses the new attributes. A linked company logo (website favicon) appears automatically beside company names with a valid stored website; missing websites are not invented. Unavailable logos fall back to a globe. Logo requests use a fixed image provider through the authenticated application endpoint; the browser CSP remains unchanged.

## Actual verification — 4 October 2026

Local TypeScript checks, 259 tests and production builds passed before the coverage deployment. Companies deployment run 37179821888 and coverage deployment run 37179933550 succeeded. Read-only live checks confirmed six Companies columns, 100-row default, name filtering, floating industry dropdown, and distinct Target coverage / Actual coverage columns with existing approved counts. No production records were modified for testing.

The final import/logo update passed TypeScript, all 260 tests and the production build. Deployment run 37180167057 succeeded.

Live verification confirmed the revised import screen; the downloaded live Excel template matched the validated local file byte-for-byte. Existing company records without website URLs do not display logos; external logo availability was not asserted for those records.

## Compact shared company profile

Target Companies and Companies open the same profile from the company name. The profile exposes Company, Industry, Sector, Subsector, Revenue, Company size and Website; legacy metadata is retained in storage but omitted from the editor. The separate Company details action is removed. Research status opens its existing authorized progress editor directly from the status cell.

Opening an editable profile with a missing website triggers a debounced public company lookup. A unique exact-name HTTPS match fills the empty field; ambiguous results require choosing a match. Existing/manual URLs are not overwritten, stale responses are ignored, and unavailable lookups leave manual entry available. Save company persists the filled URL and enables its existing linked logo in both tables. This is profile-time lookup, not a background bulk enrichment of all companies.

Local typecheck, 263 tests and production build passed. Live deployment verification remains pending.
