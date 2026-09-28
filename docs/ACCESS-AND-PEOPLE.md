# People, permissions and candidate identity

## People flow

People & access is the single administrative directory. It lists all workspace accounts (including super admins, admins, planners, founders, partners and researchers), then outstanding invitations and unlinked researcher planning records. Linked accounts do not appear a second time as unlinked researchers.

Add person / researcher starts with existing accounts. Enable Researcher on the correct existing person, optionally alongside Admin, Partner or other roles. A staff link is created once or selected from unlinked records; an existing link cannot be swapped to another identity. Invite new person is the secondary option. Duplicate account emails in the same workspace are rejected. Name changes apply to this workspace; sign-in email changes still require the account holder's password and new-mailbox verification.

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
