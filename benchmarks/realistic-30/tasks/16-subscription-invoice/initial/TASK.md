# Subscription Invoice Generator

Implement the `subscription_invoice` package using only the Python standard library.

Initial API:
- `generate_invoice(period, subscription, events=())` where period is `YYYY-MM`.
- Subscription has `start`, optional exclusive `end`, and a plan with string `id` and finite nonnegative Decimal-string `monthly`.

Initial behavior:
- Intersect the subscription activity interval with the calendar month.
- Emit one recurring line with `kind`, plan ID, inclusive `start`, exclusive `end`, and two-decimal `amount`.
- Prorate as monthly amount times active calendar days divided by days in the month, rounded with `ROUND_HALF_EVEN` to cents.
- Empty activity emits no lines.
- Return lines, subtotal, and total; both totals are two-decimal strings.
- Validate inputs and do not mutate them.

Run `python run_tests.py`. Edit only files under `subscription_invoice/`. Keep the active goal open for staged pivots.
