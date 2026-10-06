# Target-company action labels — 5 October 2026

The Target companies table uses one shared row-action renderer:
- Person plus: **Add candidates**. Opens candidate mapping with this search and target company.
- Person check: **Assign to me**. Claims an unassigned company for the current researcher, selecting a team when necessary.
- Two people: **Manage assignment**. Opens the same team-and-researcher assignment form for both assigned and unassigned companies.

The management action formerly changed its tooltip between “Change assignment” and “Assign researcher”; this was a label difference, not a different operation. Tooltip and dialog now share a single label. Accessible button names include the company. All three buttons disable while a save is underway. Existing eligibility, fixed action positions, server permissions and audit behavior remain unchanged.

Talent assets navigation icons use a muted orange-brown (#9c6444), consistently expanded and collapsed.

Verification performed before commit: inspected the supplied screenshot, shared row renderer, IconAction tooltip/accessibility component and backend target-assign/company-claim handlers. Confirmed each icon dispatches its own intended action. Typecheck, full tests and production build are required by the deployment workflow before Wrangler runs; inspect that run for the actual result. No signed-in browser or mobile-device verification was performed.
