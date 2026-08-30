# Swing and chord-cohesion pivot

Preserve uniform-step behavior and add:
- Immutable `SwingGrid(split=Fraction(2, 3))` with grid points at each integer beat and `beat + split`.
- `quantize(..., grid=SwingGrid(...))` uses that grid instead of uniform `step`; keep `step` accepted for backward compatibility.
- Nonnegative `chord_tolerance` groups onset-sorted notes transitively when each consecutive gap is within tolerance.
- Every note in a cluster shares the grid point minimizing total absolute onset error; ties choose earlier.
- Quantize ends independently on the selected grid. If an end is not later than the shared start, use the next grid point.
- Zero tolerance preserves initial independent behavior except truly identical onsets.
