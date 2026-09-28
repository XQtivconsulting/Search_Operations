# Uploaded workbook inspection

Source: Master Sourcing Dashboard TG(1).xlsx. SHA-256: `4a50a9943a2fc31505a8fa20d67ebbb9bbf19c3a5c833692ed622d79cf3bccf5`.

The workbook was read without modification. All twelve tabs were inspected. Extraction found 109 CRM jobs, 286 dated sourcing sessions from 6 April to 25 September 2026, 28 source staff names and 11 team/day combinations with multiple sessions. The raw extraction remains private and is excluded from source control.

There are 84 cached aggregate discrepancies, eight non-monotonic review-count entries and 14 unmatched search rows. Master List contains 109 broken-reference formulas. Recompute arithmetic totals from individual observations while preserving cached source values and discrepancy records. Do not infer correct values for contradictory approval counts. Missing counts remain null, not zero; missing staff names remain explicitly unattributed. Never fabricate candidate records from aggregate counts.

The previously inspected pilot used a different workbook fingerprint and recorded 300 sessions including future-dated planning. This upload is not identical and must not replace another dataset automatically. No production data was imported, overwritten or deleted in this task.

Run `python scripts/inspect_workbook.py PATH_TO_WORKBOOK --output private-data`. Python and openpyxl are required for this offline utility. It writes an inspection summary and private extraction JSON. The import endpoint is restricted to an empty workspace; it rejects duplicate hashes and populated workspaces. An incremental importer for later workbook versions remains to be built.
