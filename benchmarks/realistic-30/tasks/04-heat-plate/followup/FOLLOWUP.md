# Steady-state solver and fixed-cell fluxes

Final requirements:
- `solve_steady(tolerance, max_steps) -> (plate, iterations)` performs deterministic Jacobi steps until the maximum absolute change over real cells is at most the nonnegative Decimal tolerance.
- Require positive integer `max_steps` and at least one fixed real cell.
- Count and return every performed step, including the step that satisfies the tolerance.
- Raise `ConvergenceError` after `max_steps` without mutating the original plate.
- `fixed_fluxes()` returns a coordinate-sorted mapping for fixed cells.
- A fixed cell flux is `sum(g * (T_fixed - T_neighbor))` across real neighbors, using the same face conductance. Positive means heat supplied by that boundary.
