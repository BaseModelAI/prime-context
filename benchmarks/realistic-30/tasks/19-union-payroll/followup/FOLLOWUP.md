# Retroactive pay comparison

Final requirements:
- `prior_pay` may map shift IDs to nonnegative Decimal-string amounts previously paid; omitted means an empty mapping.
- Track current gross pay per shift while applying employee/day/week thresholds across all shifts.
- Return `shift_lines` ordered by shift ID with `id`, employee, two-decimal current, prior, and signed adjustment.
- A missing prior amount is zero.
- Return `total_prior` and signed `total_adjustment`; total adjustment equals total gross minus total prior.
- Prior values do not change hour classification or current gross calculations.
- Reject unknown prior shift IDs and invalid prior amounts atomically.
