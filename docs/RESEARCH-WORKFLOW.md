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

Teams has one designated lead. New submissions require that lead and enter Team review (the persisted legacy identifier remains Peer review). A lead may record the collective team's review of their own mapping; partner self-review is now allowed for the assigned search partner (3 October policy update). Changing the lead reroutes pending team reviews with version increments and audit records. Removing/transferring the lead requires first naming a replacement. Older individual routing records remain history but no longer determine new submissions. Researcher transfers update both rosters atomically with version checks, leaving past allocations/mapping attribution intact.

Hold is no longer offered or accepted as a review decision. Existing held mappings migrate to Needs information with audit preservation. Needs information returns to the mapper's editable queue and records requested information; resubmission runs evidence checks and returns through team review.

Company profiles accept known aliases. Mapping company suggestions match names and aliases from the first character. Exact aliases resolve to a canonical company; fuzzy matches require a user selection, never an automatic merge. Conflicting aliases across company masters are rejected. New companies still require explicit creation.

Candidate mappings show Mapping date (creation date), default latest first, and sortable candidate, date, mapper and status columns. Delivery Monitor uses Nothing needs attention instead of On track. Calendar display uses a named month (29 Sept 2026); date inputs retain native browser formatting and storage remains ISO.

## Fit criteria entry and justification
The strategy editor uses numbered criterion cards with a name and parameters/requirements, explicit Add and Remove controls, and no fixed criterion-count limit. Approved criteria appear directly in the new mapping form as well as draft editing and My Work. Draft evidence may be incomplete; submission requires a justification for every criterion, including an explanation for Not applicable. New mappings persist the approved requirement snapshot and evidence together. Additional details and review show the same criterion, requirement and justification layout. Draft strategy changes take effect only after approval.

## Researcher fit ratings
Each applicable criterion now has a researcher-entered 1–5 rating alongside justification: Does not fit, Limited fit, Partial fit, Meets requirement, Strong fit. Submission requires both; Not applicable requires explanation and is excluded from the average. Total fit is the equal-weight average out of 5, shown only after all applicable criteria are rated. No AI fit judgments or automatic review decisions are made.
Candidate mappings can sort by Total fit, filter for all criteria rated 4+, filter by overall average, or require a minimum rating on selected criteria. All-criteria filtering excludes N/A. Changed criterion IDs, names or requirements make historical mappings non-comparable to the current approved criteria; their saved evidence remains visible in Additional details. Missing historical ratings are not invented.

Mapping lists display 25 rows per page. My Work opens one selected mapping in a separate fit panel, with save/submit actions and unsaved-change protection; criterion fields are not repeated inside rows. New mapping entry starts collapsed. Repository sorting and fit filters apply across the entire result set before pagination.

## RecruitCRM refresh propagation
Refresh from RecruitCRM now updates title, CRM status and CRM-provided company/client name on searches already linked by CRM ID, in the same transaction as the fetched snapshot. Only changed searches receive a new version and audit entry. Missing company names preserve existing clients; jobs absent from a fetched snapshot are not deleted or inferred closed. New CRM jobs remain unadded until explicitly selected. Local engagement partners, planning, candidates, mappings and approvals remain untouched. The refreshed workspace state supplies the new names throughout repository, planning, work and performance screens.

## Weighted fit and comparison controls
Equal weighting remains the default for criteria without explicit weights. Custom weights use percentages from 0–100 and must total exactly 100% (within decimal precision) before saving; Distribute equally supplies a rounded total of exactly 100. Approval publishes the weights with the strategy. Total fit remains out of 5: sum(weight × researcher rating) / sum(applicable weights). Unrated applicable criteria leave the total incomplete. Explained N/A is excluded and remaining weights rescaled; N/A does not satisfy an individual criterion filter.
Mapping comparison uses current approved weights when saved criterion IDs, labels and requirements still match. Changing only weights recalculates totals without rewriting historical evidence; changing requirements makes the old assessment non-comparable. Additional details retain the submitted snapshot and its assessment weights.
The compact filter toolbar combines a minimum total with independent minimum ratings for selected criteria, using all/any matching. Sort by total, any individual criterion, date, candidate, mapper or status. Individual-criterion ties use weighted total descending. Selected/sorted criteria appear as compact rating columns. Filters and sorting apply before pagination. A single-search mapping list omits the redundant search column.

Weekly allocation cells now include a collapsed count of other tasks, with team color dots and expandable task/owner/status details. Search rows with tasks remain visible even when their sourcing decision is excluded, so preparation work is not hidden by Needs sourcing. Team badges separate team identity from decision backgrounds. Workload prompts consider distinct researcher allocations and unfinished tasks across teams, including work outside the current display filter; candidate-output entries are excluded. These are overlap/PTO checks, not duration-based overload estimates. Completed tasks remain visible but do not generate task-overlap warnings; cancelled tasks are excluded from the grid. The task list follows the team selector in team view.

## Candidate 360 and engagement

Engagement is a separate access role and separate set of teams (account-ID membership and designated leads, stored as engagement-team records). Existing sourcing teams and rosters are unchanged. Administrators enable Engagement in People & access; administrators configure engagement teams under Organization → Teams → Engagement teams. The search's existing partner remains the engagement partner throughout; there is no second partner assignment.

Partner approval transactionally creates a candidate handoff into the search’s shared engagement queue. Already-approved mappings also appear in the queue without rewriting old review history; first engagement action materializes their record. A planner or search partner assigns the search to one or more active Engagement members, under Engagement → Search assignments. Every selected member can work on every approved candidate in that search, including later handoffs. There is no candidate owner or candidate assignment. Team membership organizes people; search-level member assignments authorize engagement work. Removing a member from the search revokes that work access without changing historical interaction authorship. Reopened sourcing pauses further engagement writes until reapproval; reapproval preserves the existing journey and does not duplicate handoffs.

The navigation separates Research, Sourcing (Weekly plan, Delivery Monitor, Performance), Engagement (Search assignments, Daily Work, Pipeline, Interview tracker), and Organization (including Engagement Config). Pipeline offers a per-search Kanban and an all-candidate list. There is one workspace-wide ordered hiring/contact pipeline under Engagement Config, with stable stage IDs, editable labels/order/funnel groups and per-stage day thresholds. The detailed September stage list supplies defaults, including Assigned, contact-channel steps, engaged channels, screening, shortlist, client process, Placed, and Exited outcomes. No role-specific sequences are exposed or accepted; Daily Work derives activities from the global pipeline. Legacy sequence records are retained as history, not executed.

Admin configuration is versioned, restricted to administrators and audited. Existing candidates keep stage IDs when names/order/thresholds change. Occupied stages cannot be removed. Assigned is the first stage for every partner-approved handoff, including searches without engagement members. Legacy Ready records display as Assigned without rewriting history or resetting stage age. Search assignment never advances a candidate or resets their stage clock. No candidate owner is created. Ambiguous historical stages retain explicit legacy labels until deliberately moved, rather than inventing a contact channel.

Drag/drop opens the same note-and-stage editor as Move / add note, with no change until saved. Notes are required and stored with actor, dated activity, from/to stage, entry/exit timestamps and elapsed days. Stage age uses elapsed 24-hour days since the server-recorded transition; a backdated activity note does not backdate the transition. Same-stage notes do not reset age. Unknown historical timestamps show Stage age unknown. Configuration and candidate versions both protect against stale updates.

Active counts exclude Exited and Placed. Late stage counts include Shortlist and Client Process. Filters select funnel group, active/all/late/exited/placed, candidate name and threshold breaches. A threshold of zero disables flags; positive thresholds flag at or beyond that many days. Thresholds default to off until configured. Cards and list rows sort oldest stage age first. Board columns have independent scrolling and no 50-card truncation. No message sending, automatic follow-ups, email/LinkedIn connections or CRM candidate writeback are enabled.

Candidate 360 adds tags, immutable dated notes/interactions, transcripts, search journeys, sourcing/engagement history, authenticated file downloads, and external assessment links. Files (PDF/Word/Excel/text/email/audio, up to 5 MB) are privately stored as chunks with metadata; they are not parsed or automatically transcribed. Candidate file tables participate in future reset backups; no reset runs on deployment. Assessment execution remains a separate future module. Notes are not retroactively imported from RecruitCRM or email.

Sourcing and engagement lifecycles are independent: weekly Start/Continue/Pause/Stop decisions never gate engagement. Each new partner approval adds a handoff, even during a search with months of existing engagement. Overall CRM search statuses Closed, Abandoned, Cancelled/Canceled or Filled stop new engagement assignments and moves into further outreach stages; they do not rewrite candidate outcomes or erase history. Closed searches are excluded from the active queue unless included. Notes and exited/placed outcomes remain available after search closure. CRM refresh propagates that overall status through the existing integration.

## Client recommendations and interview tracker
Pipeline candidate search now trims and matches query words against name/company/contact fields and immediately shows a results list, including when no search is selected. The visible count and filter-reset action clarify matches hidden by stage/search filters. Clearing the query restores the selected board. Search status (CRM) is distinct from Engagement stage; Placed is also treated as a closed overall search status.

Engagement → Interview tracker provides a client-filtered, per-search or all-search grid, grouped by client and search, with R1–R6 initially and more rounds on demand (up to 50). Pipeline's Interview tracker link opens the current search. By default the grid includes manually recommended candidates, client-process/placed stages and candidates with interview records; Include candidates awaiting recommendation exposes earlier approved handoffs for data entry. The search-status filter defaults to Open; choose All or a specific CRM status to review historical searches.

The client is derived from the search, not independently duplicated on the candidate. recommended_on is an explicitly entered date per candidate/search journey and is never inferred from a Kanban transition. Moving into Recommended to Client requires that date; historical records remain blank until corrected. Date changes preserve stage age when the stage is unchanged and are versioned/audited.

Each round stores interview date, interviewer(s), status (Not started/Scheduled/Completed/Cancelled), explicit outcome (Pending/Progressing/Rejected), decision date and feedback. Completed with pending feedback is amber, Progressing is green, Scheduled blue and Rejected red; text labels accompany colors. Rejection requires an exited engagement stage and shows the rejected round/date in the grid. The editor selects Rejected by Client by default when available. Placement is the engagement stage, independent of interview completion and CRM status. No automatic success or placement is inferred from a completed interview.

Round updates use the same search-assignee/partner/planner authorization and engagement/mapping/configuration version checks as stage moves. Immutable candidate-activity and audit snapshots retain earlier feedback and corrections. Same-stage interview updates do not reset stage age. Closed searches block new scheduled interviews but permit historical feedback and final outcomes. Existing rounds and recommendations are preserved when changing stages. No live candidate or interview records are created for QA.

## Candidate profile and search filters
The candidate profile opens on Candidate notes. Search participation, Attachments, Assessments and History have separate tabs. Notes and audit history are collapsed by default, paginated ten per page, with Collapse all; transcripts have a separate full-text disclosure. Tags are static labels, not actions. Assessment uploads (including .xlsx and .xls) are stored privately as attachments and are not parsed or executed. Existing assessment links remain available.

Pasted transcript notes generate up to five ranked source excerpts locally. New notes save the excerpt summary with `summary_method: source-excerpts-v1`; existing transcripts derive it when displayed without rewriting immutable records. This is an extractive summary, not external AI interpretation, transcription, candidate assessment or fact verification. The original transcript remains complete.

Pipeline and Interview tracker use Search status (CRM), defaulting to Open. Options include All and each actual imported status, with Opened/Open and Canceled/Cancelled aliases. This filter is independent of candidate engagement stage. A single hierarchical Candidate funnel filter combines active, late-stage and individual funnel groups. Engagement teams now live beside Sourcing teams under Teams; People & access remains the single account directory. Engagement Config only configures the global pipeline.

## Shared Team review (October 2026)
Team review is a shared stage for active researchers currently in the mapping's sourcing team, the search's assigned engagement partner, and workspace super admins. Ordinary admins/planners, unrelated partners and engagement-only members do not gain team-review rights from those roles alone. Team members may record the team's decision even on their own mapping. Team lead designation is optional and does not gate submission or restrict pending reviews. Existing pending mappings follow the same shared permission rule without a data migration.

Submission enters Team review with no individual reviewer assignment. The actual reviewer ID, name snapshot and timestamp are saved when the decision is made; the immutable review event records actor, decision, notes and before/after states. Approval only advances to Partner review. Formal partner approval still belongs to the search's assigned partner, allows review of their own mappings, and separately triggers engagement handoff. The same partner can create a mapping and perform both stages in two explicit, audited actions. Stale concurrent reviews are rejected transactionally. Current team membership is checked at action time, so removed team members lose shared-review access. My Work and repository actions use the same shared eligibility predicate as the server.


## Engagement Daily Work
Daily Work summarizes assigned searches with active candidates, new handoffs today, due/overdue activities, incoming mappings awaiting partner approval, unscheduled work and green Placed totals. Open CRM searches are the default; managers can view all and engagement members start with their assigned searches. Counts open one compact candidate list, paginated at 25. Search assignment remains separate from candidate stage; unassigned searches are explicitly labeled.

Assigned points to the first Outreach step; each Outreach step points to the next configured Outreach step using its editable action label (for example Send email 1). The current stage's threshold determines when that activity is due. The last Outreach step asks for a response/outcome decision and never assumes the candidate responded. Every Engaged channel prompts arranging screening; Screening prompts reviewing the result for shortlist. Shortlist prompts recommendation/client follow-up. Client Process remains flagged until manually progressed; same-stage notes do not reset its clock. Placed and Exited have no thresholds.

Thresholds use elapsed 24-hour days, including weekends: at the configured day the activity is due, and on later elapsed days it is overdue. Zero disables scheduling; unknown historical age remains unknown. New today uses the application's America/New_York reporting date. Existing configured thresholds are preserved; no values are invented. The Daily Work Record activity button opens the existing version-protected note/stage editor; only saving records a manual transition. No automatic messages, stage transitions or individual candidate assignments occur. Closed searches and reopened sourcing mappings are excluded from actionable work; placed outcomes remain available when viewing their CRM search status.

## Candidate profile cards — 3 October 2026
Candidate profiles now open on a compact Overview with separate Search, Interview notes, General notes and Stage updates cards; tags, documents and assessments sit in a supporting column. Overview shows two notes per section and two searches; focused notes paginate five per section and search/history views paginate ten. Each note shows its author, interaction date and search context. Note bodies and full transcripts remain collapsed until opened, and sections can collapse independently.

Interview and screening types, structured interview rounds and explicitly classified interview transcripts appear in Interview notes. Existing unclassified transcripts remain General notes; no historical content is guessed or rewritten. New notes can select Interview notes or General notes. Actual pipeline transitions populate Stage updates automatically. An interview update that also changes a stage is visible in both relevant sections, referring to the same immutable activity. Same-stage general notes are not stage transitions. Assessment files and links remain separate.

Search cards show Search status, Sourcing status and Engagement status separately. Without a handoff, engagement says Not started, with Awaiting sourcing partner approval as the prerequisite; sourcing still shows its actual current stage. Rejected sourcing and missing approved handoffs have explicit explanations. Closed searches retain the candidate's actual engagement outcome, with an additional closure note. Reopened sourcing displays Paused. These display changes do not advance workflows or alter review permissions.

## Individual mapping review actions — 3 October 2026
Pending mappings expose an explicit Team review or Partner review action on each row and in View details. The individual dialog identifies the candidate and review stage, shows the evidence and records Approve, Reject or Needs information through Save review decision. Team approval advances to partner review; partner approval triggers engagement handoff. Bulk actions require every selected mapping to be eligible, with selected/reviewable/submittable counts shown.
Policy updated by the owner on 3 October 2026: the assigned search partner may review their own mapping even if they also performed team review. This applies to individual and bulk review, including linked staff identity. Partner review permission and search assignment remain required; both review stages remain separate, version-protected and audited. The row and details panel enable Partner review without a self-review warning or partner reassignment. Existing pending mappings immediately follow this rule; no migration or automatic decisions occur.
