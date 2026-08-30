# Union Payroll Calculator

Implement the `union_payroll` package using only the Python standard library.

Initial API:
- `calculate_pay(shifts, contracts, prior_pay=None)` without mutating inputs.
- A shift has unique `id`, `employee`, and naive ISO `start`/`end` timestamps aligned to 15-minute boundaries.
- Contracts map employees to a nonnegative Decimal-string `hourly_rate`.

Initial behavior:
- Split work into exact quarter-hour segments and group by employee and ISO week starting Monday.
- The first 40 hours per week are regular; later hours are overtime at 1.5 times base rate.
- Reject overlap per employee, missing contracts, nonpositive shifts, invalid timestamps, or unaligned minutes.
- Return employee rows in lexical order with two-decimal regular hours, overtime hours, and gross pay, plus total gross.
- All monetary arithmetic uses Decimal and `ROUND_HALF_EVEN` cents.

Run `python run_tests.py`. Edit only files under `union_payroll/`. Keep the active goal open for staged pivots.
