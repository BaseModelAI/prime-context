# Trip Expense Settlement

Implement the `tripsplit` package using only the Python standard library.

Initial API:
- `settle(people, expenses) -> list[dict]`.
- Each expense has `payer` and a decimal-string `amount` and is shared equally by everyone.

Initial behavior:
- Convert amounts to integer cents exactly.
- For each expense, allocate floor shares and assign leftover cents in `people` order.
- Net balance is paid minus owed.
- Match debtors to creditors greedily, each in `people` order.
- Return positive transfers as `{"from": name, "to": name, "amount": "0.00"}`.
- Preserve inputs and deterministic ordering.

Run `python run_tests.py`. Edit only files under `tripsplit/`. Keep the active goal open for staged pivots.
