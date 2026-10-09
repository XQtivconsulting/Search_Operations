# Configurable access and engagement

## Administration
People & teams → Roles & permissions provides editable, tenant-specific roles.
Create a role from a template, adjust individual permissions grouped by activity,
and assign one or more roles to people. Multiple roles combine their permissions.
Editing permissions includes the viewing permissions required for that activity.
There is no unconditional shared edit baseline.

Default templates follow the owner’s activity matrix: Researcher, Research Team
Lead, Engagement Resource, Engagement Lead, Partner and Admin. Planner, Data
Quality and Founder remain compatibility templates for existing accounts.
Existing role IDs and memberships are preserved.

Partners can edit user display names, but cannot invite people, change account
roles or revoke access by default. User profile editing is separate from access
management. Candidate deletion is represented as archival to retain search and
review history. Unused searches can be removed; searches with work must be closed.

Super Admin is the protected owner role. Only a Super Admin can change Super
Admin membership, and at least one active Super Admin must remain. Ordinary
roles cannot create Super Admin authority. Authorization to modify source code
and deploy belongs to the owner through GitHub/Cloudflare controls; an in-app
permission does not create repository or hosting credentials.

Role definitions are persisted in Identity storage per tenant. Permissions are
resolved from authoritative membership and current policy for each request.
Changes affect existing sessions on their next request. Role modifications have
optimistic versions and transactional audit records. Roles referenced by members
or unexpired invitations cannot be deleted. Stable account-linked staff IDs
support PTO and candidate attribution; only eligible sourcing accounts enter
sourcing rosters. Removing sourcing eligibility retains historical work.

Server authorization checks each mutation/action before running existing
record-level validation. Compatibility adapters only supply capabilities for the
authorized operation; nested operations recheck their own permissions. Review
stage, assignment ownership, tenant, version and audit rules remain in force.
Keyword editing cannot change criteria. Criteria approval remains with the
criteria owner and approves the combined sourcing brief.
Read responses filter unavailable categories and related event snapshots.

## Engagement
People are assigned once per search and work across all funnel stages.
Existing funnel assignments resolve to the union of previous members. Saving
replaces them with one versioned member list; old funnel-write payloads are
rejected with a reload message. Engagement teams are retired; historical
records remain in audits and exports. Sourcing teams remain.

List and Kanban both expose accessible view and record-activity icons.
List rows use a compact overdue indicator beside days in stage.
Sales Navigator actions offer an external link to Sales Navigator, not an
invented candidate-specific Sales Navigator URL. Opening the link does not
record completion. Users perform outreach externally and then record the
activity/stage with the existing note and version checks.

## Other UI corrections
ColumnFilter and SearchMultiFilter always use the shared portal-based popover
above table layers, outside clipping containers, with opaque background,
viewport clamping and Escape handling.
Search settings uses the shared accessible popup, aligned checkbox and wrapped
copy. Search-picker results separate title and status.
Existing XQtiv public numbers are preserved; missing numbers are assigned above
the sequence high-water mark on workspace initialization. Internal IDs and CRM
references are unchanged. Internal LOCAL placeholders are not displayed as
public search numbers. Backup restoration preserves its original snapshot;
number backfill occurs on workspace initialization.

## Verification
Tests use synthetic accounts and in-memory databases, never real accounts.
Coverage includes template defaults, action-level denials, tenant separation,
owner protection, current-session policy changes, role deletion/version rules,
independent strategy fields, direct engagement assignments, stale writes,
candidate assignment without sourcing teams, numbering idempotence and popover
positioning. Typecheck, full regression tests and production build are required
before deployment. CI also verifies candidate AI synthesis and backup setup.
No authenticated production-browser walkthrough is claimed.

## Comparison view and retired templates
The administration screen now shows permissions as grouped rows and active roles as columns, with effective allowed/not-allowed values and an Edit action per role. Planner and Founder are no longer offered as templates or assignable new roles. If either is assigned already, its access is preserved as a retired role until an administrator reassigns the member or resolves its pending invitation; this avoids silently replacing it with a more powerful role. Super Admin remains protected.

## Navigation visibility — 9 October 2026

Roles & permissions starts with Navigation visibility. Independent saved controls cover My Work, Candidates, Companies, the Sourcing module and each sourcing page (Search repository, Weekly plan, Sourcing Monitor, Sourcing Performance), Engagement, Interview tracker, the Admin module and each admin page (Access Management, Integrations, Sourcing settings, Engagement configuration, Backups & exports).

A page requires its visibility grant, its parent module grant where applicable, and its existing data/action access. Visibility grants do not grant data, editing, import or administrative operations. Sidebar and page rendering share the same check, including browser history and internal links. Account settings remain available. Super Admin retains protected access. Navigation grants are never inferred from action permissions after migration, so administrators can explicitly hide a page while preserving actions used elsewhere.

Existing tenant role policies receive a one-time, versioned/audited migration preserving prior page availability based on their effective permissions. No new editing/import authority is added. Later visibility revocations remain saved. New role templates include their corresponding visibility grants; a custom role starts empty. Tests cover independent monitor/performance access, parent module gates, feature permission requirements, unknown-page denial, migration idempotence, revocation and tenant isolation. Existing server authorization and category filtering remain in force.

## Inline permission editing — 9 October 2026

Super Admins edit permission checkboxes directly in the comparison grid and save all changed roles together. Cancel restores the loaded values. Required view permissions remain checked while dependent actions are enabled. Role details use the pencil; permission changes do not require a popup. Super Admin is protected.

The server resolves current tenant membership and requires an actual Super Admin for role policy mutations and changes to existing members’ assigned roles. Delegated roles.manage permission is insufficient. Batch saves use one transaction, check every role version, and roll back all edits and audits if any role is stale. Ordinary account profile/status administration and invitations retain their existing permissions.

Verification uses synthetic memberships and checks delegated-admin denial, forged actor roles, atomic stale-batch rollback, successful batch versions, and existing role protections.

## Direct draft approval

The explicit `reviews.direct` permission (Approve directly from draft) is opt-in for configured roles. Super Admin retains all permissions. Only the assigned search partner may use it, even with Super Admin access. The mapping action requires Draft status, a ready strategy, valid fit evidence/rationale, a bypass reason, and the current version. It preserves mapping attribution/date, records the partner and team-review skip in the audit, and hands the approved candidate to engagement. It does not fabricate a team approval. The normal two-stage flow remains unchanged.
