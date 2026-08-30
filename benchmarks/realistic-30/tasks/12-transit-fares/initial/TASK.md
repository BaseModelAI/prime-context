# Transit Fare Settlement Engine

Implement the `transit_fares` package using only the Python standard library.

Initial API:
- `settle(taps, rules, riders=None) -> list[dict]` without mutating inputs.
- A tap has `id`, `rider`, `kind` (`in` or `out`), `station`, and naive ISO `at`.
- Rules map stations to integer zones, zone-span strings to `peak`/`offpeak` Decimal fare strings, half-open peak time windows, and a missing-tap penalty.

Initial behavior:
- Process taps by `(at, id)` and pair each out with that rider's open in.
- Fare span is `abs(origin_zone - destination_zone) + 1`; peak status uses trip start time.
- An unmatched open in becomes a `missing` charge after all taps. Ignore unmatched outs.
- Every row has rider, kind (`trip` or `missing`), started_at, service_day, and two-decimal amount.
- A service day starts at 04:00, so earlier starts belong to the previous date.
- Return rows ordered by `(service_day, rider, started_at, kind)`.

Run `python run_tests.py`. Edit only files under `transit_fares/`. Keep the active goal open for staged pivots.
