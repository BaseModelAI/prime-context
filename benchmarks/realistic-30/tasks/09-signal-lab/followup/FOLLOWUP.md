# Stereo delay estimation

Final requirements:
- Immutable `DelayEstimate(lag, score, overlap)`.
- `estimate_delay(left, right, max_lag) -> DelayEstimate` accepts finite integer iterables.
- For each integer lag in `[-max_lag, max_lag]`, compute `sum(left[i] * right[i + lag])` for valid paired indexes.
- `overlap` is the number of multiplied pairs for the chosen lag.
- Choose greatest score; break ties by smaller absolute lag, then smaller signed lag.
- Reject negative/noninteger `max_lag` and noninteger samples.
- Inputs may be one-shot iterables and may have different lengths.
