# Compact search settings

Search settings now uses an explicitly sized 560px responsive dialog instead of the shared table-popup width. Form fields stack consistently. The takeover checkbox has a fixed 16px control beside a wrapping label, preventing inherited table/input rules from separating them across the dialog. Save actions align right. Popup accepts an optional scoped class without changing its default layout.

Validation: typecheck, full suite and production build are required for this release. Screenshot inspection identified the layout problem; authenticated visual verification is unavailable. Search management behavior and permissions are unchanged.
