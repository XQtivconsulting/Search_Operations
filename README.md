# XQtiv Search Operations

Internal sourcing operations application for XQtiv, designed with isolated organization workspaces for future multi-tenant use.

Target repository: https://github.com/XQtivconsulting/Search_Operations

**Status: sourcing pilot implementation.** Source upload to the designated repository is authorized and working. Cloudflare deployment is performed by GitHub Actions using the owner-provided repository secrets. Check the latest workflow result before assuming a live deployment exists. The live workspace now contains owner-entered business data.

## Included

- Invitation-based sign-in, protected workspace super admin and multiple roles per person. People & access shows accounts, invitations and unlinked researcher records.
- Optional Resend invitation email with explicit delivery status and private-link fallback; requires Worker email configuration.
- Native search creation alongside RecruitCRM imports; reusable target-company and coverage cloning; weekly priorities, daily team assignments and researcher output.
- Search repositories with versioned briefs/strategies, company ownership, reusable candidates, per-search mappings, team/partner review, My Work queues and workflow monitoring. See [Research workflow](docs/RESEARCH-WORKFLOW.md).
- Candidate-derived daily output and original job-description document storage.
- Peer and partner approvals, immutable review events, correction/reopening history.
- Candidate directory: required first/last names and unique LinkedIn identity, optional contact details, reusable across searches with independent mapping ownership and review history. Manual count entry and spreadsheet navigation are retired.
- Atomic batches up to 200 rows: a stale or unauthorized row rolls back the entire batch and its audit records.
- Performance: researcher/team throughput and quality comparisons, search effort/yield, and plan-based person-days with PTO exclusions. See [Performance](docs/PERFORMANCE.md).
- RecruitCRM job preview and selected import/update, with server-only tenant credentials and explicit field ownership. The connector is in use with XQtiv; job-by-job staged candidate, note and hiring-history import is available.
- Read-only workbook extraction and source discrepancy inventory.

## Local setup

Use Node.js 24. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run dev`.

Cloudflare Wrangler emulates the Worker and SQLite Durable Objects locally. Development state lives in ignored `.wrangler/`. It is separate from production.

See [Deployment](docs/DEPLOYMENT.md), [Architecture](docs/ARCHITECTURE.md), [Workbook migration](docs/MIGRATION.md), [Verification](docs/VERIFICATION.md), and [Roadmap](docs/PRODUCT-PLAN.md).

## New search pages and company imports

- Search repository → Job description: upload and download original Word/PDF files. Webpage creation and publishing controls have been removed. Older candidate invitation endpoints retain security checks while they remain in the server.
- Company universe → Import Excel: regular XLSX imports with preview, duplicate matching and tag union. Profiles support public website/LinkedIn/revenue suggestions and manual edits.
- Target companies: role-specific research waves, including bulk wave assignment.
- Account settings: self-service password changes with current-password verification and revocation of other sessions.

See [Research workflow](docs/RESEARCH-WORKFLOW.md) for usage and limits.

## Boundaries

This is a sourcing pilot, not the entire long-term ERP. Attachments, reusable strategy templates, downstream delivery, commercials, AI, password recovery/SSO, scheduled synchronization, pagination, and production recovery validation remain open. Prior aggregate counts remain stored as history; current screens calculate progress from candidate mappings.

Customer workbooks, extraction data, tokens, invitations and generated dependencies must never be committed. The source archive excludes them. Cloudflare hosts the application and database. Resend is optional for invitation delivery; recovery and SSO remain future work.

See [People, permissions and candidate identity](docs/ACCESS-AND-PEOPLE.md) for the current account and navigation model.

## Engagement pipeline

Engagement opens one workspace with priority counts (active, overdue, due today, new handoffs, awaiting sourcing approval and unscheduled), a per-search summary, and candidate List/Kanban views. Counts filter these views in place; scope and filters are shared. See [Unified engagement](docs/ENGAGEMENT-UNIFIED.md). Engagement → Search assignments assigns searches to shared engagement members. Organization → Engagement Config configures one global hiring/outreach pipeline, funnel groups and aging thresholds. Organization → Teams manages sourcing teams. Engagement resources are assigned directly to searches; per-funnel allocations and engagement teams are retired. Organization → People & teams → Roles & permissions manages configurable role templates. See [Configurable roles](docs/CONFIGURABLE-ROLES.md). See [Research workflow](docs/RESEARCH-WORKFLOW.md) for movement history, permissions and sourcing/engagement separation.

Engagement → Interview tracker adds a client/search/candidate grid with manually entered recommendation dates, interview rounds, dated outcomes and feedback. Pipeline candidate search immediately displays matching results even without a selected search. CRM search status and engagement stage are labeled separately.

## SaaS and continuity foundations
Organization → Backups & exports provides workspace-owner downloads of master XLSX datasets, per-search XLSX workbooks, attachments and a checksummed business snapshot. Weekly copies use an optional private R2 binding and per-workspace alarms; the UI explicitly reports when storage is not connected. This is not a full identity backup or a claim of complete disaster recovery. See [SaaS and recovery](docs/SAAS-AND-RECOVERY.md) for scope, verification requirements, multi-tenant launch gaps and RecruitCRM historical conversion planning.

