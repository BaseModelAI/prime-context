# Weighted ballots and withdrawals pivot

Preserve list-ballot compatibility and add:
- A ballot may be `{"ranking": [...], "weight": positive_integer}`.
- Legacy list ballots still have weight 1.
- The `withdrawn` iterable names candidates skipped from the first round onward.
- Withdrawn candidates never appear in counts or rounds.
- If every ranked candidate is withdrawn, return no winner and no rounds.
- Preserve ballot input values and deterministic tie rules.
