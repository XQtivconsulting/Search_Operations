# Role research workflow

## Role management

Use Role Repository to choose roles, filter by the latest fetched RecruitCRM status, edit an engagement partner and manage research. Searches is no longer a separate navigation item. Integrations has separate Save partner and Add / update selected in repository actions. Saving a partner on an unimported CRM job does not create a workspace role, and survives later CRM fetches. Status is read from the latest fetched RecruitCRM snapshot; there is no automatic polling. Remove role from workspace is available to planners/admins for mistaken additions only when no research, planning, publication or invitation history exists. It does not delete the RecruitCRM job. Roles with history are retained and can be filtered using their CRM status.

## Start here

1. In People & access, start with an existing person and enable Researcher alongside their other roles. Link an existing unlinked researcher record or create one for that same person. Invite only people who do not already have accounts. Then use Teams to manage rosters.
2. Open Teams to configure who reviews each researcher's work. Reviewer choices include unactivated teammates; submission requires an active linked account for the selected reviewer. Two-person teams pair automatically in both directions. For larger teams, choose a reviewer for each researcher. Pending reviews retain their assignee; use Reassign peer on a mapping to change it. No self-review or outside-team peer review is allowed.
3. In Searches or Integrations, assign the engagement partner. Open the role repository from Searches.
4. Save and approve the role brief and search strategy. Brief and strategy are versioned objects with drafts, retained approved content and an append-only revision history. Draft edits do not change the approved version.
5. Build the Company universe master list with optional metadata (company type, industries, offerings, specialties and geographies). Filter it and add selected companies to roles. In a role’s Target companies tab, only the company name is required; add a category, research scope, titles, priority, expected talent, team, researcher and due date later. Building the list does not require strategy approval. Researchers may add companies themselves or claim unassigned companies in their team. Company coverage is explicit; completion or no relevant talent requires notes.
6. In My Work → Add mapping, choose the client/role and your team, enter a LinkedIn profile, and add first/last names for a new candidate. Existing profiles are reused. Email, phone, title and company are optional. A draft may omit fit evidence, but submission requires it. Mappings can also be added from an assigned target company or Candidates → Map to role.
7. Submit individual or selected mappings. A designated peer approves, rejects, holds or requests information. Peer approval routes to the role's current engagement partner. Decisions are immutable events. Rejection requires a category and explanation.
8. Returned mappings appear in the researcher's My Work queue. Editing/reopening/resubmission preserves previous decisions. Reopened mappings restart peer review. Approvals/rejections may be reopened by a role manager with an explanation.

## Screens

- Role repository: brief, strategy, company universe, candidate mappings and results.
- My Work: upcoming planned work, owned company coverage, own drafts/returned mappings and assigned peer/partner reviews.
- Workflow Monitor: role/team/person/status filters, pending-stage age, mean review turnaround, submitted and approved counts, quality ratios and review bottlenecks; pairing configuration is in Teams.
- Candidates: one master profile with all mapped clients/roles, researchers and independent research-review statuses. Click a mapped role to open its repository.
- People & access: accounts of all roles, invitations and unlinked planning records.
- Teams: roster and peer-review setup only.
- Manual spreadsheet/count entry and import reconciliation are retired from navigation. Daily Work and Performance use candidate-derived output; historical counts remain stored.

## Identity, versioning and metrics

Candidate identity is reusable within the tenant and initially keyed by canonical LinkedIn profile URL (HTTPS, standard host, `/in/` path, no query or trailing slash). The same candidate can have one mapping per role, with independent rationale, owner and review state. Mapping rows retain submitted name/title/company snapshots. Company master identity initially uses a case/whitespace-normalized name; role-specific targets hold optional execution scope and reference the approved strategy revision when available. Existing targets retain their source revision as strategy drafts evolve.

The first strategy approval establishes a role's selected cutover date (today or later), using America/New_York. Existing manual mapped or review counts on or after that date block activation; choose a later start date to preserve those records. Drafts can be saved before cutover; submissions open on that date. Earlier aggregate history is retained. APIs reject manual output/review writes on or after cutover. No existing counts are automatically converted into synthetic candidates.

Submitted mappings count once per role/candidate regardless of resubmissions. Drafts do not count as output. Work date is the first submission date in US Eastern; team, staff and mapper attribution stay with that mapping. Derived rows group by role/team/staff/work date. They link to matching daily assignments when available; unplanned submissions still appear in Daily Work. Candidate-linked assignments cannot be removed.

Peer and partner approval rates in the new Results/Monitor views use currently decided mappings (Approve or Reject) at the corresponding stage; pending/hold/rework is separate. Firm-wide unique people deduplicate candidate IDs. Older portfolio reports retain explicitly labeled partner/mapped ratios. Stage age and turnaround are elapsed calendar time, never measured research hours. Researcher-days deduplicate person/date combinations with recorded output; no estimated effort hours are calculated. Targets continue to mean approved candidates.

## Candidate role pages

In Role repository → Role brief, use Upload PDF / Word (10 MB maximum). The browser automatically formats source text into a long-scroll webpage with a document title, section headings, paragraphs and lists. A new upload clears every previous field, including partner/video links; neither role metadata nor chat content is added. The preview opens immediately. Save draft and Publish page stay in the action bar. Publish page atomically saves, approves and publishes the current preview. Optional video/booking links and layout adjustments are under a collapsed control. Uploading or saving a draft alone never changes the published page. Document-only wording is checked against the extracted source. Pages created by the earlier converter must be regenerated from the original file before using the new Publish action. Document images and exact original layout are not preserved; scans require OCR outside this app. Original documents and video binaries are not stored.

Select a candidate mapped to this role, confirm their email, choose expiry (1–30 days) and send an invitation. The candidate receives a link and requests a six-digit code sent only to that invited email. Codes expire after 10 minutes, allow five attempts and are single-use. Verified sessions last at most eight hours and cannot outlive the invitation. Revoke blocks active sessions immediately. Re-inviting a candidate revokes their earlier invitation. Unpublish revokes all role invitations. Active invitations see the current explicitly published revision.

Only planners/admins and the assigned engagement partner can publish or invite. Private strategy, mappings, review records and internal notes are excluded. Token/code hashes and candidate sessions stay in private tenant tables, outside workspace state. Legacy anonymous brief URLs no longer grant access. A video provider independently controls access to its hosted video; use suitable provider privacy settings.

## Boundaries

No LinkedIn scraping, candidate RecruitCRM writeback, original attachment storage, client review portal or measured-time collection was added. Reusable strategy templates remain future work. Public company lookup supplies suggestions, not guaranteed enrichment. Existing authenticated state loading is retained; pagination and production hardening are separate work. No private role briefs, strategies, mappings or customer data are included in source control.

## Daily Work views

Choose Group by Team, Date, Week, Client, Role, Partner or No grouping. Sort any column header; filter team/partner and search for client, role or researcher. The layout is remembered for the signed-in user on that browser. Expand People to inspect researcher output and actions. Researcher-days are based on recorded output, including zero; they are not timesheets.

## Regular Excel company imports

Company universe → Import Excel offers a downloadable blank workbook with Companies and Instructions tabs, column definitions, sample rows and a three-step walkthrough. Only Company is required; the remaining columns are optional. It accepts .xlsx files with 1–1,000 data rows and a 10 MB limit. Choose the worksheet and header row, then map columns; Company and Relevant Tags are recognized automatically, including offset columns. Preview before saving. Repeated rows merge by normalized name, exact website hostname or canonical LinkedIn company URL. Ambiguous or contradictory identities stop the import. Tags are combined case-insensitively. Blanks never erase values; populated scalar fields are preserved unless the replace option is checked. The company-list version signature prevents applying a stale preview. Matching is deterministic, not fuzzy: review subsidiaries and aliases carefully.

Company profiles support website, LinkedIn, revenue with currency, year and source. Find public company details queries Wikidata; choose the correct suggested entity to fill missing fields, then save. Existing values stay intact and all fields remain manually editable. Coverage is incomplete, especially for private companies; no URLs or revenue are invented. Public lookup requires working outbound access to Wikidata and is not a bulk paid enrichment service.

## Research waves

Set a wave when adding selected master companies to a role, or select targets in Role repository → Target companies and set their wave together. Wave 1 precedes wave 2, etc. Targets sort by wave and company. These are role-specific sequencing labels, not hard workflow gates, and do not replace researcher/team ownership, coverage or optional priority.

## Password changes

Every signed-in user has Account settings → Change password. Supply the current password and confirm a new 12–128 character password. The change applies across that user's workspaces, replaces the current session and revokes all older sessions. Password recovery remains a separate future feature.


## Correcting researchers and reviewer setup

People & access → Researchers without an account lets administrators edit a researcher's name and optional contact email, before or after account activation. Save researcher keeps the same staff ID, assignments and history. Contact email is a directory field; it does not replace the account email or change a previously sent invitation.

Archive removes a researcher from all current team rosters and future roster choices, with version checks and audit records. It preserves assignments, mappings and reviews. Show archived researchers → Restore makes the record available again; add it back to the appropriate teams. Account access and outstanding invitations remain separate. Use Manage accounts to revoke access where appropriate.

Reviewed by lists all other researchers in the same team, even without accounts. Selecting a name saves immediately with a confirmation. A selected reviewer must have exactly one active linked researcher account before work can be submitted; the app reports what is missing rather than silently selecting someone else. Teams with a single active alternative can still pair automatically if no explicit pairing is saved. Existing pending reviews retain their reviewer.

For an unaccepted invitation with a misspelled email, cancel the pending invitation and invite the correct address against the same researcher record. Sending a replacement invalidates the earlier invitation link for that researcher. An already-linked staff record cannot receive a second account through invitation.

Active users change their own sign-in email in Account settings: enter the new address and current password, send a code, then enter the six-digit code from the new inbox within ten minutes. The change preserves identity and workspace memberships, signs out other sessions and notifies the old address. Verification requires configured email delivery; no verification code is returned to the browser. Admins can edit directory contact details but cannot overwrite another person's sign-in identity.


The current multi-role access and account-switching rules are documented in [People and access](ACCESS-AND-PEOPLE.md). Candidate outreach stages are intentionally deferred; research-review status belongs to each mapping, not to the shared candidate.

## Company discovery and monitoring

Company universe supports keyword phrases over stored names, industries, offerings, specialties and tags, with a small explicit synonym dictionary. This is local metadata matching, not external AI enrichment. Check companies across filtered results and add up to 100 to a selected role. Existing role targets are excluded. Role Target companies separates Team from Researcher and provides Assign researcher with active roster validation.

Workflow Monitor summarizes each search: submitted and approved mappings, completed company scope, companies with submitted mappings, review queues and bottlenecks. Direct mappings without a target are identified separately. Links open detailed coverage/assignments or candidate mappings in the role repository.

## Candidate spreadsheet import and mass role assignment

Candidates → Import Excel accepts the first worksheet of .xlsx files, up to 500 data rows and 5 MB. Required headers: First Name, Last Name, LinkedIn URL. Optional: Email, Phone, Title, Company, Rationale. A downloadable CSV header template can be filled in Excel and saved as .xlsx; phone columns should be text.

Preview lists new candidates, reused canonical LinkedIn profiles and duplicate file rows. Existing profile details are not overwritten. Optionally select a role and your research team to create direct mapping drafts; no target-company coverage is inferred from company names. Alternatively select candidates in the directory (or select filtered results) and Assign selected to role. Mapping requires Researcher access and active membership in the selected team, and is attributed to the current user. Existing mappings to that role are skipped, while other role relationships are retained. Drafts still require fit evidence and normal peer/partner review.

All writes and audit records are atomic. A stale preview requires a fresh preview; validation failures leave no partial imports or mappings. Candidate contact corrections remain in Edit candidate.

## Accepted accounts only

Invite colleagues in People & access, wait for acceptance, enable Researcher and select their team in Teams. Role Target companies then offers active researchers in that team. No unlinked planning-person creation or pre-acceptance peer pairing is available. When a team has no eligible accounts, the researcher selector explains the setup required.

## Role-first My Work and inline mappings

My Work defaults to today's date in US Eastern and shows role/team allocations for the signed-in researcher. Open Work on role to enter candidate mappings and see company coverage within that role. Include other roles on my plate exposes assigned-company and own-mapping roles without a plan for the selected date. There is no separate top-level company-assignment list. Pending reviews remain accessible from the personal review queue.

New mapping uses one inline row: first name, last name, LinkedIn URL and current company. Existing LinkedIn profiles reuse master details; candidate names link to a full profile with email, phone, title, company and all mapped roles. Company autocomplete matches master names; Add company is explicit when no match exists. A new role/company target is created with the researcher as owner when necessary. An existing company assigned to another researcher is not reassigned; a mapping can remain direct. Completed owned targets must be reopened before additional mappings. Drafts do not count as submitted output, and marking company research done does not approve candidates. Fit evidence and normal review gates remain required.

Daily Work expansion controls say Show/Hide researchers with the count. Missing partners and teams have explicit labels. Historical entries whose staff identity is unavailable display Removed user; historical output is not deleted.

Target companies supports checked multi-select and Assign selected companies: choose team and accepted researcher once, then save an atomic version-checked batch (up to 100). Completed targets must be reopened before bulk reassignment. Claim is renamed Assign to me; an unassigned company can use the researcher's unique team from role planning, or their sole team, otherwise an explicit team selection is required. An explicit existing company team is always respected.

Coverage outcomes include Research complete and Complete — no relevant talent found. Both count as completed company coverage, independently of candidate approvals. Completion snapshots record researcher and team attribution; reopening clears completion until the work is finished again. Workflow Monitor highlights no-talent outcomes; Performance adds a separate researcher/team/role company-coverage table. Completed targets show Research complete and View / reopen coverage instead of a repeated assignment action.

## Search setup and team review (September 2026 update)

Search repository replaces the Role repository navigation label. Role brief offers original PDF/Word storage and download (5 MB maximum, .pdf/.docx/.doc), independent of optional web page conversion/publication. Original file chunks are tenant-local, authenticated and included in reset backups. Web conversion still requires selectable PDF text or .docx; original .doc/scanned files can be stored without conversion. Published candidate pages use the existing invitation controls and a restrained white document layout.

Search strategy has dynamic criteria with stable IDs, labels and requirement descriptions. Draft changes become active only on approval. Mapping submission validates evidence for every currently approved criterion, including an explanation for not applicable; the mapping snapshots those criteria and their revision. Reviewers see that evidence. Job-related experience, location and qualifications are supported; age-based screening is not.

Teams has one designated lead. New submissions require that lead and enter Team review (the persisted legacy identifier remains Peer review). A lead may record the collective team's review of their own mapping; partner self-review remains prohibited. Changing the lead reroutes pending team reviews with version increments and audit records. Removing/transferring the lead requires first naming a replacement. Older individual routing records remain history but no longer determine new submissions. Researcher transfers update both rosters atomically with version checks, leaving past allocations/mapping attribution intact.

Hold is no longer offered or accepted as a review decision. Existing held mappings migrate to Needs information with audit preservation. Needs information returns to the mapper's editable queue and records requested information; resubmission runs evidence checks and returns through team review.

Company profiles accept known aliases. Mapping company suggestions match names and aliases from the first character. Exact aliases resolve to a canonical company; fuzzy matches require a user selection, never an automatic merge. Conflicting aliases across company masters are rejected. New companies still require explicit creation.

Candidate mappings show Mapping date (creation date), default latest first, and sortable candidate, date, mapper and status columns. Delivery Monitor uses Nothing needs attention instead of On track. Calendar display uses a named month (29 Sept 2026); date inputs retain native browser formatting and storage remains ISO.

## Fit criteria entry and justification
The strategy editor uses numbered criterion cards with a name and parameters/requirements, explicit Add and Remove controls, and no fixed criterion-count limit. Approved criteria appear directly in the new mapping form as well as draft editing and My Work. Draft evidence may be incomplete; submission requires a justification for every criterion, including an explanation for Not applicable. New mappings persist the approved requirement snapshot and evidence together. Additional details and review show the same criterion, requirement and justification layout. Draft strategy changes take effect only after approval.

## Researcher fit ratings
Each applicable criterion now has a researcher-entered 1–5 rating alongside justification: Does not fit, Limited fit, Partial fit, Meets requirement, Strong fit. Submission requires both; Not applicable requires explanation and is excluded from the average. Total fit is the equal-weight average out of 5, shown only after all applicable criteria are rated. No AI fit judgments or automatic review decisions are made.
Candidate mappings can sort by Total fit, filter for all criteria rated 4+, filter by overall average, or require a minimum rating on selected criteria. All-criteria filtering excludes N/A. Changed criterion IDs, names or requirements make historical mappings non-comparable to the current approved criteria; their saved evidence remains visible in Additional details. Missing historical ratings are not invented.

Mapping lists display 25 rows per page. My Work opens one selected mapping in a separate fit panel, with save/submit actions and unsaved-change protection; criterion fields are not repeated inside rows. New mapping entry starts collapsed. Repository sorting and fit filters apply across the entire result set before pagination.
