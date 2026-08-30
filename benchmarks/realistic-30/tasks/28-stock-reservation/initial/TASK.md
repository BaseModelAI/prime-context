# Stock Reservation Engine

Implement the `stockroom` package using only the Python standard library.

Initial API:
- Immutable `Line(sku, quantity)` and `Reservation(id, lines, expires_at=None)`.
- `Inventory(stock)` with `reserve`, `release`, `available`, and `active`.

Initial behavior:
- Stock quantities are nonnegative integers; line quantities are positive integers.
- A reservation is atomic across all lines: return `"accepted"` or `"insufficient"`.
- The first accepted reservation ID wins forever; another reserve with that ID returns `"duplicate"`.
- Insufficient attempts do not consume the ID.
- `release(id)` returns `"released"` or `"missing"` and restores held availability.
- `active()` returns open reservations sorted by ID. Never mutate caller inputs.

Run `python run_tests.py`. Edit only files under `stockroom/`. Keep the active goal open for staged pivots.
