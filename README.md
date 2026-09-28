# XQtiv Search Operations

Internal sourcing operations application for XQtiv, designed with isolated organization workspaces for future multi-tenant use.

Target repository: https://github.com/XQtivconsulting/Search_Operations

**Status: sourcing pilot implementation.** Source upload to the designated repository is authorized and working. Cloudflare deployment is performed by GitHub Actions using the owner-provided repository secrets. Check the latest workflow result before assuming a live deployment exists. No customer data has been imported by this build.

## Included

- Invitation-based sign-in, organization membership and action permissions.
- Optional Resend invitation email with explicit delivery status and private-link fallback; requires Worker email configuration.
- Search portfolio, weekly priorities, daily team assignments and researcher output.
- Role repositories with versioned briefs/strategies, company ownership, reusable candidates, per-role mappings, peer/partner review, My Work queues and workflow monitoring. See [Research workflow](docs/RESEARCH-WORKFLOW.md).
- Candidate-derived daily output and revocable client-safe approved brief links.
- Peer and partner approvals, immutable review events, correction/reopening history.
- Spreadsheet workspace: edit mapped counts, peer/partner approvals and daily targets; paste rectangular counts/notes from Excel; Tab/Enter navigation; selected-row fill; undo; explicit bulk save.
- Atomic batches up to 200 rows: a stale or unauthorized row rolls back the entire batch and its audit records.
- Productivity metrics with weighted approval ratios and researcher-day counts.
- RecruitCRM job preview and selected import/update, with server-only tenant credentials and explicit field ownership. The connector has synthetic tests; it has not been connected to XQtiv’s live CRM.
- Read-only workbook extraction and source discrepancy inventory.

## Local setup

Use Node.js 24. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run dev`.

Cloudflare Wrangler emulates the Worker and SQLite Durable Objects locally. Development state lives in ignored `.wrangler/`. It is separate from production.

See [Deployment](docs/DEPLOYMENT.md), [Architecture](docs/ARCHITECTURE.md), [Workbook migration](docs/MIGRATION.md), [Verification](docs/VERIFICATION.md), and [Roadmap](docs/PRODUCT-PLAN.md).

## Boundaries

This is a sourcing pilot, not the entire long-term ERP. Attachments, reusable strategy templates, downstream delivery, commercials, AI, password recovery/SSO, scheduled synchronization, pagination, and production recovery validation remain open. The spreadsheet is a bulk operational editor, not an Excel formula engine.

Customer workbooks, extraction data, tokens, invitations and generated dependencies must never be committed. The source archive excludes them. Cloudflare hosts the application and database. Resend is optional for invitation delivery; recovery and SSO remain future work.
