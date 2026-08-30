# Polyphonic Rhythm Quantizer

Implement the `rhythm` package using only the Python standard library.

Initial API:
- Immutable `Note(pitch, start, duration, velocity=64)` using `Fraction` times.
- `quantize(notes, step) -> tuple[Note, ...]` with positive Fraction `step`.

Initial behavior:
- Snap each start and end independently to the nearest integer multiple of `step`.
- Exact distance ties choose the earlier grid point.
- If snapped end is not after snapped start, extend to the next grid point.
- Return notes ordered by `(start, pitch, original_input_index)`.
- Validate MIDI pitch/velocity in 0..127 and positive duration without mutating inputs.

Run `python run_tests.py`. Edit only files under `rhythm/`. Keep the active goal open for staged pivots.
