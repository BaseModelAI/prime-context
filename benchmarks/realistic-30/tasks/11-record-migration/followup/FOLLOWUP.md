# Validated batch execution

Final requirements:
- `migrate_batch(records, graph, source, target, schema, mode="atomic", dry_run=False)`.
- Schema has `required` pointer paths and `types` mapping pointers to `integer`, `string`, `boolean`, or `decimal-string`.
- Validate after migration using the same strict primitive definitions.
- Atomic mode raises `BatchError(index, error)` on the first failure and returns no partial result.
- Lenient mode returns one entry per input in order: success has `index`, `record`, and `edge_ids`; failure has `index` and `error` with stable `code` and `path`.
- Dry-run performs path selection, operations, and validation but omits successful `record` fields.
- All modes are pure and consume a one-shot records iterable once.
