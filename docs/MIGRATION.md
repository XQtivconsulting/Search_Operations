# Uploaded workbook inspection

Source: Master Sourcing Dashboard TG(1).xlsx. SHA-256: `4a50a9943a2fc31505a8fa20d67ebbb9bbf19c3a5c833692ed622d79cf3bccf5`.

The workbook was read without modification. All twelve tabs were inspected. Extraction found 109 CRM jobs, 286 dated sourcing sessions from 6 April to 25 September 2026, 28 source staff names and 11 team/day combinations with multiple sessions. The raw extraction remains private and is excluded from source control.

There are 84 cached aggregate discrepancies, eight non-monotonic review-count entries and 14 unmatched search rows. Master List contains 109 broken-reference formulas. Recompute arithmetic totals from individual observations while preserving cached source values and discrepancy records. Do not infer correct values for contradictory approval counts. Missing counts remain null, not zero; missing staff names remain explicitly unattributed. Never fabricate candidate records from aggregate counts.

The previously inspected pilot used a different workbook fingerprint and recorded 300 sessions including future-dated planning. This upload is not identical and must not replace another dataset automatically. No production data was imported, overwritten or deleted in this task.

Run `python scripts/inspect_workbook.py PATH_TO_WORKBOOK --output private-data`. Python and openpyxl are required for this offline utility. It writes an inspection summary and private extraction JSON. The import endpoint is restricted to an empty workspace; it rejects duplicate hashes and populated workspaces. An incremental importer for later workbook versions remains to be built.

## RecruitCRM job-by-job conversion — 3 October 2026
In Integrations, refresh RecruitCRM jobs to capture their source slugs, then use **Import candidates by search**. Choose one CRM-linked repository search, fetch the preview, inspect identity matches/counts, confirm every hiring-stage match, and explicitly import that search. No mass candidate import or CRM writes occur. Recent previews resume fetching or applying after an interruption. Candidate application is atomic per candidate; already completed candidates remain when a later candidate fails, and resume skips them.

The adapter uses the official `GET /v1/jobs/{job}/assigned-candidates`, `GET /v1/notes/search?related_to={candidate}&related_to_type=candidate`, `GET /v1/jobs/{job}/stage-history/{candidate}`, and optional `GET /v1/users/search` endpoints. Pagination is restricted to the same origin/path and candidate filters. Redirects, failed/partial pages and malformed data never count as an empty successful import. Current limits: 20 pages / 2,000 records per endpoint, 1.5 MB per response, and 1 MB staged details per candidate. Rate limits pause work for a later resume.

Candidate matching uses provider slug, exact normalized LinkedIn, or exact email with matching name; never name alone. Conflicting identifiers stop apply for review. Missing LinkedIn is retained as missing, keyed by CRM identity. Existing populated profile fields are preserved; missing fields are filled. Existing local mappings and engagement stages are retained. New mappings use **Imported**, without fabricated sourcing reviews, researcher identity, submission date, person-days or throughput. Imported journeys can progress through normal engagement authorization, and preserve the API's real stage-entry date; missing dates remain unknown.

Notes retain original author name when available (otherwise original author ID), source ID, timestamps and CRM job associations. Imported content is rendered as text. Interview/screening note types appear under Interview notes; other notes under General notes. Job hiring history appears under Stage updates. Global notes are not falsely assigned to a job. Repeated note versions/transitions are deduplicated; edited source notes create a preserved revision rather than overwrite prior history. Stable candidate identity is shared across searches. Staging tables are included in reset and business backup/restore coverage, subject to the existing backup size limits.

Scope: candidates **currently assigned** to the selected job, including exited hiring statuses; their candidate notes and the selected job's available hiring-stage history. Historical unassignments, email threads, call logs/recordings, resumes and other attachment bytes are not included in this release. Imported profile fields cover name, email, phone, LinkedIn, current company and title; the original assignment payload is retained in the private staging record. User-defined stage labels must map explicitly to the global engagement configuration; exact unique label matches are suggested, never silently inferred from fuzzy labels. Search CRM status remains separate from candidate hiring stage.

Official references inspected:
- https://docs.recruitcrm.io/docs/rcrm-api-reference/6388403858e87-assigned-candidates-for-job
- https://docs.recruitcrm.io/docs/rcrm-api-reference/e4221a8c0e6ac-stage-history-of-candidate-for-job
- RecruitCRM API Endpoints → Notes → Search for notes; Users → Search for Users.
