# Tactical sourcing monitor

The monitor defaults to Yesterday in US Eastern time, with Today and Custom date range as the only other reporting periods. Previously saved weekly/monthly selections fall back to Yesterday. Historical navigation to Candidate reviews opens the single Sourcing progress view.

Each search has one row across teams, with expandable researcher rows. An unattributed row preserves historical mappings without an owner; attribution is never invented. Search-level approval targets are not arbitrarily apportioned to researchers. Team filtering changes the cohort but effort is split across all allocated searches before filtering, preventing double counting.

Columns group the selected period (effort hours, mapped, approved), cumulative progress through today (hours, mapped, approved, approved/hour, approved/mapped), and current review/attention actions. Mapping creation dates are converted to Eastern dates. Period approval uses the current approval transition date, not the date the candidate was mapped. Unknown historical approval dates remain in cumulative totals and are not fabricated into a period. Reopened mappings no longer count as approved.

Attention indicators expose evidence: rejected profiles, effort without approvals or mappings without effort, pending team/partner reviews, and past-due targets greater than approved plus in-process profiles (or missing targets). Each active indicator has a five-word cause and a detailed tooltip. They are not inferred financial or performance thresholds. Review counts drill into a sortable candidate list and retain the mapping shortcut. The top aggregate summary, duplicate review tab and allocation edit action are removed.

Admin → Sourcing settings controls hours per person-day, default 8, in quarter-hour increments from 0.25–24. The existing configurable integrations/system-settings permission controls this action, enforced server-side. Changes use optimistic versions and audit records; all displayed periods recalculate, while raw person-day records stay unchanged. Sourcing Performance uses the same conversion. These are estimated effort hours, not timesheets or payroll costs.

The roles comparison retains all columns and permissions with clearer markers, group bands, sticky headers/labels and a section filter. The performance researcher view explicitly fixes Search ID at 76px so it cannot inherit the previous 24% subject-column width.

Verification: TypeScript and 357 synthetic tests passed locally, including period/approval-date separation, Eastern midnight boundaries, researcher reconciliation, hours conversion, cross-search allocation splits, PTO, and admin/version/validation/audit protections. Production build and deployment are separately verified in CI. No authenticated live edits or real employee/candidate test data are used.
