# Local affine alignment

Final requirements:
- Add `align_local` with the same scoring arguments and affine options.
- Perform Smith-Waterman-style local alignment and return source coordinates for the chosen substrings.
- Empty alignment with score 0 is allowed and has empty strings and all coordinates zero.
- Only positive-score nonempty candidates beat the empty result.
- Resolve equal positive scores by earliest `(start_a, start_b, end_a, end_b)`, then lexicographically smallest aligned-string pair.
- Local alignments do not include score-reducing terminal gap columns.
- Keep exact integer arithmetic and the same validation and `N` semantics.
