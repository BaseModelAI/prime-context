# Feature Flag Evaluator

Implement the `featureflags` package with only the Python standard library.

Initial API:
- `evaluate(config, flag_key, context=None) -> bool`.
- Config is `{"flags": {name: {"default": boolean}}}`.
- Return the named flag's boolean default.
- Treat omitted context as an empty mapping.
- Unknown flag keys raise `KeyError(flag_key)`.
- Do not mutate config or context.

Run `python run_tests.py`. Edit only files under `featureflags/`. Requirements will evolve through live steering while the goal remains active.
