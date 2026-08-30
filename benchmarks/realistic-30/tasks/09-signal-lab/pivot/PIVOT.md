# One-pass microphone analysis pivot

Preserve `analyze` and add:
- `SignalAnalyzer(sample_rate, clip_limit=None, min_clip_run=1)`.
- `feed(iterable)` consumes each chunk exactly once and may be called repeatedly.
- `finish() -> SignalStats` matches batch analysis regardless of chunk boundaries.
- `analyze` delegates to this streaming path.
- With a positive integer `clip_limit`, report maximal half-open sample-index runs where `abs(sample) >= clip_limit` and length is at least positive integer `min_clip_run`.
- Runs may cross feed boundaries.
- Reject feed after finish and a second finish with `RuntimeError`.
- Keep constant-size numeric accumulator state apart from the returned clipped-run list.
