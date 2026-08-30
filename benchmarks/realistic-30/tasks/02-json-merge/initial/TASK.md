# Three-Way JSON Merge Service

Implement the `jsonmerge3` package using only the Python standard library.

Initial API:
- `merge(base, ours, theirs, *, entities=None, resolutions=None) -> dict`.
- The three inputs are JSON-compatible values and must not be mutated.

Initial behavior:
- Equal edits coalesce.
- If only one side changed from base, take that side.
- Recursively merge object keys in lexical order.
- Lists are initially atomic values.
- A differing scalar/list edit is a `value` conflict. A deletion against an edit is a `delete-edit` conflict.
- Unresolved conflicts keep the `ours` value (including deletion) in the provisional document.
- Return `{"document": ..., "conflicts": [{"path": JSON_POINTER, "kind": ...}, ...]}` with conflicts sorted by path.
- Escape JSON Pointer tokens using `~0` and `~1`.

Run `python run_tests.py`. Edit only files under `jsonmerge3/`. Keep the active goal open for staged pivots.
