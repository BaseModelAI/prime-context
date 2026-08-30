# Event-Time Window Counter

Implement the `eventwindow` package with only the Python standard library.

Initial API:
- Immutable `Event(id, ts, key, value)` and `Window(start, end, key, count, total)`.
- `EventWindow(size, allowed_lateness=0)`.
- `add(event) -> "accepted" | "duplicate" | "late"` and `current() -> list[Window]`.

Initial behavior:
- Event timestamps are nonnegative integers and size is positive.
- Window bounds are half-open: `start=(ts//size)*size`, `end=start+size`.
- The first accepted occurrence of an event ID wins; later uses are duplicate.
- Aggregate count and total independently per window and key.
- Return current windows sorted by `(start, key)`.

Run `python run_tests.py`. Edit only files under `eventwindow/`. Keep the active goal open for staged pivots.
