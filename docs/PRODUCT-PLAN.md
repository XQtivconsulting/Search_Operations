# Product plan

## First operating release

Use weekly priorities to choose searches, create daily team assignments, record individual output, complete peer and partner review, and inspect productivity. Preserve a compact spreadsheet view for repeated input. The current implementation provides this loop with durable storage and permissions, plus a staged job import from RecruitCRM.

## Before live use

Connect the specified GitHub repository and the owner’s Cloudflare account. Deploy, create the first administrator invitation securely, import the supplied workbook into an empty XQtiv workspace after reviewing discrepancies, and walk through one real search with the owner. Verify backup/restore, authenticated UI behavior and account recovery before expanding usage.

## Next priorities

1. Bulk creation/editing of weekly and daily allocations, roster changes, capacity conflicts and plan locking.
2. Extend implemented versioned role briefs/strategies and target-company mapping with Positions, formal plan approval and Boolean query tracking.
3. Extend implemented reusable candidates, unique candidate-role mappings, structured rejection reasons and immutable two-stage reviews with enrichment and controlled merges.
4. RecruitCRM approved-candidate handoff, engagement summaries, tenant secret management, durable retry/outbox and reconciliation.
5. Server-side reporting/pagination, historical team memberships and role health metrics.
6. Client presentations, interviews, offers, placements, fee milestones and partner attribution.
7. Reusable search maps and human-approved AI assistance.

Business Object Model v3 takes precedence where the older capability document separates Mandate and Role. They represent one canonical Role; a Position is a seat. Do not conflate operating responsibilities with security roles.
