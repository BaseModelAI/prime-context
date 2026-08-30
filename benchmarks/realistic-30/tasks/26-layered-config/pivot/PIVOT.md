# Delete markers, list policy, and provenance pivot

Preserve the initial API and add:
- An exact mapping value `{"$delete": true}` deletes that key. A mapping with any other member is ordinary data. Markers are ordinary inside lists.
- `list_policy`: replace, append, or unique. Unique uses stable JSON-value equality with a linear scan.
- `merge_layers_detailed(...) -> MergeResult(config, sources)`.
- Sources map every surviving RFC 6901 pointer, including containers and root `""`, to the current source layer.
- A deep-merged container gets the incoming layer while untouched children retain their source.
- Append/unique retain old element sources and stamp admitted new elements. Delete removes its pointer subtree.
- Keep current provenance only.
