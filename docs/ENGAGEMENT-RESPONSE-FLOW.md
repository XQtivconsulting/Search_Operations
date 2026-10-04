# Engagement daily buckets and response routing

Due today and Overdue are mutually exclusive. Elapsed 24-hour threshold timing is retained: due at the threshold day, overdue on later elapsed days. Labels, counts and candidate drilldowns share the same flags.

All Engaged channels suggest Initial Screening Call, independent of channel ordering, using the configured Screening stage ID. Config displays the next stage under each Engaged row. The action is Record candidate response for all three default channels; positive responses enter the appropriate Engaged channel. Generated older action labels normalize to the new wording; custom wording is retained. No automatic stage movement is introduced.

Actual verification, 4 October 2026: typecheck, 250 tests and build passed. Deployment run 37177721794 succeeded. Synthetic tests cover disjoint due/overdue boundaries, alternative channel routing, custom screening IDs, missing screening stages, and label normalization. Live read-only verification showed Daily Work with 2 overdue and 0 due today, and all three Config rows with Record candidate response and Next: Initial Screening Call. No candidate or configuration records were written during verification.
