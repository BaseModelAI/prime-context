# Deterministic DNA Alignment

Implement the `dna_align` package using only the Python standard library.

Initial API:
- Immutable `Alignment(score, aligned_a, aligned_b, start_a, end_a, start_b, end_b)`.
- `align_global(a, b, match=2, mismatch=-1, gap=-2) -> Alignment`.

Initial behavior:
- Perform global Needleman-Wunsch alignment over uppercase `A`, `C`, `G`, and `T`.
- A gap character scores `gap` for every column.
- Return zero-based half-open coordinates covering both complete input strings.
- Among equal-score alignments choose the lexicographically smallest `(aligned_a, aligned_b)` pair.
- Reject booleans/nonintegers for scores, invalid symbols, and input gap characters.

Run `python run_tests.py`. Edit only files under `dna_align/`. Keep the active goal open for staged pivots.
