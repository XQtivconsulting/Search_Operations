# Test relevance review — 2026-10-08

Reviewed the complete test inventory against the current screens, server routes, imported-data requirements and role master. Passing a suite is not evidence that an authenticated browser workflow works.

## Removed

22 obsolete cases were deleted, rather than renamed as compatibility tests:

| Area | Removed | Reason |
| --- | ---: | --- |
| Daily Work | 4 | The standalone screen and its grouping helper are not used by the current app. |
| Previous delivery monitor calculations | 9 | The live DeliveryMonitor uses sourcing-monitor.ts, not delivery-monitor.ts. Its current rendering check remains. |
| Previous Workflow Monitor | 2 | The old screen and workflow-summary helper are not wired into navigation. Company search coverage remains. |
| Manual-count write workflow | 4 | HTTP entry/review writes are retired. Testing successful direct writes bypassed the real API. Retained HTTP rejection and historical-count preservation checks. |
| Old search-age helper | 1 | No live caller; current monitor aging is covered with its actual calculations. |
| Old profile suggestion helper | 1 | No live caller; current AI synthesis and evidence validation remain tested. |
| Old hierarchical funnel helper | 1 | No live caller; unified Engagement filters and cohort reconciliation remain tested. |

## Corrected

- Replaced the test requiring Planner/Founder access to survive retirement. The role master now excludes retired definitions even when historical assignments exist.
- Added an Identity integration case for existing Researcher + Planner assignments, custom role assignment and refusal to assign Planner. Current master permissions determine effective access.
- Extended the no-login researcher HTTP case through save, GET state, edit, GET state and rendering the real researcher table. It failed before the state-filter fix and passes after it. No invitation method is available in this fixture.
- Team-lead rendering checks now use the current TeamsPanel instead of the unused PeerSetup component. Removed the obsolete DailyWork render assertion.
- Workload tests call the live workloadIndex entry point, not its unused wrapper.
- Removed stale initialView/onAllocate props from the current monitor render test and corrected the misleading planner-owned search-creation test name.

## Retained deliberately

Current search/candidate/company/import/planning/engagement/interview behavior; authorization and tenant isolation; unique IDs and candidate identities; optimistic versions and transaction rollback; backups and restore; date, location and document parsing; bounded performance work; current UI rendering and navigation.

Historical-data checks remain where they protect records that can still exist: prior funnel assignments, old count records, search ID backfill, imported mappings, original review dates and backup restoration. Older role-publication/candidate-invitation security tests remain because those server routes still exist even though publishing controls were removed. Deleting their security tests without retiring their endpoints would remove useful coverage.

## Limits and verification

Synthetic SQLite/HTTP integration and React static rendering are automated. These are not authenticated end-to-end browser checks. The researcher case covers the actual response filtering that caused the missing row, plus the component rendering that response. No production employee records, invitations or credentials are used. Typecheck, the revised automated suite and the production build passed locally. Deployment is checked separately.

## File inventory after review

Each remaining file was checked for current behavior, retained security/data compatibility, or updated as described above.

| Test file | Cases | Disposition |
| --- | ---: | --- |
| access-management-ui.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| access-policy.test.ts | 3 | Retained: current behavior or active security/data integrity requirement |
| backups.test.ts | 12 | Retained: current behavior or active security/data integrity requirement |
| bulk.test.ts | 42 | Retained: current behavior or active security/data integrity requirement |
| candidate-directory.test.ts | 6 | Retained: current behavior or active security/data integrity requirement |
| candidate-import.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| candidate-polish.test.ts | 5 | Retained: current behavior or active security/data integrity requirement |
| candidate-profile.test.ts | 4 | Retained: current behavior or active security/data integrity requirement |
| candidate-smart-search.test.ts | 3 | Retained: current behavior or active security/data integrity requirement |
| candidate-summary.test.ts | 3 | Updated; obsolete assertions removed or workflow coverage corrected |
| company-coverage.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| company-directory.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| company-logo.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| company-profile.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| company-search.test.ts | 1 | Updated; obsolete assertions removed or workflow coverage corrected |
| crm-conversion.test.ts | 4 | Retained: current behavior or active security/data integrity requirement |
| crm-view.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| delivery-monitor.test.ts | 1 | Updated; obsolete assertions removed or workflow coverage corrected |
| document-layout.test.ts | 6 | Retained: current behavior or active security/data integrity requirement |
| domain.test.ts | 4 | Retained: current behavior or active security/data integrity requirement |
| edge-transport.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| engagement-assignment.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| engagement-daily.test.ts | 7 | Retained: current behavior or active security/data integrity requirement |
| engagement-overview.test.ts | 7 | Retained: current behavior or active security/data integrity requirement |
| engagement-workspace.test.ts | 8 | Retained: current behavior or active security/data integrity requirement |
| filter-position.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| filter-values.test.ts | 3 | Retained: current behavior or active security/data integrity requirement |
| fit-score.test.ts | 5 | Retained: current behavior or active security/data integrity requirement |
| geography.test.ts | 5 | Retained: current behavior or active security/data integrity requirement |
| historical-import.test.ts | 22 | Updated; obsolete assertions removed or workflow coverage corrected |
| icon-action.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| import-files.test.ts | 3 | Retained: current behavior or active security/data integrity requirement |
| interview-form.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| invitation-email.test.ts | 4 | Retained: current behavior or active security/data integrity requirement |
| mapping-review.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| navigation-history.test.ts | 4 | Retained: current behavior or active security/data integrity requirement |
| operation-permissions.test.ts | 4 | Retained: current behavior or active security/data integrity requirement |
| performance-index.test.ts | 3 | Retained: current behavior or active security/data integrity requirement |
| performance.test.ts | 13 | Updated; obsolete assertions removed or workflow coverage corrected |
| plan-workload.test.ts | 2 | Updated; obsolete assertions removed or workflow coverage corrected |
| planned-effort.test.ts | 5 | Retained: current behavior or active security/data integrity requirement |
| planning-updates.test.ts | 3 | Retained: current behavior or active security/data integrity requirement |
| profile-filters.test.ts | 2 | Updated; obsolete assertions removed or workflow coverage corrected |
| recruitcrm.test.ts | 6 | Retained: current behavior or active security/data integrity requirement |
| reporting-period.test.ts | 3 | Retained: current behavior or active security/data integrity requirement |
| research.test.ts | 95 | Updated; obsolete assertions removed or workflow coverage corrected |
| role-page.test.ts | 4 | Retained: current behavior or active security/data integrity requirement |
| role-policy-store.test.ts | 2 | Updated; obsolete assertions removed or workflow coverage corrected |
| search-decisions.test.ts | 3 | Retained: current behavior or active security/data integrity requirement |
| search-number-migration.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| search-picker.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| search-setup.test.ts | 5 | Retained: current behavior or active security/data integrity requirement |
| search-template.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| setup.test.ts | 26 | Updated; obsolete assertions removed or workflow coverage corrected |
| sourcing-monitor.test.ts | 6 | Retained: current behavior or active security/data integrity requirement |
| strategy-criteria.test.ts | 4 | Retained: current behavior or active security/data integrity requirement |
| submission-readiness.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
| table-sort.test.ts | 1 | Retained: current behavior or active security/data integrity requirement |
| team-review.test.ts | 2 | Retained: current behavior or active security/data integrity requirement |
