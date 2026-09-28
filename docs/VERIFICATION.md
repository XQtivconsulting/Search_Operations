# Verification status

## Completed

- TypeScript checking, 25 automated tests and the Vite production build pass locally.
- Bulk-write tests cover rollback, audit records, permissions, optimistic versions, review locks and clipboard handling.
- CRM company tests cover paginated exact-slug name joins, hostile company pagination, automatic client creation/update, and preservation of existing client names when absent. Workspace fixtures exercise migration from the prior staging schema.
- CRM tests cover configuration formats, tenant isolation for plain-token fallback, pagination, hostile URLs, access errors, timeouts, invalid responses, staging and selected apply.
- The edge transport regression test executes the actual CRM and email adapters inside workerd via Miniflare. Synthetic responses avoid external traffic and real credentials. It verifies supported Request options and rejection of redirects without forwarding credentials.
- Root cause reproduced: workerd rejects redirect mode `error` before network dispatch. Both adapters now use `manual` and reject redirect responses.
- The application has been deployed to the owner's Cloudflare account through GitHub Actions. The first-administrator setup page was checked in the browser, and the owner confirmed signing in.
- Setup tests cover secret rejection, concurrent first-admin invitation prevention and denial after an existing membership.

## Still unverified

- Live company-name retrieval and the compact sortable preview have not been verified in an authenticated browser; no authenticated session or RecruitCRM secret was read from the user's browser.
- Invitation inbox delivery after the transport fix.
- Full authenticated persona walkthrough, backup restoration, load testing and independent security review.
- Historical workbook migration: source inspection is complete, but no spreadsheet data was imported by this build.

The runtime tests use synthetic provider responses and do not claim live API success.
