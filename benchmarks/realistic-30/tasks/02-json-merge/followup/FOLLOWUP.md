# Conflict resolution and change patch

Final requirements:
- `resolutions` maps conflict paths to `ours`, `theirs`, `delete`, or `{"strategy": "value", "value": ...}`.
- Apply supplied resolutions while merging. Resolved paths are omitted from `conflicts`; unspecified conflicts remain provisional as before.
- Return a deterministic `patch` when `resolutions` is not `None`. It transforms `ours` into the returned document.
- Diff objects recursively by sorted pointer path. Emit `remove` for missing keys, `add` for new keys, and `replace` for changed scalar/list values. Treat lists, including entity lists, atomically in the patch.
- Patch entries are ordered lexically by path.
