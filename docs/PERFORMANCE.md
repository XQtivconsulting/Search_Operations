# Performance

## Views

Researcher performance compares researchers or teams, with role/client multi-selection and date/team filters. Expand a row for per-search results. The optional matrix shows a single metric across searches and people/teams; CSV exports the currently selected comparison rows. Quality always includes its final-decision sample size, and pending review counts stay separate.

Search effort & yield displays age, effective sourcing decision, confirmed person-days, mappings, approvals and approvals/person-day. Expand a search for days since first submitted mapping, distinct active sourcing days, estimated hours, mappings per active date, approval/all-mappings ratio, researcher contribution shares, results by work date, and company coverage. This week-to-date versus last full week is explicitly labeled and uses current outcomes for those mapping cohorts. The decision link opens Search Decisions for that role.

## Definitions

- Mapped: submitted mappings attributed to their work date; drafts excluded.
- Quality: Approved / (Approved + Rejected). Final peer rejection counts as a rejection. Pending, Hold and Needs information do not enter the denominator. Reopening changes the current final-decision sample; immutable research events are preserved.
- Approval/all-mappings ratio: approved / all submitted mappings, including pending work. This is distinct from quality and is shown in search details.
- Throughput: submitted mappings / confirmed person-days.
- Approved/day: approved mappings / confirmed person-days.
- Contribution share: a person's mappings or approvals divided by the selected search's total; this is not quality.
- Team results use pooled counts and effort, never averages of individual percentages.
- Search age: calendar days since recorded search start, including paused time. This is not historical active time or time to close. Missing start dates stay unknown.
- Days since first mapping: elapsed calendar days since earliest submitted mapping's work date, independent of period selection.
- Active sourcing days: distinct dates with positive confirmed effort or submitted output; not sessions. Hours are estimated as person-days × 8.

## Confirmed effort

`effort_days` stores a staff/date optimistic version; `effort_records` stores per-search/team fractions for that date. My Work offers suggestions from assignments/mappings, but does not persist them until the researcher confirms. A researcher can confirm only their own assigned/owned research; planners/admins can correct effort through Performance. Zero-output work can record positive effort; skipped assignments can be confirmed as zero. Two-decimal fractions are supported, totaling at most 1 per person/date across every role/team. Future confirmations are rejected. All changes are atomic and audit before/after values.

Legacy output dates are not backfilled into effort. Missing effort on past/current planned work, or submissions without positive effort, is flagged. Per-day rates remain unknown while these gaps exist. Confirmed zero effort with no output is complete but has no rate denominator. Historical effort is not inferred from team membership, and zero-output unscheduled work must be entered explicitly. Known gaps are measured; this is not proof that every unplanned work day was reported.

Positive effort protects its role/team/date allocation from removal or transfer, alongside existing recorded-work guards. Roles with effort history cannot be removed from the workspace. Physical tenant isolation, account authentication and existing review controls remain in place.
