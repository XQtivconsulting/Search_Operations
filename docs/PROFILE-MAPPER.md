# XRP Profile Mapper

## Install and use
Download `/downloads/xrp-profile-mapper.zip` from the deployed app or Integrations → Profile Mapper. Unzip, open `chrome://extensions` (or `edge://extensions`), enable Developer mode and Load unpacked. Installation steps are in the package README.

Keep an XRP tab signed in. On a LinkedIn profile, open the extension, Connect to XRP, capture, edit the extracted details, choose an assigned open search or directory only, review matches and import. The popup displays the connected identity. New mappings are Draft. An existing candidate is reused without overwriting its fields; an existing mapping is returned rather than duplicated. The result opens the candidate in XRP, subject to page visibility permissions.

The extraction code is adapted from the supplied sample. Current title and company use the same current experience item. Capture remains best-effort, including names, multiple concurrent jobs, non-English layouts and partially loaded pages. Contact fields are manually editable. The API accepts location as unverified text; it does not claim geographic verification. Full work history is not imported.

## Session and authorization
The extension uses an isolated content script in the exact XRP origin to make same-origin requests with the existing HttpOnly session. It does not read or store the cookie, password or an API key. No bearer token, anonymous write endpoint, cross-origin CORS exception or shared credential is introduced. Chrome documents content-script requests as running on behalf of the page origin: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests

Each request authenticates the session against the selected workspace's current active membership and current role policy. The workspace rechecks active membership. Create requires `candidates.create`; mapping requires `candidates.add`; candidate reading requires `candidates.view`. Search selection is restricted to open searches where the user is partner, has a sourcing-team allocation, owns a target/task, or is Super Admin. Candidate IDs and company selections must belong to the server's current match results in that workspace. Actor, mapper, review status and tenant cannot be set by the submitted profile. Import uses the existing candidate-save/mapping-link domain functions inside one transaction, including audits and company/target creation.

The popup pins the account and workspace after connection. Every subsequent request carries X-Expected-User; account/workspace changes require reconnecting. Sign-out, session expiry, membership revocation or permission removal prevents subsequent unauthorized imports. A rate limit of 120 requests per member/window uses the existing Identity limiter.

## API
Same-origin cookie session and `X-Workspace` header are required. POST additionally requires same-origin Origin. The extension sends X-Expected-User for account consistency.

- GET `/api/profile-import/context`: connected actor, workspace, capabilities and eligible open searches.
- POST `/api/profile-import/preview`: `{candidate, searchId?}`; returns normalized candidate, exact/similar candidate matches, company matches and exact company ID. No business writes.
- POST `/api/profile-import/commit`: same input plus optional `candidateId`, `companyId`, `confirmNewCandidate`, `confirmNewCompany`. Returns `candidateId`, `mappingId`, `candidateCreated`, `mappingCreated`, `status`.
- Candidate fields: `firstName`, `lastName`, `linkedinUrl`, `currentTitle`, `company`, `location`, `email`, `phone`. First/last name and LinkedIn URL are required.

Commit recomputes all matches and permissions. Similar records require selection or explicit new-record confirmation. Normalized LinkedIn identity plus unique candidate/search mapping makes repeated commits safe. Neither previews nor extension storage grant authority. An archived candidate must be restored in XRP first.

The extension stores only the current profile draft locally, expires it on next open after 24 hours, restricts storage to trusted extension contexts, and offers Clear profile. It has no background crawler or remote telemetry. Popup imports are explicit user actions; no page-message handler can trigger them.

## Verification
Synthetic tests cover permission denial, revoked membership, unassigned searches, foreign IDs, canonical-URL reuse, repeat mapping reuse, no existing-profile overwrite, company matching and master/target creation, attribution, Draft status, same-origin enforcement and account switching. Full typecheck, tests and build are deployment gates. Browser installation and live LinkedIn extraction need a user-run acceptance check; no real profiles are written for testing.

## 2.0.1 connection recovery
Connect is explicit, single-flight, and reports progress/errors above the form. Discarded/frozen tabs prompt the user to open XRP. Injection does not wait for document idle; tab discovery, injection and network requests are bounded. Late injection after its deadline does not send a request. An import timeout reports an uncertain result and permits a duplicate-safe retry. Synthetic popup tests exercise hung injection, expired injection, fetch abort, successful retry and account pinning.

Capture now recognizes paragraph-based current Experience entries and falls back to explicitly displayed profile-header employment details when Experience is absent. Plain company link text is supported for numeric LinkedIn company IDs. Capture reports missing job fields. Synthetic extraction cases cover both layouts; the reported live profile has not been retested in Edge.

## 2.0.2 explicit destination
Destination appears above the profile fields and defaults to Into a search with no implicit search selection. Search imports require an authorized selection; directory-only imports require choosing that mode. Preview and success show the destination name/ID. Changing the destination invalidates the preview.

Open in separate window creates a movable/resizable extension window, carrying the current draft and destination choice (search is revalidated on connection). Capture reads the active profile in the originating browser window. Detached capture requests optional access only to LinkedIn; declining leaves the toolbar capture available. No automatic crawling or import is added. Native Edge window movement still needs a user acceptance check.

Capture also parses visible Experience text when stable DOM selectors fail, including ordinary and grouped employer layouts. It requires a current dated entry and ignores other profile sections and past-only roles. This is covered with synthetic text fixtures; the specific reported LinkedIn profile remains unverified.
