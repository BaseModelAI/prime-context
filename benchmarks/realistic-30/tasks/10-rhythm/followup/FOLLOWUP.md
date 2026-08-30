# Voice assignment and bar engraving

Final requirements:
- Immutable `NoteFragment(pitch, start, duration, velocity, voice, tie_in, tie_out)`.
- `engrave(notes, bar_length) -> tuple[NoteFragment, ...]` with positive Fraction bar length.
- Process notes in `(start, pitch, original_input_index)` order.
- Assign each note to the lowest-numbered voice whose last end is at most its start.
- Notes with identical start and end may share the same voice as a chord even though they overlap.
- Create a new voice only when no existing voice qualifies.
- Split notes at every bar line. Fragments after the first have `tie_in`; fragments before the last have `tie_out`.
- Return fragments ordered by `(start, voice, pitch, fragment_order)`.
