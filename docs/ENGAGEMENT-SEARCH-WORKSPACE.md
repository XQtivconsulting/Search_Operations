# Search-first engagement workspace

Engagement navigation starts at **Engagement searches**: a searchable, sortable list with all/assigned-to-me scope, search status, candidate totals, active work, attention, placed and assigned members. Selecting a search opens its complete candidate workspace in one click. Work Queue remains the daily cross-search prioritization screen; its search links open this same workspace.

Within a search, Candidates and Activity stay together. Candidates defaults to a sortable list with current stage, funnel assignees, next action and stage age. Funnel count buttons, candidate search and attention filters apply equally to List and Kanban. Completed and exited candidates are included by default. A candidate opens a side panel with next action and search-scoped activity; the full profile and existing stage editor are available there. Kanban retains drag-to-editor and optional empty stages. Stage changes still require notes and the existing server-side permissions, sourcing approval and optimistic versions.

Every mapped candidate is visible. Pre-handoff mappings display Awaiting sourcing approval and their sourcing status, without inventing an engagement stage or allowing engagement updates. Reopened mappings retain their actual stage with paused work. Closed searches do not count as active work. Activity includes only candidate-activity records explicitly associated with the selected search, never notes from another search or unscoped candidate notes.

Assignments move out of primary navigation: Manage assignments on the engagement search overview opens the existing global assignment table; Search actions inside a search opens its funnel assignments. Interview tracker remains accessible from the same menu and navigation.

Search selection is a navigation-history boundary. Back/Forward restores search, layout, filters and selected candidate detail. View changes do not save business records.

## Verification

Synthetic tests cover pending, approved, reopened and closed mappings; completed candidates; funnel ownership and attention; search-scoped activity; search history restoration; and server rendering of the workspace. Existing mutation tests continue to cover authorization and version checks. Live verification and deployment evidence are recorded after deployment.

Actual local verification — 5 October 2026: TypeScript typecheck, all 288 tests and the production build passed. Six new synthetic workspace tests cover the cases above. No production records were created or changed during these checks.

Deployment run 37332708004 succeeded for source fe7b5c878aedc4205193e3614d16a63a2eb7c604 (typecheck, 288 tests, build, backup-storage connection and Cloudflare deployment). Live read-only verification confirmed the search overview, full candidate list, sourcing-pending detail without an edit action, approved candidate detail with the existing stage editor (cancelled without saving), search activity, contextual funnel assignments, and Back/Forward restoration of Activity, Kanban and funnel filters. A visual follow-up constrains long candidate titles to preserve table column alignment and uses search names in navigation destinations. No production records changed.

Final release — source 50717b1ab1a37f8ecdf4e5ec2ce903f327fe1568, deployment run 37333429215: all deployment gates succeeded. After refreshing the live app, confirmed the compact candidate table displays all six columns without horizontal table scrolling at the inspected desktop viewport, long titles wrap, and Candidate header sorting reports ascending. Work Queue search links open the complete candidate workspace. These were read-only checks; the stage editor was cancelled and no production records changed.

## Dashboard drilldowns and recommendation filter — 5 October 2026

The display name is now Engagement dashboard. Each search's Candidates, Active, Needs attention and Placed count opens that same search's candidate list with the corresponding filter; switching to Kanban preserves it. Counts use the same row predicates as their drilldowns, including sourcing-pending, paused and closed-search behavior. Active only is an explicit removable filter. Attention shows elapsed days in stage and the configured threshold. Opening another search resets drilldown filters.

Within the workspace, the page title is the search name. The redundant inner title and client/status/partner detail line are removed. The dashboard return link and navigation use the new display name.

Interview tracker's inclusion checkbox now adds only stage ID shortlist (To be recommended), rather than all engagement rows. Existing recommended/interview-history rows remain included. Local verification: typecheck and all 289 tests passed, including the added regression for shortlist versus outreach/screening. Production build also passed. Deployment remains a separate check.

## Compact cards and assignments — 5 October 2026

Kanban cards share candidate name/title spacing with the list, with LinkedIn and activity icons at the upper right. Next action and assigned members remain in candidate detail, not on cards. The redundant filtered/total candidate sentence is removed. Stage columns use the available board height and scroll independently, with compact card spacing.

The assignment table exposes View assigned funnels and Assign funnels directly. The redundant View assignments action and assignment guidance paragraph are removed. Member checkboxes sit next to their names in compact rows. The Engagement members header sorts member choices alphabetically within every funnel; Funnel group sorts the funnel rows. Sorting does not change selections. Work Queue no longer has an Engagement Assignments shortcut.

Local verification: typecheck, all 290 tests and production build passed. No business rules, mutation APIs or permissions changed. Live UI and deployment checks are recorded separately.

Live checks of release 753ff795: deployment run 37373996128 passed every step. Confirmed direct assignment actions, compact checkbox rows, member names reversing on header click, absence of the Work Queue assignment shortcut, and compact Kanban content. No selections or business records were saved. Visual inspection caught a shared button rule shrinking the activity icon; a scoped CSS correction restores its 16px icon and removes the extra heading height.

Final live verification: source c9e6748, workflow run 37374461364 and job 111979411253 completed successfully. The activity icon renders at 16×16px and opens the correct candidate's search-scoped activity; name/title spacing and full-height stage columns were visually checked. All 290 tests, typecheck and build passed again. Live inspection was read-only; no assignment or candidate changes were saved.

Selected searches now start directly with funnel counts and candidate controls. Removed the duplicate dashboard link, search selector, search actions and Candidates/Activity tabs. Candidate activity remains available from each candidate. Persisted Activity-tab state no longer hides the candidate view.

Live verification of f0ece557 (run 37375994279, all deployment steps successful): selected search starts with funnel controls; the master candidate table renders 13px LinkedIn icons at the same horizontal position in each inspected row. Sourcing count drilldown opened the matching pending candidates; Rahul Raj's detail showed one Partner review status, researcher notes and a single weighted fit score. No production records changed.

Follow-up UI: bold client names in weekly decisions and search names in dashboard/work queue. Removed permanent engagement instructions and the Work Queue narration/date line. Nonzero Due today/Overdue counts use Interview Tracker red styling; New today uses its green styling, in both summaries and table cells. Zero counts remain neutral.

Release 3ef37742 deployed successfully in run 37376524609. Live read-only checks confirmed the removed dashboard/queue instructions, bold search markup, red Due today and green New today summaries, with neutral zero counts.
