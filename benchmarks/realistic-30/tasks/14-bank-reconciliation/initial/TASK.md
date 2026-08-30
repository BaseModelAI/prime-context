# Bank Deposit Reconciler

Implement the `bank_reconcile` package using only the Python standard library.

Initial API:
- `reconcile(bank_entries, ledger_entries, *, max_days=2, reference_aliases=None, amount_tolerance="0.00", max_bundle=1)`.
- Entries have unique string `id`, ISO `date`, finite Decimal-string `amount`, and string `reference`.
- Return `matches`, `unmatched_bank`, and `unmatched_ledger`; matched groups contain sorted `bank_ids` and `ledger_ids`.

Initial behavior:
- Match one bank entry to one ledger entry when amounts are equal, normalized references match, and dates differ by at most `max_days`.
- Normalize references by retaining uppercase ASCII letters and digits.
- Select matches globally: maximize matched pair count, then minimize total date distance, then choose the lexically smallest sorted sequence of ID pairs.
- Output match groups and unmatched IDs in lexical order.
- Validate inputs and do not mutate them.

Run `python run_tests.py`. Edit only files under `bank_reconcile/`. Keep the active goal open for staged pivots.
