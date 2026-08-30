# Affine gaps and ambiguous bases

Preserve linear-gap behavior and add keyword options:
- `gap_open` and `gap_extend` must be supplied together as integers.
- With affine scoring, the first column in a contiguous gap run costs `gap_open`; each later column in that run costs `gap_extend`.
- When affine options are omitted, treat `gap_open == gap_extend == gap` for exact backward compatibility.
- Accept uppercase `N`. Any substitution column containing `N` scores zero, including `N` against `N`.
- Apply the same deterministic lexical alignment tie-break across match, insertion, and deletion states.
