# Branching version graph pivot

Preserve operation behavior and add:
- `migrate(record, graph, source, target)` where graph is a list of directed edges.
- Each edge has unique `id`, `from`, `to`, nonnegative integer `cost`, and `operations`.
- Select the path with the lowest total cost.
- Break equal-cost ties by the lexicographically smallest complete sequence of edge IDs.
- Apply selected edge operations in path order to a pure copy.
- Return `{"record": migrated, "edge_ids": [...]}`.
- Raise stable `VersionError(source, target)` when target is unreachable.
- Validate the graph deterministically and handle cycles without looping.
