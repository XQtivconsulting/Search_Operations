# Deployment into XQtiv’s account

Use only the owner’s Cloudflare account and `XQtivconsulting/Search_Operations`. The local build has no Cloudflare account ID or credentials configured. Do not use another account as a fallback.

## GitHub

Grant the connected GitHub app access to the specified repository. Inspect its existing contents and instructions before merging this source package. Do not overwrite unrelated work. Keep the repository private unless the owner explicitly chooses otherwise.

## Cloudflare

1. On an authorized developer machine, install Node.js 24 and run `npm ci`.
2. Run `npx wrangler login` and approve access using the owner’s Cloudflare account. Verify the account with `npx wrangler whoami`.
3. Run `npm run typecheck`, `npm test`, and `npm run build`.
4. Run `npx wrangler deploy`. The configuration creates the Worker and SQLite-backed Identity and Workspace Durable Object classes. No separate database service is required.
5. Record the resulting workers.dev URL. Test sign-in, origin protections and unauthenticated API denial before onboarding.

For GitHub-based deployments, configure repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, scoped to the owner’s account. The Deploy workflow runs on main pushes and can also be run manually. Tokens belong in secret settings, never source files or chat messages.

## First administrator and workbook

Provision only after confirming the deployment URL and intended account. Set a temporary random `SETUP_KEY` using `npx wrangler secret put SETUP_KEY`. The setup endpoint can create the first invitation for the empty `xqtiv` workspace and optionally import the reviewed extraction.

The supplied `scripts/bootstrap.mjs` reads `APP_URL`, `SETUP_KEY`, `ADMIN_EMAIL`, and `ADMIN_NAME` from the local environment. Set `WORKBOOK_JSON` only when importing the inspected extraction. It saves the invitation in ignored `private-data/administrator-invitation.txt`; it does not email anybody or choose the administrator’s password.

Run `node scripts/bootstrap.mjs`, then immediately run `npx wrangler secret delete SETUP_KEY`. Verify POST /api/setup returns 404. Open the private invitation yourself, choose your password, and invite colleagues from Workspace. Link researcher users to the correct imported staff record. Do not regenerate invitations or replay provisioning casually.

## RecruitCRM

Set Worker secret `RECRUITCRM_TOKENS` with a JSON object keyed by workspace, for example `{"xqtiv":"YOUR_TOKEN"}`. Use `npx wrangler secret put RECRUITCRM_TOKENS` and enter the actual value through the secure prompt. Do not put a real value in this document.

An administrator opens Integrations, fetches a preview, verifies CRM IDs and local matches, supplies client names for new jobs, and applies selected changes. The first connector handles job titles/status only. Candidate handoff and outreach summary synchronization remain future work. A live API check has not been run.

## Production gates

Before wider use: configure account recovery, exercise backups/restoration, verify authenticated browser workflows for every role, review accessibility, test two tenants through the real Worker, and assess expected concurrency. A local test pass is not production certification.

## Troubleshooting

- Repository 404: verify spelling and connected GitHub app access, including organization authorization.
- Wrangler unauthenticated: authorize the correct Cloudflare account; a separate browser login does not authorize Wrangler.
- Bulk conflict: no rows were saved. Preserve intended edits, discard/reload current records, then reapply.
- CRM rate limit: wait and retry; the staging snapshot changes only after the full fetch succeeds.
- CRM duplicate ID: reconcile the local search identities before applying; no fuzzy merge is performed.
- Existing workspace import denied: do not clear the database. Plan an incremental migration.
