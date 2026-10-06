# Weekly planning

## Operating flow

1. Add roles through RecruitCRM Integrations and set engagement partners there or in Role Repository. Team membership uses accepted researcher accounts managed in People & access and Teams.
2. Weekly Plan opens **Sourcing Decisions**. Review each role's current mapping count (including drafts), current partner-approved count, pending peer/partner reviews, and mappings created in the week before the selected week. The sourcing start uses strategy cutover, falling back to the role start date; weeks elapsed use today. Evidence totals are current, not reconstructed historical snapshots.
3. Record Start, Continue, Recalibrate, Pause or Stop, with optional reasoning. These sourcing decisions are independent of RecruitCRM status. The most recent recorded decision on or before the selected week carries forward unchanged until another decision overrides it. Start remains Start until reviewed; assignments can be copied from the previous week through a reviewed preview.
4. Filter by sourcing decision, or by selected roles/clients. **Show 8-week history** displays decisions across the selected week and seven preceding weeks, marking inherited cells. Week navigation moves that history window. Clicking a cell reviews that specific week. Versions protect both the week's record and the inherited source from stale edits.
5. **Team Allocation** shares the selected decision/status filters with Sourcing Decisions. Allocate a team from a decision row, or use the by-search/by-team calendar. New assignments and moves require an active sourcing decision; undecided, Pause and Stop roles cannot receive new allocation. Existing work and review history are retained.
6. Paused/stopped or undecided roles with future unstarted assignments show a review action. It opens the first affected week. Remove unstarted allocations explicitly; no plan is silently deleted. Targets/notes can still be corrected on existing assignments, but target increases and researcher changes require an active decision. Recorded work always protects researcher attribution and prevents deletion.
7. Use the small plus icon to assign days, then select researchers and targets. Daily targets are team totals. Existing allocation cards open the seven-day editor. Weekend planning is supported.
8. Researchers use My Work for candidate mappings and reviewers use the existing approval flow. Daily Work shows candidate-derived output. Whether the slate is sufficient remains a human decision; no automatic count threshold is applied.

## Data rules

New assignments snapshot the team's current researchers. Later roster edits affect new assignments only; they never move old output between researchers. Existing assignments retain their researcher list when targets change. Automatic individual workload/capacity limits and historical roster scheduling are not implemented.

Seven-day saves are atomic, including audit events. Versions detect concurrent edits to priorities, assignments and rosters. Repeating a create cannot duplicate the same search/team/day. Legacy daily duplicates, if present, are preserved and block editing that pair until reconciled; no output is silently merged.

The old weekly decision log remains intact. An idempotent migration materializes the latest decision for each search/calendar week into a unique current-priority record. Further edits append history and advance the current version.

Candidate breakdown links were optional external URLs to candidate spreadsheets. They are removed from planning. Existing links remain available under a search's **Reference links**; no linked content is imported or synchronized.

## Move or unassign

Click **Move / unassign** on an allocation, or open its editor and choose **Move / unassign this week’s assignments**. Select one or several unstarted days, then choose **Move to another team** and the destination, or **Unassign selected days**. Moving preserves dates, targets and notes and snapshots the destination roster. Recorded candidate work, counts (including zero), notes or reviews protect a day from removal or transfer. A conflicting destination allocation is rejected without merging targets. The operation is atomic and version checked. Company ownership is separately managed in the role’s Target companies.

## Select individual researchers

Open a role/team allocation in Weekly Assignment. Each working day has Researcher checkboxes; select one or more members of that team and Save week. New plans initially select the team roster. Unstarted allocations can change researchers; recorded work protects the allocation. Daily targets remain team totals. Candidate mappings independently store actual mapper account, staff ID, team, role and review history; plan changes never rewrite mapping attribution. Role Candidate mappings displays Mapped by / team, and submitted/approved work drives researcher/team/role metrics.

## Delivery Monitor

Sourcing Monitor has two views: **Sourcing progress** and **Candidate reviews**. Progress has one row per search/team across all recorded work, including unassigned mappings and searches without allocations. Search and team filters apply to all counts. The mapping-period filter changes only Mapped in selected period.

Approval target · total plan sums all planned daily targets, including future allocations; missing targets remain explicit. Mapped · total to date includes all statuses, including drafts and imported records. Mapped · selected period uses the mapping creation date in US Eastern time, falling back to work date for legacy records. Awaiting review · total includes current Peer review and Partner review mappings. Approved · total to date includes mappings currently Approved regardless of creation or approval date. These are current totals, not historical snapshots or approval events counted by date. Counts open the exact contributing mappings.

Candidate reviews includes all outstanding team/partner reviews, Needs information and Hold, with explicit status filtering. The unlabeled queue count was removed from the tab. Adjust allocation retains its planner/admin authorization and opens the selected mapping-period week. No underlying work attribution, review permissions or audit records change.

Weekly sourcing decisions render as information with a colored dot, separated from the reviewed date. A pencil icon edits the decision. Allocate team is a primary action. Candidate mapping detail displays review status once, distinguishes researcher notes from the weighted fit score, and shows an enabled Review candidate action only when the current user is eligible. Existing free-text notes are preserved verbatim.

Local verification, 5 October 2026: typecheck, 292 tests and build passed. Added tests cover cross-period totals, drafts/imported/rejected mappings, US Eastern date boundaries, team isolation, future plan targets and unassigned/empty searches. Live verification follows deployment.

## PTO and automatic effort

Open PTO calendar in the Weekly plan toolbar. Rows show team members and columns show the seven days of the selected week. Select a day to toggle PTO. Individuals manage their own linked staff record; admins and super admins manage all active staff. Other users can view the calendar. Week navigation and member search are available inside the popup. PTO contributes zero person-days across all searches. The team target remains unchanged so planners can review capacity. Allocation cards and My Work indicate PTO. Performance defaults to the planned researcher/day split; no daily confirmation is needed. See PERFORMANCE.md for calculation details.

## Search tasks and team identity

Search tasks appears only in Team Allocation, scoped to the week, search/status/decision and team filters. Planners assign Research, JD, Competency map, Keyword guidance, Pitch document, Target company identification, Alignment profiles, Status report template and cadence, or Other to an active team researcher on a date, with a deliverable and notes. Assignees see these in My Work and update their status; planners can reassign/edit. Brief assignees may upload originals; strategy assignees may save drafts but cannot approve/publish through that assignment. Tasks can be planned before sourcing starts. Past/today non-cancelled tasks contribute to planned person-days, deduplicated with sourcing allocations by person/date/search/team and subject to PTO. There are no additional effort forms.

Team allocation uses a colored team marker alongside the sourcing-decision background, preserving Start/Continue/Pause decision colors. Red/Blue/Green/Tiger/Elephant use distinct recognizable colors. Future Start decisions appear as Scheduled to start week of [date] in Sourcing Decisions' Next step.

## Compact weekly workspace (October 2026)

Plan week and PTO calendar sit alongside the two view tabs. Permanent training legends, CRM status, and explanatory banners were removed from the main workspace. The combined Needs sourcing filter is removed; individual sourcing decisions and allocation validation remain unchanged.

Mapped, Partner approved, Awaiting review, and Mapped last week open sortable candidate lists using the same predicates as the displayed counts. Candidate names open full profiles, with LinkedIn icons alongside them. Last-week boundaries use US Eastern dates.

Local verification: typecheck, production build, and all 290 tests passed. Synthetic tests exercise PTO ownership/admin permissions, version conflicts and audit records, plus evidence count/drilldown parity and week boundaries. Live verification is recorded separately after deployment.

Live verification, 5 October 2026: release f8b250e deployed successfully in workflow run 37372197105, retry job 111973974701. Verified the compact weekly toolbar, removed Needs sourcing option and CRM line, two-record Awaiting review drilldown, seven-day PTO popup, aligned repository toolbar, and collapsed navigation label on keyboard focus. PTO and candidate data were not mutated during live checks. The initial attempt was cancelled while waiting for a hosted runner; the retry passed every deployment step.

## Plan-aware sourcing monitor — 5 October 2026

Sourcing progress now distinguishes Behind plan, On track, In progress, Scheduled and missing dated targets. Red attention is the positive difference between targets on completed dates (strictly before today in US Eastern) and current approved mappings for the same search/team. Today and future targets are not overdue. Waiting reviews alone do not trigger attention. Past allocations missing targets are amber because plan progress cannot be fully assessed. Needs attention filters only shortfalls and these missing past targets.

Person-days to date and in the reporting period use the shared effective-effort calculation: splits across all assignments before search/team filtering, PTO excluded, historical corrections honored and future days excluded. Today's allocation is a full planned day, not measured actual time. Each count opens date/researcher/day/basis details.

Monitor actions use immediate, focus-accessible portal tooltips and fixed compact columns. Candidate review/drilldown tables align a small LinkedIn icon before every name and use a View mapping icon.

Local verification: typecheck, 296 tests and production build passed. Added regression coverage for future/today/completed-day targets, pending reviews without delay, caught-up approvals, missing targets, effort splitting, PTO and manual corrections. Live verification follows deployment.

Actual live verification: release 0acf6e39f519dc717282dbf57b4970cde7646d09 deployed successfully in run 37379232186 (job 111996534871). Verified red approved/due/shortfall display, total and period effort, and an allocation popup whose rows reconcile to 2.5 days. The progress action column measured 68px and review action column 52px. Custom tooltip appeared immediately on keyboard focus. Five inspected LinkedIn icons aligned at the same horizontal coordinate, each 13px; the View mapping icon opened the correct candidate and returned to the monitor. No business data was changed.

## Search identity and planning review — 6 October 2026
- Search ID is a positive unique integer separate from the internal key and RecruitCRM ID. Existing unnumbered searches remain unnumbered until reviewed in Integrations. The import grid permits explicit IDs and numbering selected unnumbered rows in ascending CRM-ID order, with a starting number. All CRM statuses remain selectable; no historical jobs are dropped by the planning Open filter.
- New records automatically receive the next number above the workspace high-water mark. Deleted numbers are not recycled. Manual import numbers reserve their range before automatic numbering. Refreshes preserve IDs, references, plans and reviews.
- Weekly Plan defaults to Open and supports combined multi-select Sourcing decisions, Search status, Searches and (in team view) Teams. Both planning tables expose sortable Search ID and status. Unknown source statuses remain available.
- Copy previous week previews eligible allocations within current filters. It carries day/team/researcher/target/notes to the matching weekday, skips occupied destinations and past days, and requires an Open search with active sourcing. PTO and departed team members are excluded. The write is atomic, permission checked and revalidates source versions, rosters, decisions and destination state. Completed tasks and outputs are not copied.
- Existing setup-task names retain compatibility. New JD assignments permit document upload; Competency map and Keyword guidance assignments permit edits only to their respective sections. Approval permissions remain unchanged.

Verification: synthetic tests added for number uniqueness/high-water behavior, CRM refresh preservation, duplicate import rollback, filter intersections, carryover exclusions and stale/unauthorized copies, and task permission boundaries. Typecheck, full tests and build are deployment gates; actual workflow result is reported after completion. No production historical import or signed-in browser check has been performed for this change.
