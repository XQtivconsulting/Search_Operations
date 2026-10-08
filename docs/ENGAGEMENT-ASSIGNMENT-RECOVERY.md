# Unavailable engagement assignment recovery

The assignment editor previously initialized its selected IDs from the full saved assignment, including legacy funnel members, but displayed only people with engagement access. An existing assignee who lost access remained selected and was included in every save without appearing in the picker. The server correctly rejected the entire update, leaving the old assignment unchanged.

The editor now uses the same active-account and engagement-permission predicate as the server. Selected IDs that are no longer eligible or no longer appear in the active directory remain visible in a separate removable list. Known names are retained; missing accounts use a neutral unavailable-member label. Save stays disabled until those unavailable entries are explicitly removed. No stored assignment is silently discarded when opening the editor. Custom role permissions are honored.

Saving still replaces the search-wide member list with optimistic version checks and transactional auditing. Legacy funnel fields are removed by the existing save operation. Saving an empty list unassigns everyone. Candidate stages, notes and sourcing attribution remain intact.

Synthetic regression coverage includes revoked accounts, removed permissions, custom permissions, missing accounts, visible recovery controls, rejected mixed-eligibility writes, migration from legacy funnel assignments, successful removal, stale-write rejection and clearing all assignees. No production assignment was changed during verification.

Actual local verification, 8 October 2026: typecheck, all 372 tests and the production build passed. Deployment is verified separately.
