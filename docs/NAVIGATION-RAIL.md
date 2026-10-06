# Collapsible application navigation

The shell defaults to a 64px icon rail (56px on small screens), freeing content width across the application. Icons retain accessible names, hover titles and an active-page marker. Expand navigation reveals the existing grouped menu and workspace/account details. Selecting a page collapses the menu unless pinned; Escape also collapses an unpinned menu. Keep navigation open persists a browser-local display preference. Explicit Collapse also unpins. No permissions or business data change.

At mobile widths the expanded menu overlays content rather than squeezing it. The icon rail remains visible. Shell styling is scoped to the application sidebar so candidate details and other aside panels are unaffected. Navigation scrolls independently, leaving expand and account actions reachable on shorter screens.

Actual local verification: typecheck, all 288 existing tests and production build passed on 5 October 2026. Deployment and live verification are recorded separately.

Collapsed navigation also displays a high-contrast label beside each icon on pointer hover or keyboard focus. Labels render outside the scrolling rail, and dismiss on Escape, scroll or navigation.

## Pinned navigation and dialogs

The shared modal backdrop now sits above both desktop and compact-screen sidebar layers. Previously its z-index was 5 while the sidebar was 20/40, allowing pinned navigation to cover modal content. This covers all modal-backdrop consumers, including candidate entry, planning, company forms and shared Popup dialogs. Existing engagement and repository drawers already sit above navigation. Removed the shared top Back/Forward button strip; browser history synchronization and contextual close/return flows remain intact.

Verification before release: inspected pinned layout widths on all 15 main navigation destinations at a 1363px browser viewport. Each main panel began at the sidebar's 240px right edge, and no document exceeded viewport width. Typecheck, 299 tests and production build passed. Live dialog layering and browser navigation are checked after deployment.
