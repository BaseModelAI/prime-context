# Incremental build pivot

Add incremental rebuild planning:
- `affected(changed_paths)` maps changed source paths to their owning modules.
- Rebuild every directly changed module and every transitive reverse dependent.
- Return the affected modules in the same dependency-first stable order used by `plan`.
- Normalize path separators to `/` and remove a leading `./`.
- A source may belong to more than one module; unknown paths produce an empty plan.
- Preserve the existing public API and behavior.
