# Streaming Signal Analysis

Implement the `signal_lab` package using only the Python standard library.

Initial API:
- Immutable `SignalStats(count, peak_abs, mean, rms, zero_crossings, clipped_runs=())`.
- `analyze(samples, sample_rate) -> SignalStats` for a finite iterable of signed integer samples.

Initial behavior:
- Mean and RMS are floats; empty input has zero for every numeric field.
- `zero_crossings` counts adjacent pairs whose product is negative. A zero is not a crossing.
- Require a positive numeric sample rate and integer samples.
- Do not mutate caller-owned input.

Run `python run_tests.py`. Edit only files under `signal_lab/`. Keep the active goal open for staged pivots.
