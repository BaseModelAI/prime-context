# Competition-rule pivot

Preserve default behavior and add constructor options:
- `win_points=3`, `draw_points=1`, and `loss_points=0`, all nonnegative integers.
- `head_to_head=False`.
- With head-to-head enabled, first group teams tied on overall points.
- Within each tied group, build a mini-table from matches played only among those teams and sort by mini-table points, goal difference, and goals for, then overall goal difference, overall goals for, and lexical name.
- A one-team group uses normal overall ordering.
- Head-to-head does not recursively create smaller groups.
- Statistics and points use the configured scoring system in both full and mini tables.
