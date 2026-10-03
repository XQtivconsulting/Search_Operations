# SaaS, security and recovery — 3 October 2026

## Direction
XQtiv is one tenant of a product intended for other executive-search firms. Workspace super admin means owner of ONE firm, never platform administrator. Subscription billing and commercial launch are future milestones. Do not market this build as independently security-audited, zero-downtime, or validated for thousands of tenants.

## Current evidence and gaps

| Control | Current evidence | Remaining work |
| --- | --- | --- |
| Tenant data separation | Separate SQLite Workspace Durable Object per tenant; Worker authenticates active membership before selecting that object. Synthetic foreign-tenant export denial test. | Full multi-tenant browser/API penetration suite, per-tenant quotas and load tests. |
| Identity and roles | Shared identity service; tenant-specific roles, audited member edits, protected workspace owner, hashed passwords, secure session cookies and server action checks. | MFA/SSO, password recovery, session management, platform-operator role distinct from customer admins. |
| Tenant onboarding | Platform-secret setup additionally permits explicitly allowlisted TENANT_SETUP_IDS. Members with access to multiple workspaces can switch them in the UI. | Tenant registry/names/branding, idempotent onboarding, offboarding, billing, subscription entitlements and lifecycle. No public self-signup enabled. |
| Portable business data | Owner-only ZIP with master XLSX, one XLSX per search, original attachments and checksummed JSON. Raw SQL row IDs retained. | Chunking beyond current 16 MB snapshot bound; incremental exports and volume tests. |
| Weekly copy | Private R2 binding, per-workspace durable alarm, complete manifests and upload verification; one-hour retry and visible failures. | Must verify live binding/first copy. Monitoring outside app and independent-provider copy still required. |
| Restore | Offline utility refuses an existing target path; restores into new local SQLite with checksum and reference checks. Synthetic round-trip test includes attachments. | Timed staging/cloud restore drill, protected identity backup, credential recovery, approved production cutover. No browser overwrite/restore endpoint. |
| Releases | Tests/typecheck/build in deployment; serialized releases. | Staging, migration gates, protected release environments, independent approval, tested code rollback. |
| Abuse/security | Same-origin writes, role enforcement, bounded streamed JSON, generic unexpected errors, HSTS/CSP, throttled identity actions and bulk export. | Distributed rate limits/WAF, attachment malware scanning, dependency/security scans, external review. |
| Scale/availability | Per-firm databases isolate business records. | Shared identity service capacity, server pagination, snapshot memory, background queues, monitoring and disaster exercises. |

## Backup contract
- Business export is not a credential/full infrastructure backup. Includes operational tables, research objects/events, audits, strategy and brief data, file metadata/chunks, people directory (no password fields) and original files.
- Excludes passwords, sessions, API secrets, active candidate invitation/access capabilities and prior reset archives. Authenticated identity and business databases are separate; the directory and workspace snapshot are not a cross-database atomic transaction. Previous reset archives remain in the original database and are not duplicated recursively.
- Candidate contact details are exported; a separate client/contact master has not yet been implemented. Search workbooks include search-scoped notes; candidate-global notes remain in the master workbook. JSON retains the complete data and original associations.
- Excel cells are explicit strings; formula-looking values never become formulas. Long text is continued on numbered source-row/text-part rows. JSON is the authoritative recovery representation.
- Weekly schedule: Sunday 06:00 UTC, including daylight-saving changes in local display. Every workspace arms its own alarm when accessed with the BACKUPS binding present. A never-accessed/unprovisioned workspace is not automatically discovered. Failures retry in one hour; successful runs resume weekly. Owner can run/download on demand.
- Private object path: `business-backups/<authenticated-tenant>/<timestamp>-<uuid>.zip`, paired with a final `.manifest.json`. No public buckets, URLs, email attachments or GitHub artifacts. Downloads always construct the tenant prefix server-side.
- Deployment verifies R2 public development/custom domains are disabled. It uses only the owner's existing Cloudflare deployment credentials. Failure to enable a new binding leaves the UI explicitly disconnected. Failure to verify an existing binding stops deployment, preserving production. Do not remove an existing binding to get a deployment through.
- Storage is outside the database but inside the same Cloudflare account/provider. An owner-downloaded/off-provider copy is required for provider/account loss. No independent copy has been configured yet. No auto-deletion/retention lifecycle is enabled; establish policy and storage budget before scale.
- At most 7 days of business updates can be absent from a weekly copy. Weekly Excel exports are continuity assets; use more frequent recovery protection for core operations. Cloudflare documents 30-day point-in-time recovery for SQLite Durable Objects, but account settings and an actual recovery drill must be verified before relying on it.

## Recovery procedure
1. Identify incident time, affected tenant, last verified copy and writes after it. Preserve the failing deployment and logs. Avoid resetting live data.
2. Download the tenant ZIP/manifest from the private bucket using the owner's Cloudflare account if the app is unavailable. Check the ZIP SHA-256 against the manifest before extraction.
3. Extract `business-snapshot.json` into a protected local directory. Run with Node 24:
   `node --import tsx scripts/restore-business-backup.ts /private/business-snapshot.json EXPECTED_TENANT /private/NEW.sqlite`
4. This creates only a new local database and fails if the destination exists, tenant/checksum is wrong or references are broken. Credentials and memberships are NOT restored into Identity. Review `people` for identity reconciliation; do not grant roles automatically from an uploaded export.
5. Reconcile record counts, per-search mappings, pipeline stages, notes and attachment hashes. Reissue candidate access links; existing sessions/tokens must not be revived.
6. For an actual service restoration, restore Identity and Workspace into an isolated cloud environment under an independently reviewed runbook, test access/isolation, reconcile any post-backup work, then approve cutover. That cloud/identity restoration automation is not in this release.

## RecruitCRM historical migration plan
The current connector imports/refreshes job metadata and company labels. It does not yet import historical candidate journeys. Official RecruitCRM documentation describes candidates, notes and candidate-job pipelines; exact API coverage, pagination, attachments and historical transition timestamps must be tested against the tenant's licensed account.

| Source data | Destination / rule |
| --- | --- |
| Companies and client contacts | Canonical company IDs and contact records; preserve source IDs/relationships. Contacts need a first-class destination model. |
| Candidates, emails, phones, LinkedIn | Candidate master keyed by provider + external ID. Exact LinkedIn/email conflicts go to review; no name-only merge. Preserve missing identifiers without creating fake LinkedIn URLs. |
| Candidate-job assignments | Independent per-search journeys, with original job/candidate IDs and provenance. Reconcile existing local mappings before import. |
| Current hiring stage | Explicit stage-ID mapping per source pipeline. Similar display names do not establish equivalence; unknown stages block apply. |
| Notes/transcripts | Immutable imported interactions preserving source author, source date and source ID; distinguish global candidate notes from search-specific notes. Plain text only; never execute imported HTML. |
| Prior transitions/interviews/recommendations | Import only dates and events actually supplied by source. Missing stage-entry date remains unknown; import date must not start a fictional historical clock. |
| Resumes/attachments | Allowlisted downloads, MIME/size checks, content hashes and malware scanning; preserve links until verified transfer completes. |

Migration workflow: inventory and counts → read-only staged extraction → identity conflict report → reviewed stage mapping → one-search dry run → reconciliation → explicit selected apply → repeatable batches and cutover. Persist an import batch ID and source object IDs; reruns must not duplicate profiles, notes or transitions. Protect locally enriched fields and flag conflicts instead of overwriting. Imported engagement journeys must be labeled as imported, not fabricated partner approvals; exclude them from current researcher throughput/quality unless explicitly reconciled. Preserve real historical authors without giving them accounts or access.

API limitations may require RecruitCRM export files or a vendor-assisted extract. Reading only the current stage does not recreate the complete transition history. Billing/data retention/consent policy and tenant-specific CRM secret storage belong in the SaaS readiness work before external onboarding.

## Sources verified during design
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/r2/buckets/create-buckets/
- https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/domains/subresources/managed/methods/list/
- https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/domains/subresources/custom/methods/list/
- https://help.recruitcrm.io/en/articles/10352856-advanced-analytics-data-dictionary
- https://help.recruitcrm.io/en/articles/9010668-how-to-view-the-candidate-hiring-pipelines-for-jobs-in-recruit-crm
