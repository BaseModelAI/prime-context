# Exact Gear-Train Constraint Solver

Implement the `geartrain` package using only the Python standard library.

Initial API:
- `GearTrain.add_gear(name, teeth)` with unique names and positive integer tooth counts.
- `mesh(a, b)` adds an external gear mesh satisfying `wa*Na + wb*Nb = 0`.
- `coaxial(a, b)` adds equality `wa = wb`.
- `solve_speed(driver, rpm)` returns every declared gear speed as `Fraction`, or `None` when disconnected from the driver.
- Raise `InconsistentTrain` for contradictory cycles or constraints.

Initial behavior:
- Use exact rational arithmetic only.
- Validate names and connections.
- Declaration and connection order must not affect the name-to-speed mapping.

Run `python run_tests.py`. Edit only files under `geartrain/`. Keep the active goal open for staged pivots.
