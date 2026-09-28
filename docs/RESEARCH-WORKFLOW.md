# Role research workflow

## Start here

1. In Workspace, create staff records and teams, then invite researcher accounts linked to those staff records. The account role and operating responsibilities remain separate. Researcher accounts create mappings under their own identity.
2. Open Teams to configure who reviews each researcher's work. Reviewer choices contain only active researchers from that team. Two-person teams pair automatically in both directions. For larger teams, choose a reviewer for each researcher. Pending reviews retain their assignee; use Reassign peer on a mapping to change it. No self-review or outside-team peer review is allowed.
3. In Searches or Integrations, assign the engagement partner. Open the role repository from Searches.
4. Save and approve the role brief and search strategy. Brief and strategy are text objects with drafts, retained approved content and an append-only revision history. Draft edits do not change the approved version.
5. Build the Company universe master list with optional metadata (company type, industries, offerings, specialties and geographies). Filter it and add selected companies to roles. In a role’s Target companies tab, only the company name is required; add a category, research scope, titles, priority, expected talent, team, researcher and due date later. Building the list does not require strategy approval. Researchers may add companies themselves or claim unassigned companies in their team. Company coverage is explicit; completion or no relevant talent requires notes.
6. Researchers add candidates under their companies individually or paste up to 100 tab-separated rows: name, title, LinkedIn URL, fit rationale. The whole batch fails on a duplicate or invalid row.
7. Submit individual or selected mappings. A designated peer approves, rejects, holds or requests information. Peer approval routes to the role's current engagement partner. Decisions are immutable events. Rejection requires a category and explanation.
8. Returned mappings appear in the researcher's My Work queue. Editing/reopening/resubmission preserves previous decisions. Reopened mappings restart peer review. Approvals/rejections may be reopened by a role manager with an explanation.

## Screens

- Role repository: brief, strategy, company universe, candidate mappings and results.
- My Work: upcoming planned work, owned company coverage, own drafts/returned mappings and assigned peer/partner reviews.
- Workflow Monitor: role/team/person/status filters, pending-stage age, mean review turnaround, submitted and approved counts, quality ratios and review bottlenecks; pairing configuration is in Teams.
- Spreadsheet: candidate-derived mapped/peer/partner numbers are read-only and link to the role's mappings. Planning targets remain editable.

## Identity, versioning and metrics

Candidate identity is reusable within the tenant and initially keyed by canonical LinkedIn profile URL (HTTPS, standard host, `/in/` path, no query or trailing slash). The same candidate can have one mapping per role, with independent rationale, owner and review state. Mapping rows retain submitted name/title/company snapshots. Company master identity initially uses a case/whitespace-normalized name; role-specific targets hold optional execution scope and reference the approved strategy revision when available. Existing targets retain their source revision as strategy drafts evolve.

The first strategy approval establishes a role's selected cutover date (today or later), using America/New_York. Existing manual mapped or review counts on or after that date block activation; choose a later start date to preserve those records. Drafts can be saved before cutover; submissions open on that date. Earlier aggregate history is retained. APIs reject manual output/review writes on or after cutover. No existing counts are automatically converted into synthetic candidates.

Submitted mappings count once per role/candidate regardless of resubmissions. Drafts do not count as output. Work date is the first submission date in US Eastern; team, staff and mapper attribution stay with that mapping. Derived rows group by role/team/staff/work date. They link to matching daily assignments when available; unplanned submissions still appear in the spreadsheet. Candidate-linked assignments cannot be removed.

Peer and partner approval rates in the new Results/Monitor views use currently decided mappings (Approve or Reject) at the corresponding stage; pending/hold/rework is separate. Firm-wide unique people deduplicate candidate IDs. Older portfolio reports retain explicitly labeled partner/mapped ratios. Stage age and turnaround are elapsed calendar time, never measured research hours. Researcher-days deduplicate person/date combinations with recorded output; no estimated effort hours are calculated. Targets continue to mean approved candidates.

## External brief

Publishing is an explicit action by a planner/admin or assigned partner. It creates an unguessable revocable bearer link to a fixed snapshot containing only title, client, approved brief text and revision. Anyone holding the link can read it; there is no client identity/login layer in this release. Publishing again invalidates the prior token. Editing or approving a new draft does not silently update an already-shared snapshot. Revoke removes public access. Internal strategy, candidate records and reviews are not part of the public response. All normal app routes remain authenticated.

## Boundaries

No LinkedIn scraping, automatic profile enrichment, candidate RecruitCRM writeback, attachment storage, client review portal or measured-time collection was added. Role documents are maintained as text; document uploads and reusable strategy templates remain future work. Existing authenticated state loading is retained; pagination and production hardening are separate work. No private role briefs, strategies, mappings or customer data are included in source control.

## Daily Work views

Choose Group by Team, Date, Week, Client, Role, Partner or No grouping. Sort any column header; filter team/partner and search for client, role or researcher. The layout is remembered for the signed-in user on that browser. Expand People to inspect researcher output and actions. Researcher-days are based on recorded output, including zero; they are not timesheets.

## Role-brief page design

The existing approved brief already publishes to a separate revocable page for candidates and clients. PDF/Word ingestion and the custom page design are pending the user's proposed example format. This release does not claim document conversion or upload support.
