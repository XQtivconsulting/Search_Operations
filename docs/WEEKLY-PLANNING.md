# Weekly planning

## Operating flow

1. Add roles through RecruitCRM Integrations and set engagement partners there or in Role Repository. Team membership uses accepted researcher accounts managed in People & access and Teams.
2. Weekly Plan opens **Search Decisions**. Review each role's current mapping count (including drafts), current partner-approved count, pending peer/partner reviews, and mappings created in the week before the selected week. The sourcing start uses strategy cutover, falling back to the role start date; weeks elapsed use today. Evidence totals are current, not reconstructed historical snapshots.
3. Record Start, Continue, Recalibrate, Pause or Stop, with optional reasoning. These sourcing decisions are independent of RecruitCRM status. The most recent recorded decision on or before the selected week carries forward unchanged until another decision overrides it. Start remains Start until reviewed; assignments are never copied automatically.
4. Filter by sourcing decision, or by selected roles/clients. **Show 8-week history** displays decisions across the selected week and seven preceding weeks, marking inherited cells. Week navigation moves that history window. Clicking a cell reviews that specific week. Versions protect both the week's record and the inherited source from stale edits.
5. **Team Allocation** defaults to Start, Continue and Recalibrate. Allocate a team from a decision row, or use the by-search/by-team calendar. New assignments and moves require an active sourcing decision; undecided, Pause and Stop roles cannot receive new allocation. Existing work and review history are retained.
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
