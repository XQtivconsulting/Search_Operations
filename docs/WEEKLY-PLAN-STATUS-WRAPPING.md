# Weekly plan status wrapping

The shared search-status component had a 110px minimum width inside a 78px weekly-plan column. Its date text overflowed into the search title. Remove the component minimum width, constrain grid children and wrap dates, history and notes. Give the weekly-plan status column 110px and allow long cell content and priority lines to wrap. The shared fix applies wherever SearchStatus is displayed.

Verification is recorded in the release run: TypeScript, full test suite and production build. The user's screenshot identified the width mismatch; authenticated browser visual verification was not available. No data, permissions or planning behavior changes.
