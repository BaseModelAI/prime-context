# Environment expansion, explanation, and JSON CLI

Final requirements:
- When explicit `env` is supplied, expand string values after merging in one pass: `${NAME}` and `${NAME:-default}`.
- Defaults apply only when the name is absent, not when it is empty. Do not expand keys or read ambient environment.
- Missing names without defaults raise `ExpansionError` identifying the JSON pointer and name. Expansion does not change provenance.
- `MergeResult.explain(pointer)` returns exactly path, value, and source. Missing pointers raise `KeyError`; malformed pointers raise `ValueError`.
- CLI: `python -m layeredconfig.cli --layer NAME=FILE ... [--list-policy replace|append|unique] [--env NAME=VALUE ...] [--explain POINTER]`.
- Print one compact sorted JSON line for config or explanation.
