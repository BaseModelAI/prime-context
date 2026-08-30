# Entity-list merge pivot

Preserve atomic-list behavior by default and add:
- `entities` maps JSON Pointer paths to an entity key, for example `{ "/items": "id" }`.
- At configured paths, treat each list as an entity collection keyed by that field and merge entities independently.
- Preserve surviving base entity order, then append ours-only IDs in ours order, then theirs-only IDs in theirs order.
- Concurrent changes to different entities merge without conflict.
- Conflict paths use the entity ID token, such as `/items/a`, rather than an array index.
- Concurrent additions of the same ID merge using the normal rules.
