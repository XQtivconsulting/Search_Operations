# Interview tracker and personal details

Interview Tracker retains client, search, candidate and status filters and now uses one flat table across searches. Candidate, Client, Search, Recommended to client, Engagement stage, Outcome and each interview-round column sort the entire filtered result. Recommendation editing uses an accessible pencil icon in the date cell. Existing round data and editing remain available; only one empty round is shown initially, with additional recorded rounds shown automatically.

Candidate details includes optional Age and Gender fields under Personal details. An authorized candidate editor can update or clear these fields independently of other profile data. Age is a manually recorded whole number, not inferred or automatically advanced. Saves retain optimistic version checks and transactional audit history.

## Verification

Local typecheck, 261 tests and production build passed. Tests cover attribute validation, clearing values, preservation of profile fields, permissions, version conflicts and audit events. Deployment and browser verification will be recorded after completion.
