# Versioned Record Migration Engine

Implement the `record_migrate` package using only the Python standard library.

Initial API:
- `apply_operations(record, operations)` returns a migrated deep copy and never mutates input.
- Paths are RFC-6901 JSON Pointers through nested objects; escape `~` as `~0` and `/` as `~1`.
- Every operation has a unique string `id`.

Supported operations:
- `rename`: move required `from` to absent `path`.
- `add_default`: deep-copy `value` to `path` only when absent.
- `drop`: remove `path` when present.
- `coerce`: strictly convert the value at `path` to `integer`, `string`, `boolean`, or `decimal-string`.
- Integer accepts non-boolean int or a canonical signed base-10 string. String accepts string or non-boolean int. Boolean accepts bool or exact `true`/`false`. Decimal-string accepts finite int/string Decimal and emits fixed notation without redundant trailing zeros.
- Raise `MigrationError` carrying operation id and path on failure.

Run `python run_tests.py`. Edit only files under `record_migrate/`. Keep the active goal open for staged pivots.
