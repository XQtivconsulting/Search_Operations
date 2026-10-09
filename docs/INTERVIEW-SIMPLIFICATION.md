# Interview entry simplification

The round editor contains status, interview date, outcome when completed, cancellation date when cancelled, interviewer names, and optional interview notes. Recommendation, engagement-stage, note-date and outcome-date inputs are removed. Existing interviewer data and feedback remain available; saving with blank notes does not erase earlier feedback. Outcome and activity dates are recorded automatically when the corresponding update occurs. Existing explicit historical outcome dates remain supported by the API.

Interview saves preserve the current engagement stage, its clock, and recommendation date even if an older client submits different values. Rejection no longer requires an exited stage. The tracker keeps inline recommendation-date editing. Save & open Kanban saves first, then selects the same search and candidate, clearing unrelated engagement filters. Failed saves remain in the editor.

Verification: typecheck, 376 tests and production build passed. Regression coverage includes optional notes at the API, separate stage/recommendation handling, cancellation-date validation, prior-feedback preservation, round isolation, automatic activity dating and status-dependent fields. Existing assignment, authorization, optimistic-version and closed-search tests passed. Signed-in browser visual verification was unavailable; deployment is checked independently via Actions and live assets.

Interviewer(s) restored to the shared round editor and included explicitly in tracker saves. Existing round names prefill the field; tracker cells label the name as Interviewer. Status-dependent fields and separate stage/recommendation updates remain unchanged.
