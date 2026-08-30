# Tolerant alias-aware pivot

Preserve exact defaults and add:
- `reference_aliases` maps normalized reference strings to canonical strings. Normalize both keys and values before use; unspecified references map to themselves.
- `amount_tolerance` is a nonnegative finite Decimal string.
- One-to-one candidates are eligible when absolute amount discrepancy is at most the tolerance.
- The global objective becomes: maximize pair count, minimize total amount discrepancy, minimize total date distance, then use the lexical pair-sequence tie-break.
- Reversing either input order or alias mapping order must not change output.
