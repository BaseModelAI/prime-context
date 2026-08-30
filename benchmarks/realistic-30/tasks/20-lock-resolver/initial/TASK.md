# Constraint-Aware Dependency Lock Resolver

Implement the `lockresolve` package using only the Python standard library.

Initial API:
- `resolve(repository, requirements, *, locked=None, pins=None) -> dict[str, str]`.
- Repository maps package names to `MAJOR.MINOR.PATCH` versions, each mapping to dependency-name/constraint pairs.
- Requirements and dependencies use comma-separated `==`, `>=`, `>`, `<=`, and `<` comparisons.

Initial behavior:
- Select exactly one version for every required transitive package.
- Satisfy all accumulated constraints and backtrack when a high version blocks another requirement.
- Among valid solutions, maximize selected versions in lexical package-name order.
- Return a lexical package mapping.
- Raise `ResolutionError` when no solution exists.
- Validate names, versions, constraints, and referenced packages without mutating inputs.

Run `python run_tests.py`. Edit only files under `lockresolve/`. Keep the active goal open for staged pivots.
