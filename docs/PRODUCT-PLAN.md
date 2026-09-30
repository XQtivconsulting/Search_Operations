# Product plan

## Candidate profile follow-up

Keep the directory compact, sortable and searchable with paged rows. A future release should expand the individual candidate page with notes, resume storage, phone numbers/contact details, interaction history and mapping workflows. These richer profile features are deferred; the current directory update does not implement them. Server-side candidate search/pagination remains future work; current pagination bounds rendered rows while the workspace state still supplies the records.

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

## Next phase: native search engagement creation alongside RecruitCRM

Owner direction, 30 Sep 2026: support both CRM-imported and directly-created search engagements after the current candidate-engagement release. Both sources must share sourcing, partner approval handoff, engagement and hiring workflows. Retain optional RecruitCRM connectivity during transition; explicitly track origin/external identity and field ownership, prevent duplicate linking and conflicting updates. Native search creation and removal of CRM dependency are not part of this release; the existing CRM-only creation guard remains active.
