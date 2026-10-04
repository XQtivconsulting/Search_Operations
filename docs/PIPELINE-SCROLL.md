# Pipeline scrolling

The desktop Pipeline view fits within the viewport: the header, filters, search context and view controls remain above a single scrollable board. Horizontal overflow stays inside the board instead of widening the application frame. Candidate columns grow with their cards rather than adding independent scrollbars. Stage headings remain sticky while the board scrolls vertically. Earlier stages and Later stages buttons provide horizontal navigation; the focusable board also supports native keyboard scrolling. The list uses the same bounded content area.

Small screens and short windows retain document scrolling so wrapping controls cannot become inaccessible. The board remains contained and prevents scroll chaining. Other engagement screens and My Work are not locked to this desktop layout. Candidate filters, stages, permissions and records are unchanged.

Verification: typecheck, complete synthetic test suite and production build are run before deployment; live overflow and scrolling checks follow deployment.

Empty stages are hidden by default based on the current candidate filters. Show empty stages reveals available drop destinations; Move / add note continues to offer every configured stage. No candidate records are hidden by this column setting.

## Actual verification — 4 October 2026

Typecheck, all 248 tests and production build passed. Deployment run 37176904456 succeeded for d53f4b1d8f7210303d17a801b4ed4e342067f676. Live read-only checks on the Birlasoft Texas Energy search confirmed 77 cards in 7 populated columns; enabling Show empty stages displayed 27 columns and retained 77 cards. At 1363 × 936, document dimensions matched the viewport exactly. The board handled horizontal navigation (scrollLeft 724) and keyboard vertical scrolling (scrollTop 370) while document scrollTop remained 0. Columns have visible overflow and no independent scrolling. Visual inspection confirmed the controls and horizontal scrollbar remain accessible. No candidate records were changed.
