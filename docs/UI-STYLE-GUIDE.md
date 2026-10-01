# Application content style

Team Allocation is the reference screen. The left navigation retains its existing appearance. Shared content rules live in `src/typography.css`, imported after component CSS.

- Page title 23px; section 16px; subsection 14px.
- Table body and row identity 13px; column headings and form controls 12px.
- Supporting text 11px; dense planning badges/card annotations 10px.
- Regular text 400, row identity/control labels 500, headings 600.
- Table cells use 7px vertical / 8px horizontal padding, light alternating rows (#f3f6fa), neutral headers (#edf2f5), and 1px separators (#d3dce9).
- Preserve semantic decision colors: Start/Continue green, Pause red. Component controls retain their action/status meaning.
- Set column widths by the column's purpose on the owning table. Never give every table's nth column a shared minimum width.
- Search Decisions uses a 200px role column, compact counts, wrapping headings, and compact actions. History scrolls horizontally when needed.
- Candidate-facing role documents retain their editorial typography.

Check table/header/secondary text together when adding screens; avoid local font-size overrides.

## Module navigation and mapping fit
Talent assets groups Candidates and Company universe; Search repository leads Sourcing. Navigation headings are disclosure buttons with aria-expanded/aria-controls, independent collapse state and automatic expansion when a page in that module is opened. Organization starts collapsed; collapse state is session-only. Future modules are roadmap items, not empty links.
Fit evidence uses one compact aligned row per criterion: requirement/weight, researcher rating, and justification. On narrow screens justification moves beneath the criterion/rating. Evidence attribution names the mapping researcher; where supplied, the submission timestamp is labeled as such, not an invented edit timestamp. Team review attribution remains separate. Read-only and edit screens share the grid. Mapping audit history starts collapsed. No scoring, weights, criteria, evidence or authorization rules change.
