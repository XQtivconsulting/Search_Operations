# Search status and public identifiers

Public Search IDs are positive integers allocated in the workspace database. A unique database index is the final guard against duplicates, including direct writes. Automatic inserts use a monotonic high-water mark. Imports and bulk edits validate conflicts before committing; bulk swaps are atomic and use optimistic versions. Internal keys and CRM references remain separate and unchanged.

Search listing tables expose the public ID beside the search name, including the repository, weekly planning, engagement, interviews, sourcing monitoring/performance, candidate profiles and task lists. Team-mode allocation tiles include the number with the search label.

Status changes produce append-only transition rows with previous/new status, a server timestamp, notes, actor and source. Workspace edits attach notes and actor in the same transaction. CRM changes use the time observed by this app; they do not claim an unavailable historical CRM date. Existing/imported historical statuses show Date not recorded when no original date is available. Status history is included in business backups and isolated restoration.

The repository exposes the same status/history and settings icon as the search register. Editing a CRM-managed search requires explicit local takeover so later CRM refreshes cannot overwrite the partner's local status. Search editing permission is enforced on the backend as well as in the UI.

Planner and Founder are retired from available templates and the comparison grid. Unassigned definitions are removed; assigned legacy definitions remain only until people/pending invitations are reassigned, preserving access without silently granting a broader replacement role. New invitations cannot use retired roles. Retirement of an existing unused definition records a member event.

The engagement queue is a cross-search priority overview. Clicking a count opens the shared dashboard with that exact cohort and a Back to queue action; no duplicate candidate table expands underneath. Interview tracking uses compact search/client context and prioritizes round details; recommendation dates edit inline with version checks and auditable correction notes.
