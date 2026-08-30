# Layered Configuration Merger

Implement the `layeredconfig` package using only the Python standard library.

Initial API:
- `merge_layers(layers) -> dict`, where layers are `(unique_name, mapping)` pairs.

Initial behavior:
- Apply layers left to right without mutating inputs.
- Recursively merge mapping values.
- Otherwise the later value replaces the earlier value.
- Lists replace by default.
- JSON null is ordinary data.

Run `python run_tests.py`. Edit only files under `layeredconfig/`. Keep the active goal open for staged pivots.
