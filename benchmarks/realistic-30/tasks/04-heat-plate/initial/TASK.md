# Heat Diffusion Plate

Implement the `heatplate` package using only the Python standard library.

Initial API:
- Immutable `HeatPlate(temperatures, alpha, fixed=None)` using `Decimal` values.
- `temperatures` is a nonempty rectangular grid indexed as rows `[y][x]`.
- `fixed` maps `(x, y)` coordinates to forced Decimal temperatures.
- `step() -> HeatPlate` computes one simultaneous Jacobi update.

Initial behavior:
- For each of the four real neighbors, add `alpha * (neighbor - cell)`.
- Missing outside neighbors are insulated and contribute no flux.
- Fixed cells are reset to their fixed values after flux calculation.
- Require `0 <= alpha <= 1/4`, a rectangular grid, and valid fixed coordinates.
- Never mutate the original plate or caller-owned grids.

Run `python run_tests.py`. Edit only files under `heatplate/`. Keep the active goal open for staged pivots.
