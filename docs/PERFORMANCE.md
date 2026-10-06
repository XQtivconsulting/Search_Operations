# Performance tuning

## Changes

- Workspace state computes assignment work protection in bulk from its existing snapshot plus one review lookup. Mutation-time checks remain authoritative. The number of state queries does not grow with assignment count.
- Candidate-derived totals index search/team/date once instead of scanning assignments for each mapping. First matching assignment behavior is preserved.
- Weekly allocation builds a workload index once per workspace snapshot; each calendar tile then does a direct lookup. Cross-team overlap and PTO warnings retain their existing meaning.
- Sourcing Decisions groups records by search once and reuses a single Eastern-time date formatter.
- Generic table sorting extracts each row's comparison value once instead of traversing React cells inside every comparison.
- Major navigation screens load as separate JavaScript chunks. Previously visited chunks are reused by the browser. Navigation continues to reuse the current workspace snapshot; mutations still refresh authoritative data.
- State requests reuse one membership lookup. Added indexes support review joins, record history lookups, and search/team/date allocation lookups.

## Actual local verification

- Five targeted tests passed, including a 20,000-record protection/grouping check and 10,000-assignment workload lookup check.
- Synthetic workload benchmark: 2,000 assignments, 6,000 entries, 140 date/team cells. Median of five local Node runs: previous calculation 1,327.98 ms; indexed calculation including index construction 3.47 ms. Outputs were deeply equal. These are calculation timings, not browser or production latency measurements.

## Release gates

The deployment workflow must pass TypeScript, the full test suite, and the production build before deploying. New integration tests assert fixed state query count with 2,000 assignments and preserve candidate-derived attribution. Workflow results are recorded by GitHub Actions rather than assumed from local helper tests.

## Remaining scale boundary

The initial authenticated workspace response still includes all research records and their event history. This change does not claim server-side pagination or bounded historical payloads. Candidate directory pagination limits visible rows but does not reduce initial data transfer. For substantially larger histories, measure payload size, parsing, and authenticated browser navigation on representative devices, then introduce permission-checked, screen-specific paginated endpoints and on-demand history without truncating audit records or breaking cross-record search. No production browser load test has been performed in this change.
