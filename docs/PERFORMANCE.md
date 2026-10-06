# Performance

## Current model — 6 October 2026

This section supersedes the historical designs below. There are no throughput or quality thresholds, pass/fail classifications, or aggregate researcher scores.

Researcher performance groups comparisons by search and team, with counts and relative bars. Throughput share is a researcher's mapped profiles divided by that search/team's mapped profiles. Drafts count toward mappings, using creation date when no work date exists. Submitted mappings retain their work date. Zero-output team members remain visible; historical contributors remain attributed to their recorded team. Selecting a researcher never changes the team denominator.

Quality shows two distinct measures: contribution to the team's partner approvals (researcher approvals / search-team approvals), and the researcher's partner approval rate (approved / partner-decided). Only current partner approvals/rejections enter that decision denominator; peer rejections, pending, returned, and reopened reviews do not. Sample counts are visible, and counts/rates open matching candidate lists. This uses the mapping owner's researcher attribution, not the partner or peer reviewer identity.

Search effort & yield shows mapped profiles, partner approvals, partner approval rate, awaiting review, person-days, estimated hours, and estimated hours per approved profile. One person-day is eight hours; hours per approval = selected-period person-days × 8 / approvals for the selected mapping cohort. No approvals, zero effort or missing allocations leave the estimate unavailable. Allocation gaps open exact dates/people with a planning action. Planned allocations are estimates, not logged elapsed time; existing PTO and historical corrections still apply.

Both views use explicit date bounds, including Since search began (all recorded history). Outcomes are current outcomes of the selected mapping cohort, not review events occurring in the period. Tables sort full results and export the current filters. Search detail retains researcher contributions and company coverage. Threshold preferences previously saved in view state are ignored.

Verification: calculation tests cover relative shares, search/team isolation, zero-output members, draft dates, partner versus peer decisions, reopened reviews, period boundaries, and eight-hour conversion with unavailable denominators. Actual local verification: typecheck, all 301 tests, and the production build passed. Deployment/live verification is recorded separately.

## Historical implementation notes


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

## Focused detail layout
View details opens a dedicated subject view instead of inserting nested tables into the comparison rows. Back retains the main filters and sort. Four key measures lead the Overview; on detail tabs they compress into a single slim strip. Researcher/team details separate Overview from By search. Search details separate Overview, Researchers, Work dates and Company coverage. Breakdown tables default to six compact columns for effort/output/quality; contribution percentages use a separate Show selection. Work-date detail has a bounded scroll area. All existing metric calculations and reporting scopes are unchanged.

## Partner dashboard — 5 October 2026

Both views default to the last 30 calendar days through today (US Eastern), with populated From/Through dates. Presets include this week, last week, this month, all recorded dates and custom dates; future dates are capped at today. Historical saved custom bounds remain supported. The selected period is repeated above results and in detail views. All-recorded starts at the earliest recorded plan/effort/work date.

Replaced the raw summary sentence with clickable priority cards: awaiting review, allocation gaps, subjects with allocated effort but no submitted mappings, and approved candidates. Cards filter comparison rows; amber flags work to examine without claiming a missed target, green identifies approved output. The comparison shows submitted/approved/pending outcomes and final-decision sample sizes. CSV follows the active priority filter. Opening the optional matrix resets that filter.

Allocation gaps open a sortable popup by work date, researcher, search and team, with the affected mapping count and exact reason (no matching allocation, zero recorded effort or PTO). Review plan opens the existing sourcing planning flow. No allocation is fabricated, and productivity rates remain unavailable when their denominator is incomplete. Row/detail links scope the popup to that subject. Removed persistent instructional paragraphs; metric definitions remain collapsed.

Local validation: typecheck, 294 tests and production build passed, including date preset boundaries and gap/cohort/PTO/filter coverage. Live deployment is verified separately.

Actual live verification: release 363561d84209ec5c6aa994031464759b723f771e, deployment run 37377160771 and job 111989163651 succeeded in every gate. Checked researcher and search dashboards, explicit last-30-day and last-week bounds, priority filtering, the full gap popup and a researcher-scoped two-row popup. Verified monitor action controls are 28px with 17px icons, accessible names and native hover titles; visually inspected compact rows. No business data was changed.

## Action-first revision

Actions now uses current pending work across submission dates, scoped to selected searches and team. Team/partner reviews and researcher requests for information open exact candidate lists with responsible role and direct mapping navigation. Hold is separate from a request for information. Period output counts open the matching submitted-work cohort and retain explicit bounds. Pending reviews do not lower approval rate.

Search priorities reuse sourcing-monitor dated targets: only dates before today are due, and team shortfalls are preserved rather than offset by another team's surplus. Red means behind dated plan or researcher follow-up needed; green marks on-track plans and approved output. Current actions are explicitly distinguished from selected-period results. Allocation gaps live under Data completeness; no invented productivity thresholds or researcher performance scores are applied. Search rows show total and selected-period person-days; yield details remain available by opening the subject.

Actual verification of release 63b3386969a43e6a74ed2130c29abbfa03222b56: deployment run 37380400202 / job 112000588547 passed every gate. Live review and researcher-follow-up card counts matched their candidate popup rows. Opening a review reached the correct mapping and Back returned to Performance. Behind-plan card filtered the search comparison. Visual inspection found shared CSS overriding urgent card colors and overly narrow next-action cells; follow-up corrects both. The plan action is also scoped to its selected search. No business records were changed.

## Throughput and quality dashboard

Both dashboards now lead with two dimensions: submitted mappings per person-day (throughput), and partner-approved divided by final decisions (quality). Researcher cards count researchers, team comparisons count teams, and search cards count searches. Removed Actions now and the operational search/review queue cards from this dashboard. Sourcing Monitor retains operational tracking.

Each dimension shows meeting, below, unavailable and threshold-not-set cohorts. Cohort buttons filter the complete sortable comparison table; zero output with valid effort is measurable, while missing effort and no final decisions remain unavailable. No firm performance thresholds were configured, so explicit comparison settings begin empty. They are independently retained for researchers, teams and searches in the user's dashboard view, not represented as organization policy. Minimum throughput and quality % are editable via Thresholds. Quality shows its decided sample count and excludes pending review.

The table prioritizes throughput and quality, followed by person-days, submissions, approvals and awaiting review. Metric cells use green/red only after a threshold is supplied; no threshold or missing evidence is neutral. Throughput opens submitted mappings (or scoped allocation gaps when effort is incomplete); quality opens only final decisions including rejections. Subject names and compact detail icons open results by search/researcher. Definitions and data completeness remain collapsed.

Actual verification: release 951173065dd7201a0d30d8156e55f93436123550 deployed successfully in run 37382467657 / job 112007592934. Typecheck, all 299 tests and production build passed locally and in CI. Live checks confirmed researcher-only and search-only metric cards, explicit period bounds, threshold classification and matching filtered row counts, final-decision candidate drilldowns, and search detail by researcher. Visually verified neutral missing data, green meeting and red below-threshold cells. Temporary comparison settings used for verification were cleared; no business records changed.
