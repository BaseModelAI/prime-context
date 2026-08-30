# Incremental recalculation and atomic updates pivot

Preserve formula behavior and add:
- Cache evaluated formula values.
- When a cell changes, invalidate only that cell and its transitive dependents; unrelated warmed formulas remain cached.
- `set_many(mapping)` parses and cycle-checks all proposed changes before committing them atomically.
- If `set_many` fails, values, formulas, dependencies, and caches remain unchanged.
- `evaluation_counts()` returns formula evaluation counts by cell.
- `reset_evaluation_counts()` resets those counters without clearing cached values.
- During one `get`, each formula cell is evaluated at most once.
