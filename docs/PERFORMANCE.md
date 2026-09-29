# Performance

## Views

Researcher performance compares researchers or teams, with role/client multi-selection and date/team filters. Expand a row for per-search results. The optional matrix shows a single metric across searches and people/teams; CSV exports the currently selected comparison rows. Quality always includes its final-decision sample size, and pending review counts stay separate.

Search effort & yield displays age, effective sourcing decision, person-days from plan or prior recorded effort, mappings, approvals and approvals/person-day. Expand a search for days since first submitted mapping, distinct active sourcing days, estimated hours, mappings per active date, approval/all-mappings ratio, researcher contribution shares, results by work date, and company coverage. This week-to-date versus last full week is explicitly labeled and uses current outcomes for those mapping cohorts. The decision link opens Search Decisions for that role.

## Definitions

- Mapped: submitted mappings attributed to their work date; drafts excluded.
- Quality: Approved / (Approved + Rejected). Final peer rejection counts as a rejection. Pending, Hold and Needs information do not enter the denominator. Reopening changes the current final-decision sample; immutable research events are preserved.
- Approval/all-mappings ratio: approved / all submitted mappings, including pending work. This is distinct from quality and is shown in search details.
- Throughput: submitted mappings / person-days from plan or prior recorded effort.
- Approved/day: approved mappings / person-days from plan or prior recorded effort.
- Contribution share: a person's mappings or approvals divided by the selected search's total; this is not quality.
- Team results use pooled counts and effort, never averages of individual percentages.
- Search age: calendar days since recorded search start, including paused time. This is not historical active time or time to close. Missing start dates stay unknown.
- Days since first mapping: elapsed calendar days since earliest submitted mapping's work date, independent of period selection.
- Active sourcing days: distinct dates with positive allocated effort or submitted output; not sessions. Hours are estimated as person-days × 8.

## Automatic effort and PTO

Person-days default to the saved daily researcher allocation. Each researcher/date contributes one day, divided equally across their distinct search/team assignments. The split is calculated across the entire day before applying reporting filters, so filtering to one search never expands its share. Repeated/derived entry rows do not create additional planned researchers. Future dates are excluded; today's allocated full day is an estimate, not elapsed hours.

Weekly Plan → Time off lets researchers mark or remove their own full-day PTO; planners/admins can do this for any active researcher. PTO reduces effort to zero across all searches for that date. Existing allocation cards show the absent person's name and PTO; My Work displays a PTO notice. Existing targets and assignment/review history are not deleted or rewritten. New allocation defaults exclude people on PTO. Changes use optimistic versions and immutable audit records in the tenant workspace's `time_off` table.

No daily confirmation or effort-entry form appears in My Work or Performance. Previously recorded corrections in `effort_days` / `effort_records` remain preserved and replace that person's whole-day default; PTO takes precedence. There is no automatic conversion of unscheduled candidate activity into a day of effort. Submissions without a positive allocated/previously recorded day are flagged and rates stay blank for that selection; quality and output remain available. Correct the underlying plan when work was not allocated.

Rates using planned days are estimates and change when the underlying historical plan/PTO is corrected. Historical spreadsheet effort has not been imported. One day = eight estimated hours. Current controls support full-day PTO; fractional PTO is not implemented.
