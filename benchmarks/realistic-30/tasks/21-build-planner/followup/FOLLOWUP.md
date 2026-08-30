# Explainability and CLI follow-up

Add final behavior:
- `explain(changed_paths)` returns `{"changed": normalized_paths, "direct": sorted_direct_modules, "rebuild": affected_plan, "reasons": mapping}`.
- Each rebuilt module's reason list contains the sorted directly changed modules that reach it through dependency edges; a direct module includes itself.
- Implement `python -m buildplan.cli MANIFEST COMMAND ARGS...`.
- Commands are `plan [TARGET ...]`, `affected PATH ...`, and `explain PATH ...`.
- Print exactly one JSON value with deterministic key ordering and return zero on success.
