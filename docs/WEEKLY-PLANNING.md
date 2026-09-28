# Weekly planning

## Operating flow

1. In **Workspace**, add researchers, create named teams, and use **Edit members** to choose each team's roster. Researchers are operating staff records. Invitations separately grant app access and should link researcher accounts to the correct staff record.
2. In **Searches**, expand a search and choose **Set/Edit engagement partner**. The dropdown lists active Admin, Founder and Partner accounts. Ownership belongs to the search and appears in its plan and daily work. Invite missing partners from Workspace.
3. Open **Weekly plan**. The calendar always covers Monday through Sunday; previous/next week and a date picker change the week. Existing Wednesday-based decision dates are grouped into their containing calendar week.
4. Use **By search** to allocate teams against a role, or **By team** to allocate searches against team capacity. Both views show the same assignments. Filters and Find narrow the view; clearing the filter restores the portfolio.
5. Click **+ Assign** in a day, choose the other side of the search/team pair, and edit the full seven-day plan. Check working days, enter daily partner-approved profile targets, and save the week. **Select Mon–Fri** and **Fill selected days** speed repeated target entry. Weekend planning is supported.
6. Click an existing allocation to edit its targets or notes. Uncheck an unstarted day to remove it; recorded counts (including zero), notes and reviews prevent removal. A team can work multiple searches in a day; the grid flags these for capacity review. Daily and weekly totals sum the visible targets; these are team totals, not per-researcher targets.
7. Use **Set/Edit** beside a search's weekly priority to choose Start, Continue, Recalibrate, Pause or Stop and add context. There is one current priority per search/week. Pause/Stop does not silently remove daily assignments—review and remove unstarted allocations separately.
8. Researchers use **Daily work** to log output against the assignments. Reviewers continue through peer and partner approval.

## Data rules

New assignments snapshot the team's current researchers. Later roster edits affect new assignments only; they never move old output between researchers. Existing assignments retain their researcher list when targets change. Automatic individual workload/capacity limits and historical roster scheduling are not implemented.

Seven-day saves are atomic, including audit events. Versions detect concurrent edits to priorities, assignments and rosters. Repeating a create cannot duplicate the same search/team/day. Legacy daily duplicates, if present, are preserved and block editing that pair until reconciled; no output is silently merged.

The old weekly decision log remains intact. An idempotent migration materializes the latest decision for each search/calendar week into a unique current-priority record. Further edits append history and advance the current version.

Candidate breakdown links were optional external URLs to candidate spreadsheets. They are removed from planning. Existing links remain available under a search's **Reference links**; no linked content is imported or synchronized.
