# Candidate current title — 5 October 2026

The shared Add candidates form now includes an optional Current title field beside company details. It participates in unsaved-change tracking and is cleared after saving. Existing candidates display their shared title read-only, like name and company; profile edits remain in Edit profile.

The mapping-inline API now forwards the title to mapping-add, which already stores it on new candidate profiles and mapping snapshots. Existing candidate titles are preserved. The candidate directory's New candidate form already included Current title and is unchanged.

Verification: inspected the full form-to-API-to-candidate persistence path. Extended existing synthetic integration tests to assert the saved candidate and mapping title and preservation when reusing a candidate. Added title presence to the existing form-render check. Typecheck, full tests and build run as mandatory workflow gates before deployment; their result is tracked with the deployment run. Signed-in browser verification was not performed.
