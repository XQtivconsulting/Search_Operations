# Pipeline scrolling

The desktop Pipeline view fits within the viewport: the header, filters, search context and view controls remain above a single scrollable board. Horizontal overflow stays inside the board instead of widening the application frame. Candidate columns grow with their cards rather than adding independent scrollbars. Stage headings remain sticky while the board scrolls vertically. Earlier stages and Later stages buttons provide horizontal navigation; the focusable board also supports native keyboard scrolling. The list uses the same bounded content area.

Small screens and short windows retain document scrolling so wrapping controls cannot become inaccessible. The board remains contained and prevents scroll chaining. Other engagement screens and My Work are not locked to this desktop layout. Candidate filters, stages, permissions and records are unchanged.

Verification: typecheck, complete synthetic test suite and production build are run before deployment; live overflow and scrolling checks follow deployment.

Empty stages are hidden by default based on the current candidate filters. Show empty stages reveals available drop destinations; Move / add note continues to offer every configured stage. No candidate records are hidden by this column setting.
