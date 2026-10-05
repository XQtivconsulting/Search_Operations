# Collapsible application navigation

The shell defaults to a 64px icon rail (56px on small screens), freeing content width across the application. Icons retain accessible names, hover titles and an active-page marker. Expand navigation reveals the existing grouped menu and workspace/account details. Selecting a page collapses the menu unless pinned; Escape also collapses an unpinned menu. Keep navigation open persists a browser-local display preference. Explicit Collapse also unpins. No permissions or business data change.

At mobile widths the expanded menu overlays content rather than squeezing it. The icon rail remains visible. Shell styling is scoped to the application sidebar so candidate details and other aside panels are unaffected. Navigation scrolls independently, leaving expand and account actions reachable on shorter screens.

Actual local verification: typecheck, all 288 existing tests and production build passed on 5 October 2026. Deployment and live verification are recorded separately.
