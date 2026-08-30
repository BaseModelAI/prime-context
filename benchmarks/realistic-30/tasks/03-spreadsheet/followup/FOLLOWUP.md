# Scenario analysis and goal seeking

Final requirements:
- `evaluate_scenarios(overrides_sequence, outputs)` returns one output mapping per scenario.
- A scenario temporarily overrides any listed input cells; omitted cells use stored values.
- Scenario evaluation must not mutate cells, alter the normal cache, or change normal evaluation counters.
- `goal_seek(input_cell, output_cell, target, low, high, tolerance)` uses deterministic Decimal bisection.
- Require the endpoint outputs to bracket the target.
- Return the midpoint input as soon as absolute output error is within tolerance; otherwise continue deterministically until it is.
- Goal seeking must also leave the stored workbook and normal cache unchanged.
