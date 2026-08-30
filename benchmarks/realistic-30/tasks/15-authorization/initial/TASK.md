# Hierarchical Authorization Engine

Implement the `authz` package using only the Python standard library.

Initial API:
- `PolicyEngine(resources, grants)` where resources map IDs to a parent ID or `None`.
- Immutable `Decision(allowed, reason_ids)`.
- `authorize(subject, resource, action) -> Decision`.

Initial behavior:
- A grant has unique `id`, `subject`, `resource`, and nonempty `actions`.
- Grants apply to their resource and every descendant.
- Actions initially match an exact string or `*`.
- Among matching grants, use those attached to the nearest ancestor of the requested resource and return their IDs lexically.
- With no matching grant return a denied decision with no reasons.
- Validate a finite acyclic resource forest, references, IDs, subjects, and actions.

Run `python run_tests.py`. Edit only files under `authz/`. Keep the active goal open for staged pivots.
