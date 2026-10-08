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
