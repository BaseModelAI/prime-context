# Minimal-change lockfile pivot

Preserve unlocked behavior and add:
- `locked` maps package names to previously selected versions.
- First minimize the number of required packages whose selected version differs from a valid repository version in `locked`.
- After minimizing changes, apply the existing lexical highest-version objective.
- Newly introduced packages do not count as changes; unrelated locked packages do not become requirements.
- `pins` maps package names to exact versions and constrains those packages whenever they enter the graph.
- A pin conflicting with requirements makes the resolution unsatisfiable.
- Input mapping order must not affect output.
