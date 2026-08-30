# Dependency-Aware Build Planner

Implement the `buildplan` package using only the Python standard library.

Initial requirements:
- `BuildPlanner.from_dict(config)` accepts `{"modules": {name: {"deps": [...], "sources": [...]}}}`.
- `BuildPlanner.load(path)` reads the same JSON format.
- `plan(targets=None)` returns module names in dependency-first topological order. With no targets it plans all modules; with targets it includes transitive dependencies.
- Use lexicographic ordering whenever more than one module is ready.
- Unknown dependencies or targets raise `ValueError` with the missing name.
- Dependency cycles raise `ValueError` containing the participating module names.
- Do not mutate caller-provided configuration.

Run `python run_tests.py`. Edit only files under `buildplan/`. Requirements will evolve through live user steering while the goal remains active.
