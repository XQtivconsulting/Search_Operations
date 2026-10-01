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

## Owner direction — 30 Sep 2026: reusable talent assets and phased rollout
This roadmap is design work, not authorization to build the future modules in this release. Current implementation scope is collapsible navigation and clearer mapping-fit presentation.

- **Talent assets:** Candidates and Company universe are shared assets across sourcing and engagement. Keep companies first-class: consistent identities/aliases, relationships, reusable target datasets and candidate links. Sourcing navigation starts with Search repository, followed by Weekly plan, Delivery Monitor and Performance. Module groups collapse independently as navigation grows.
- **Tag model to validate before implementation:** Start with a small governed vocabulary for domain, function, capability and market, plus free-form tags that can be proposed and curated. Separate verified capabilities from search association. Mapping a candidate to a search is context, not proof of expertise. Search-associated tags should carry source search, assignment date and review state; display inherited and human-confirmed tags distinctly, without overwriting candidate tags. Renaming/removing a search tag needs an explicit propagation rule. No unlimited tag taxonomy or automatic unreviewed enrichment.
- **Visual completeness:** Clear missing-phone, missing-resume and missing-tags indicators; do not misrepresent completeness as candidate quality. A review queue helps the team validate newly added profiles and suggested tags. Record author, source, review status and edits so incorrect enrichment can be corrected.
- **Semantic search:** Queries such as “Experts in AI productionalization” should find relevant reviewed tags and supporting profile/transcript evidence, showing why a match was returned. Validate vocabulary and retrieval with real internal use before adding automatic inference. Do not turn inferred tags into hiring judgments or silently promote guesses to facts.
- **Next module sequence:** Client pages first (client-ready weekly status reports and candidates in progress), then Sales, Finance (contracts, invoices, billing), continued Search ERP consolidation, then People. Current operational People & access remains the account directory; future People scope needs separate definition. Client sharing requires a deliberately selected client-safe view, not publication of internal notes or unrelated candidate data.
- **Future integrations and migration:** Explore Slack use cases and permissions before connecting or sending anything. Inventory files, owners, candidate/search links, duplicates and access requirements before planning a staged import; preserve originals and audit provenance. No Slack connection or file migration is enabled by this release.
- **Rollout:** Small focus groups spanning researchers, partners and engagement members; repeat UAT with each increment, track observed problems, prioritize fixes and expand gradually. Validate candidate entry, evidence review, company reuse, tagging and client reporting against actual team workflows.
