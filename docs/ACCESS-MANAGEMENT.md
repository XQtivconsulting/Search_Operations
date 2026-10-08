# Access Management

The left navigation entry is Access Management, with two tabs: People & teams and Roles & permissions.

People & teams combines the account directory with sourcing-team management. People can be filtered by name/email, assigned role and sourcing team. The team-management section retains team creation, member moves and lead selection. Existing permission checks determine which actions are available. Users without directory access retain only the sourcing-team view.

Role headers show compact clickable membership counts, such as (7). Clicking a count opens People & teams with that exact assigned-role filter. Counts include both active and revoked accepted accounts, matching the role catalog's existing usage definition; access state remains visible in the directory. Pending invitations are separate and do not increase the count. The protected Super Admin column also has a count.

The permissions matrix uses smaller unboxed marks, compact rows/headers and pencil-only edit controls with accessible names. Introductory training text is removed.

Invite person opens the invitation form directly. There is no existing-account chooser. Roles are separate full-width checkbox rows; no privileged role is preselected. Super Admin is offered only to an existing Super Admin. Existing server checks also reject Super Admin grants by ordinary admins in invitation and member-update requests, including combined role payloads and protected-account changes. The final active Super Admin cannot be removed. Configurable roles do not confer GitHub or Cloudflare access.

No live invitations, role changes or account changes were made during this implementation. New synthetic checks exercise invitation escalation denial/success, role-count reconciliation and combined-page rendering. Existing tests cover member-update escalation, tenant boundaries, stale versions and role policy protection.

Actual local verification, 8 October 2026: typecheck, all 369 tests and the production build passed. Live browser inspection reached sign-in; authenticated visual verification was not performed. Deployment is checked separately.
