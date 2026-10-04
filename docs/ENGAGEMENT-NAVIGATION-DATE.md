# Engagement navigation and recommendation date

Display names: Daily Work becomes Work Queue, Pipeline becomes Candidate Pipeline, and Organization becomes Admin. Internal navigation identifiers remain stable. Both engagement page headings use the display names.

The stage editor shows Date recommended to client only when the selected stage ID is recommended. Previously recorded dates remain in editor state and the existing save payload; other stage changes do not clear them.

Actual verification — 4 October 2026: typecheck, all 250 tests and production build passed. Deployment runs 37177981636 and 37178069408 succeeded. Live read-only checks confirmed both navigation labels and headings, plus Admin. Opened a stage editor, observed no recommendation date for Assigned, selected Recommended to Client and observed the date field, switched back to Assigned and observed its removal, then cancelled without saving. No candidate data changed.
