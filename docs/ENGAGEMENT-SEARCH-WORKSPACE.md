# Search-first engagement workspace

Engagement navigation starts at **Engagement searches**: a searchable, sortable list with all/assigned-to-me scope, search status, candidate totals, active work, attention, placed and assigned members. Selecting a search opens its complete candidate workspace in one click. Work Queue remains the daily cross-search prioritization screen; its search links open this same workspace.

Within a search, Candidates and Activity stay together. Candidates defaults to a sortable list with current stage, funnel assignees, next action and stage age. Funnel count buttons, candidate search and attention filters apply equally to List and Kanban. Completed and exited candidates are included by default. A candidate opens a side panel with next action and search-scoped activity; the full profile and existing stage editor are available there. Kanban retains drag-to-editor and optional empty stages. Stage changes still require notes and the existing server-side permissions, sourcing approval and optimistic versions.

Every mapped candidate is visible. Pre-handoff mappings display Awaiting sourcing approval and their sourcing status, without inventing an engagement stage or allowing engagement updates. Reopened mappings retain their actual stage with paused work. Closed searches do not count as active work. Activity includes only candidate-activity records explicitly associated with the selected search, never notes from another search or unscoped candidate notes.

Assignments move out of primary navigation: Manage assignments on the engagement search overview opens the existing global assignment table; Search actions inside a search opens its funnel assignments. Interview tracker remains accessible from the same menu and navigation.

Search selection is a navigation-history boundary. Back/Forward restores search, layout, filters and selected candidate detail. View changes do not save business records.

## Verification

Synthetic tests cover pending, approved, reopened and closed mappings; completed candidates; funnel ownership and attention; search-scoped activity; search history restoration; and server rendering of the workspace. Existing mutation tests continue to cover authorization and version checks. Live verification and deployment evidence are recorded after deployment.

Actual local verification — 5 October 2026: TypeScript typecheck, all 288 tests and the production build passed. Six new synthetic workspace tests cover the cases above. No production records were created or changed during these checks.
