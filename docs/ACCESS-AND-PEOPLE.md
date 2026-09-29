# People, permissions and candidate identity

## People flow

People & access lists accepted workspace accounts with multiple roles and a separate pending-invitations list. Standalone researcher records are retired. Inviting someone creates no assignable staff record. Acceptance creates the internal account-linked research identifier when needed. Adding Researcher to an existing account uses that account's stable identifier; there is no manual staff-record linking step and no name-based merging.

Only accepted, active researcher accounts can join team rosters, be allocated new work or become peer reviewers. Workspace synchronization removes ineligible roster members, bumps roster versions and preserves historical entries and mappings. Legacy unlinked records are hidden from operating selectors. Existing data is retained internally for history.

The original owner has a Reset test people action with a preview and explicit email confirmation. It retains the owner account, roles and password, removes other memberships in this workspace, cancels its invitations and retains audit/work history. Global user credentials and other-workspace memberships remain untouched. This cleanup is an explicit authenticated operation, not a deployment migration.

Teams contains rosters and peer routing only. Admins and planners edit them; all members can read rosters. Account settings is beneath the signed-in name, email and roles, immediately before Sign out.

## Access by screen

All read access below is within the signed-in workspace. Roles combine; Founder alone is read-only. Admin does not implicitly become Researcher.

| Screen | Read | Create / edit / act |
| --- | --- | --- |
| Overview, Daily Work, Performance, Workflow Monitor | All members | Counts are derived; underlying actions use the rules below |
| My Work | All members, personal queue | Researcher: own drafts/submissions and assigned teammate reviews. Partner/admin: assigned partner reviews |
| Searches, weekly plan | All members | Admin, super admin, planner |
| Role repository | All members | Admin/planner; assigned partner for role management; researcher for owned mappings/company coverage |
| Candidates | All members | Researcher, partner, planner, admin can maintain profiles. Researcher creates mappings under their own identity |
| Company universe | All members | Admin, super admin, planner |
| Teams | All members | Admin, super admin, planner |
| People & access | Admin, super admin | Admin manages ordinary accounts/roles. Only super admin manages super-admin accounts or grants that role |
| Integrations | Admin, super admin | Admin, super admin |
| Account settings | Own account | Own password and verified sign-in email |

The original active administrator is migrated to protected workspace super admin. Migration uses the earliest accepted admin invitation when available, then original membership order. Other account IDs, credentials and roles are preserved. At least one active super admin must remain; no account can revoke its own access. Membership changes use optimistic versions and tenant-scoped audit records. No account is merged or deleted by this release.

## Browser account switching

A browser profile shares the same HttpOnly sign-in cookie across app tabs. The UI now shows the email, clears invitation state after acceptance/sign-out, and broadcasts account changes to other tabs. Authenticated requests include the displayed user ID as a consistency check; the server compares it with the cookie-authenticated user before any action. Mismatch stops the request with SESSION_CHANGED. This header is not authentication or a permission grant. A focus check also detects cookie changes. Use separate browser profiles (or a regular and private window) to operate two accounts simultaneously.

## Candidate and mapping model

Candidate is a tenant-scoped master record, uniquely keyed by canonical LinkedIn URL. First and last names are required; email, phone, current title and company are optional. A changed spelling does not create a new identity, and matching names with different LinkedIn profiles are not automatically merged.

Mapping references a candidate ID and role ID, with researcher/account ID, staff ID, research team, optional target-company ID, fit rationale, research-review state, timestamps and immutable events. The role references its client. Each candidate/role pair is unique. Another researcher can map the same candidate to another role; a second mapping to the same role is rejected to avoid duplicate credit and conflicting approvals.

Candidates shows every mapped client/role, mapper and research-review status. Master contact edits retain the candidate ID; past mapping and review snapshots remain unchanged. Existing legacy name-only records require confirmation of first/last names before reuse. No automatic name split or account/candidate merge is performed.

A researcher can add a direct mapping for a role using a team they belong to, or start from an owned company target. Drafts do not count as submitted output. Submission requires fit evidence, the approved strategy cutover, an active teammate reviewer and an engagement partner. Peer approval precedes partner review; self-review is prohibited. Outreach lifecycle stages are not implemented in this release and will be separate from mapping research-review status.

## Retired count workflow

Spreadsheet entry, historical count reviews and import reconciliation are removed from the working screens. HTTP APIs reject new manual output and count-review mutations, including bulk requests. Daily Work and Performance display candidate-derived output; legacy aggregate rows remain stored and are not converted into fake candidates or deleted. Planning targets and roster snapshots remain available. Test-data cleanup remains a separate, explicitly scoped operation.

## Owner-only full workspace reset

People & access → Reset workspace test data replaces the people-only UI. Preview counts and an owner email confirmation are required. The server independently verifies the original owner, a current people signature and a SHA-256 workspace snapshot signature. Deployment never clears data.

The operation clears operational records (including legacy reviews/output, role documents, candidate access tokens, all staff/teams/plans, companies/candidates/mappings, effort/PTO, CRM preview and saved partner selections). It retains settings, audit/research events, the owner identity and roles/password, and Worker secrets. RecruitCRM and other tenants are untouched. Other people lose workspace memberships; global credentials and memberships elsewhere remain intact.

Before deletion, an atomic tenant-local recovery snapshot stores each record separately in reset_backups/reset_backup_rows, including credential-free member metadata. Original-owner-only downloads remain under Saved recovery snapshots. There is no automatic restore UI: recovering a snapshot requires administrator assistance and review; do not restore expired invitations or sessions. Immutable audit/research events remain in the live database. Identity membership cleanup is a separate Durable Object transaction; a failure returns an explicit partial-result message and backup ID, with instructions to preview and retry. No partial reset is represented as success.

Overview is retired. Researchers without leadership roles land in My Work; other accounts land in Delivery Monitor. The redundant workspace initial/name label is removed from navigation.
