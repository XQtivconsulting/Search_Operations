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

Owner direction, 30 Sep 2026: support both CRM-imported and directly-created search engagements after the current candidate-engagement release. Both sources must share sourcing, partner approval handoff, engagement and hiring workflows. Retain optional RecruitCRM connectivity during transition; explicitly track origin/external identity and field ownership, prevent duplicate linking and conflicting updates. Native search creation was enabled on 4 October 2026 with LOCAL references and the shared sourcing/engagement workflow. RecruitCRM import remains available; automatic native-to-CRM linking is not implemented.

## Owner direction — 30 Sep 2026: reusable talent assets and phased rollout
This roadmap is design work, not authorization to build the future modules in this release. Current implementation scope is collapsible navigation and clearer mapping-fit presentation.

- **Talent assets:** Candidates and Company universe are shared assets across sourcing and engagement. Keep companies first-class: consistent identities/aliases, relationships, reusable target datasets and candidate links. Sourcing navigation starts with Search repository, followed by Weekly plan, Delivery Monitor and Performance. Module groups collapse independently as navigation grows.
- **Tag model to validate before implementation:** Start with a small governed vocabulary for domain, function, capability and market, plus free-form tags that can be proposed and curated. Separate verified capabilities from search association. Mapping a candidate to a search is context, not proof of expertise. Search-associated tags should carry source search, assignment date and review state; display inherited and human-confirmed tags distinctly, without overwriting candidate tags. Renaming/removing a search tag needs an explicit propagation rule. No unlimited tag taxonomy or automatic unreviewed enrichment.
- **Visual completeness:** Clear missing-phone, missing-resume and missing-tags indicators; do not misrepresent completeness as candidate quality. A review queue helps the team validate newly added profiles and suggested tags. Record author, source, review status and edits so incorrect enrichment can be corrected.
- **Semantic search:** Queries such as “Experts in AI productionalization” should find relevant reviewed tags and supporting profile/transcript evidence, showing why a match was returned. Validate vocabulary and retrieval with real internal use before adding automatic inference. Do not turn inferred tags into hiring judgments or silently promote guesses to facts.
- **Next module sequence:** Client pages first (client-ready weekly status reports and candidates in progress), then Sales, Finance (contracts, invoices, billing), continued Search ERP consolidation, then People. Current operational People & access remains the account directory; future People scope needs separate definition. Client sharing requires a deliberately selected client-safe view, not publication of internal notes or unrelated candidate data.
- **Future integrations and migration:** Explore Slack use cases and permissions before connecting or sending anything. Inventory files, owners, candidate/search links, duplicates and access requirements before planning a staged import; preserve originals and audit provenance. No Slack connection or file migration is enabled by this release.
- **Rollout:** Small focus groups spanning researchers, partners and engagement members; repeat UAT with each increment, track observed problems, prioritize fixes and expand gradually. Validate candidate entry, evidence review, company reuse, tagging and client reporting against actual team workflows.

## Owner direction — 3 October 2026: SaaS and business continuity
XQtiv becomes one tenant of a subscription ERP for other search firms. Prioritize tenant isolation, security, operational recovery and data portability before external commercialization. See [SaaS and recovery](SAAS-AND-RECOVERY.md) for the audited foundation, explicit limitations and detailed migration contract.

1. Deliver owner-only business exports: master Excel datasets, one workbook per search, attachments and a structured recovery snapshot. Connect weekly private backups and verify the first copy. Preserve offline access during an app outage.
2. Establish production recovery: protected identity backups, off-provider copies, daily/recent recovery points, failure alerts, documented response ownership and timed restores. Agree measurable recovery time/data-loss targets and prove them.
3. Add separate staging, migration/release gates, dependency scanning, MFA/account recovery, session controls and independent security review. Load-test both tenant isolation and the shared identity service; implement server pagination and chunked backup jobs before large customers.
4. Build historical RecruitCRM migration with staged candidate/company/contact extraction, exact external identity reconciliation, reviewed pipeline-stage mapping, original notes/authors/dates/attachments and repeatable selected batches. Importing engagement history must not fabricate sourcing approvals or inflate researcher performance. No historical production data is imported as part of the backup release.
5. Complete tenant registry/provisioning/branding, subscription billing/entitlements, tenant-owned integrations, quotas, retention/offboarding and operator/customer-admin separation. Thousands-of-tenants capacity is a validation target, not a current claim.

## Candidate assets decisions — 3 October 2026
Implemented directory redesign: compact first/last/company/LinkedIn icon/search count/tag indicators, 100 rows by default (25/50 options), global sorting before pagination, individual checkboxes and clear selection without select-page/select-500. Search count opens mapped-search links; zero-search candidates have a dedicated filter. Bulk mapping continues as researcher/team-attributed drafts requiring evidence and team/partner review.

Seven discrete tag dimensions: Industry, Geography, Seniority, Compensation, Function, Expertise/hot lists, and Searches. Searches derive from real mappings; the six editable categories use tenant-local shared master values, case-insensitive normalization, type-to-select and explicit add. Existing free-form tags remain preserved and searchable, not silently classified. Seed values are defined in `src/candidate-tags.ts`: industry sectors; regional geographies; Manager through Board; currency-specific annual OTE bands in USD/INR/GBP; business functions; and expertise/hot-list examples such as Future Chief AI Officer and AI Productionalization. Values are suggestions, never inferred automatically. Compensation remains unset if unknown; no currency conversion is implied.

Multi-select uses OR within each tag category and AND across categories. All typed words must occur somewhere in the candidate's recorded profile, notes, stage remarks, mapping evidence, linked search data or relevant audit history. Company filters include current company and saved historical mapping company snapshots. This is keyword search, not semantic AI search, and does not read unextracted attachment contents or recordings. Attachment text indexing/semantic retrieval remain roadmap work.

Data quality analyst is a new access role. Candidate Excel import is restricted server-side to this role or Super admin, including preview. Admin alone no longer has candidate Excel-import permission. All active workspace members may add candidates; editing, mapping and review retain their respective permissions. Data quality analysts may maintain profiles, tags, notes and files; sourcing still requires Researcher/team membership. Potential-to-be-a-client is an optional Yes/No field in Edit profile, with unknown displayed as Not recorded and actor/time provenance saved. No real accounts were assigned new permissions and no candidate records were bulk-retagged.

## Candidate profile simplification — 3 October 2026
The overview keeps current title/company/contact context, recorded profile dates, a compact search/status table, one bounded notes feed, all six editable tag categories plus mapped searches, documents and assessments. Imported sourcing markers, partner/member labels and stage-age detail are removed from the search summary; actual sourcing, engagement and search statuses remain separate. Search links still open their repositories. Stage activities live in History alongside audit events; interview feedback remains in Notes even if the interview also moved a stage. Nothing is deleted or reclassified in storage.

New notes require text with optional mapped-search and interview context; server-recorded author/added date are automatic. Legacy note types, original text, transcript summaries, links and CRM provenance remain stored. Existing transcripts still expand to their full text/summary. Assessment links retain their separate form. Notes and history are paginated, with three notes/five searches on the overview to keep large profiles bounded. Generic shell breadcrumbs/descriptions and repeated directory instructions are removed across pages; selected-search metadata, action constraints and warnings remain. Candidate counts use the current filtered set. Future Zyrus scores remain out of scope.

## Candidate spreadsheet refinement — 3 October 2026
Directory columns are first name, last name, company, LinkedIn icon and six independent tag dimensions (Industry, Geography, Seniority, Compensation, Function, Expertise/hot lists). Search counts and the combined Tags icon column are removed. Search Coverage is removed; Searches stays a top-level multi-select alongside Potential Client and free-text search. Tag filters live under their column headers and include Blank. Each category sorts globally before pagination using alphabetically ordered full values, with missing values last in either direction. Long cell values truncate with full-text hover titles, avoiding invented abbreviations. Names remain independently searchable/sortable. Search relationships remain on profiles.

Candidate filter panels render in a viewport-positioned portal rather than inside table scroll containers, reposition on scroll/resize, close on outside click/Escape, and retain searchable multi-select values. Other screens retain their existing filter presentation. No tag data, mappings or permissions are migrated.

## Compensation context and standardized geography — 3 October 2026
Compensation band remains an optional filterable tag. A separate Known Compensation Details card/modal captures free-form package and expectations (currency, base, OTE, bonus, equity/LTIP, current total and minimum next role) without inferring or overwriting a band. Blank is allowed. Updates use candidate version checks, existing profile-editor permissions, actor/time attribution and transactional audit. Details remain searchable and are included in generic candidate backups/exports.

Geography selects from standardized country/territory names plus existing regional options; users cannot create arbitrary new geography strings. Country codes and common aliases resolve to full names on save; existing values are not bulk-migrated. The table shows compact country codes (US, UK, FR, DE for Germany, GE for Georgia), with full-name hover text. Profile tags show full country/region names. Dropdown and free-text searches recognize codes and names. Existing US regional tags display US in the table while retaining the region in the full label/filter. Countries use platform Intl English display names from the explicit ISO code catalog in candidate-geography.ts; UK is the UI alias for GB. Compensation tags and other tag categories retain their prior select-or-add behavior.


## Smart city/state/country geography — 4 October 2026
Supersedes the country-only selector above. Type a city, state/province or country, choose a normalized suggestion, and retain the selected precision: `Lucknow, Uttar Pradesh, India`, `North Caldwell, New Jersey, United States`, or `United States`. The table abbreviates only the country suffix, never discards city/state; full labels remain on the profile and hover text. Geography filters offer saved locations plus their parent state/country; selecting a country includes its cities/states, while selecting a city does not include country-only records. Existing regional tags retain their detail.

Authenticated, debounced lookup searches a bundled CountryStateCity catalog (152,642 cities and 5,308 states/regions from pinned @countrystatecity/countries 1.0.9). Query terms stay in the app; no live external geocoder or API key is required. Names, state abbreviations and country codes are indexed; city searches use prefix shards and accent-insensitive matching. Users resolve ambiguous names; nothing is auto-selected. Countries and existing saved/master values remain usable even if a catalog asset fails.

The build creates publicly served, ODbL-attributed location-only shards with no candidate information. The authenticated Worker loads only the matching shard and state index through its ASSETS binding, with a bounded cache. Role checks, per-user/tenant throttling and session/tenant-bound one-hour HMAC selection proofs protect the existing versioned/audited tenant mutation. Caller-supplied verified values are stripped at the Worker boundary. No mass migration or automatic enrichment is performed. This is a pinned catalog, not live map data; rare/missing places or spelling variants may need a catalog update. Attribution, adapted data and license notice are available under /geography/. Source: https://github.com/dr5hn/countries-states-cities-database .
