# XQtiv Search Operations

Internal sourcing operations application for XQtiv, designed with isolated organization workspaces for future multi-tenant use.

Target repository: https://github.com/XQtivconsulting/Search_Operations

**Status: local implementation, not deployed to the owner’s Cloudflare account.** The public target repository is readable, but a file write returned HTTP 403 Resource not accessible by integration. GitHub write access and Cloudflare deployment authorization remain required. No code or data was pushed to another repository or deployed to another account in this task.

## Included

- Invitation-based sign-in, organization membership and action permissions.
- Search portfolio, weekly priorities, daily team assignments and researcher output.
- Peer and partner approvals, immutable review events, correction/reopening history.
- Spreadsheet workspace: edit mapped counts, peer/partner approvals and daily targets; paste rectangular counts/notes from Excel; Tab/Enter navigation; selected-row fill; undo; explicit bulk save.
- Atomic batches up to 200 rows: a stale or unauthorized row rolls back the entire batch and its audit records.
- Productivity metrics with weighted approval ratios and estimated person-day effort.
- RecruitCRM job preview and selected import/update, with server-only tenant credentials and explicit field ownership. The connector has synthetic tests; it has not been connected to XQtiv’s live CRM.
- Read-only workbook extraction and source discrepancy inventory.

## Local setup

Use Node.js 24. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run dev`.

Cloudflare Wrangler emulates the Worker and SQLite Durable Objects locally. Development state lives in ignored `.wrangler/`. It is separate from production.

See [Deployment](docs/DEPLOYMENT.md), [Architecture](docs/ARCHITECTURE.md), [Workbook migration](docs/MIGRATION.md), [Verification](docs/VERIFICATION.md), and [Roadmap](docs/PRODUCT-PLAN.md).

## Boundaries

This is a sourcing pilot, not the entire long-term ERP. Advanced candidate records, strategies, target-company coverage, delivery, commercials, AI, password recovery/SSO, scheduled synchronization, pagination, and production recovery validation remain open. The spreadsheet is a bulk operational editor, not an Excel formula engine.

Customer workbooks, extraction data, tokens, invitations and generated dependencies must never be committed. The source archive excludes them. Cloudflare hosts the application and database; no additional infrastructure platform is required for this pilot. An email provider or managed identity provider is a later option for automated invitations, recovery and SSO.
