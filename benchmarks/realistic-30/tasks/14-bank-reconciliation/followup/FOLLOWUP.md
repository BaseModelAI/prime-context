# Split-deposit bundle follow-up

Final requirements:
- `max_bundle` is an integer from 1 to 3.
- Values above 1 allow one bank entry to match 2..max_bundle ledger entries, or one ledger entry to match 2..max_bundle bank entries.
- All entries in a group must share the canonical reference. Every bundled member date must be within `max_days` of the singleton date. Compare summed amounts using `amount_tolerance`.
- Do not allow many-to-many groups.
- Select disjoint groups globally by maximizing the total number of reconciled entries, then maximizing group count, minimizing total amount discrepancy, minimizing total member-to-singleton day distance, and finally choosing the lexical sorted group signature.
- Existing one-to-one results remain unchanged when `max_bundle=1`.
