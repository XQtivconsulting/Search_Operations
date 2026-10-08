# Unified Engagement workspace

Engagement replaces the separate dashboard and queue navigation entries. Searches, List and Kanban are views of one workspace. Priority cards filter that workspace in place; choosing a search does not leave it. Search status and ownership are shared across all views. Candidate/search text, stage and priority filters remain visible and persist when switching views. All searches returns to the broader population while retaining priority and stage. Old Daily Work browser-history entries resolve to the same Engagement page.

Counts represent candidate-search mappings, not deduplicated people. A person in two searches appears separately, with the correct search ID, stage, action permissions and search-specific history. Each priority card uses the same predicate as its list and Kanban results; per-search counts sum to the corresponding card. Cards reflect search scope, text and stage filters, and exclude only the selected priority filter so other priorities remain available. Priority categories overlap and must not be summed.

- Active: approved or CRM-ready mappings in active stages on open searches.
- Overdue and Due today retain existing configured stage-age threshold rules: greater than the threshold versus at the threshold. These are elapsed whole days, not a new calendar scheduling model.
- New today: active handoffs received on the current US Eastern date.
- Awaiting approval: mappings waiting for sourcing partner approval before engagement starts, excluding closed searches. Reopened engagement stays paused and is not a new handoff.
- Unscheduled: active candidates with no threshold or unknown stage start.
- All candidates includes sourcing mappings and terminal outcomes, subject to search status and other visible filters.

The search summary prioritizes overdue and due work. Its counts open the matching search cohort in List. Both List and Kanban retain activity detail and the existing note/stage editor. No message is sent from the app by these actions. Read-only users have no record-activity control. Existing server authorization, versions and audit behavior remain unchanged.

List renders 75 rows per page after sorting the full matching set. Kanban initially renders 50 cards per stage and offers Show more; totals always include the full cohort. Candidate/search/member lookups are indexed, the common population is memoized, and configuration is normalized once per derivation. Search IDs use compact fixed columns.

## Verification

Synthetic tests cover count-to-cohort and per-search reconciliation; pending, reopened, closed, placed and shared candidates; assignment/partner scope; matching List/Kanban cohorts; read-only actions; paginated/incremental rendering; and migration of old queue history. Existing stage mutation tests cover authorization, reopening, stale versions and audit events. Obsolete assertions for the retired screen were updated.

Actual local verification, 8 October 2026: typecheck, all 369 tests and the production build passed. The browser was signed out, so authenticated visual and interaction verification was not performed. Deployment and unauthenticated access checks are separate release checks.
