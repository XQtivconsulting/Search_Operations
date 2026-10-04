# Companies directory

The directory contains Company, Industry, Sector, Subsector, Revenue and Company size, plus row selection for adding companies to a search. Industry uses the candidate industry vocabulary; sector and subsector accept new values. Revenue and employee bands have graduated ranges. Filtering and sorting happen before pagination; default page size is 100. Search strategy embeds the same company records and supports adding/importing linked targets. Existing metadata remains stored.

## Company coverage within a search

Target coverage is the expected candidate count on the search/company target (existing `expected` field). Actual coverage counts distinct partner-approved candidates for that search and company, including direct mappings linked by company ID. It is independent of research-completion status and may exceed target. Unset and zero targets are distinct. Authorized search managers can revise targets; changing an existing target requires a reason and retains the actor, timestamp, versioned event and audit trail. Coverage is available in Target companies and the embedded Search strategy company table.

The Excel template places the six directory attributes first; revenue and company size have validation lists. Optional legacy metadata columns follow, and old headers remain accepted. The import preview uses the new attributes. A website icon appears automatically beside company names with a valid stored website; missing websites are not invented.

## Actual verification — 4 October 2026

Local TypeScript checks, 259 tests and production builds passed before the coverage deployment. Companies deployment run 37179821888 and coverage deployment run 37179933550 succeeded. Read-only live checks confirmed six Companies columns, 100-row default, name filtering, floating industry dropdown, and distinct Target coverage / Actual coverage columns with existing approved counts. No production records were modified for testing.

The final import/icon update is undergoing deployment verification; final results are recorded below when complete.
