# Decimal Cash-Flow Mathematics

Implement the `cashflow_math` package using only the Python standard library.

Initial API:
- `amortize(principal, annual_rate, periods, payments_per_year=12) -> tuple[PaymentRow, ...]`.
- Immutable `PaymentRow(period, opening, payment, interest, principal_paid, closing)`.
- Monetary and rate inputs must be `Decimal`; counts are positive integers.

Initial behavior:
- Use a fixed level payment for the periodic rate `annual_rate / payments_per_year`.
- Round every monetary row field to cents using `ROUND_HALF_EVEN`.
- Adjust the final payment so closing balance is exactly zero.
- Never produce a negative closing balance.
- Reject negative principal, negative rates, float values, and invalid counts.

Run `python run_tests.py`. Edit only files under `cashflow_math/`. Keep the active goal open for staged pivots.
