# Engagement layout and monitor review continuity

Engagement now groups search selection and candidate-only lookup in one toolbar. Priority buttons use a compact horizontal layout; stage selection shares the view toolbar. Redundant mapping-count narration is removed. Candidate names sit next to LinkedIn icons. Explicit table columns keep both six-column search views and eight-column cross-search views aligned; rows and action icons are smaller.

Sourcing Monitor rate badges and attention labels wrap within their columns. The mapping eye action opens the existing ResearchPanel details/review forms in modal-only mode, without changing the application's page. Closing or completing review returns to the same cohort, preserving its scroll position. Cohort rows resolve current records after reload. Existing review authorization, optimistic versions and audit handling are reused.

Verification: TypeScript check, 374 tests, and production build passed. Regression checks cover table header/column/body alignment, candidate-only filtering, and modal-only mapping inspection scoped to its search. Existing review authorization and transactional tests passed. Signed-in browser visual verification was not available in this session; screenshots supplied by the owner informed the CSS corrections. Deployment status is verified separately through GitHub Actions and live asset checks.
