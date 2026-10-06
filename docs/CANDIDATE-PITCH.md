# Job description and Candidate pitch — 5 October 2026

Search repository displays Job description in place of Role brief. Existing brief records, documents, publication access and internal navigation IDs are preserved. Candidate pitch is a separate per-search internal text record, editable by any active workspace member, including founder and engagement roles. It does not change job-description publishing permissions or expose pitch text in candidate pages.

The editor supports 20,000 characters, attribution, saved edit history, unsaved-change warnings and version conflicts. A concurrent first save is rejected instead of overwriting another member's pitch. Pitch writes use the existing workspace transaction and immutable research/audit history.

Verification before commit: traced authenticated workspace routing and versioned research storage; inspected tab navigation and upload permissions. Added synthetic integration coverage for member roles, inactive membership, concurrent creation, stale updates, cross-search misuse, content limit, history and publication separation. Workflow typecheck, tests and build are mandatory before deployment. Signed-in browser verification was not performed.

Job description now shows only original-file upload and download. Removed webpage conversion, editing, preview, publishing and invitation controls from this repository section, including invitation-fetch requests. Existing uploaded files and backend publication records are preserved for future work. Updated the existing render test to verify the document-only UI.

Search strategy now places Edit strategy in the top-right header, with Save draft/Cancel in that same location while editing. Removed onboarding paragraphs and numbered training steps. Read mode separates Search approach from a compact criterion/requirement/weight table. Approval and tracking metadata remain visible; draft approval still uses existing permissions and validation. Target-company navigation is a compact footer. No strategy, scoring or approval data is rewritten.
