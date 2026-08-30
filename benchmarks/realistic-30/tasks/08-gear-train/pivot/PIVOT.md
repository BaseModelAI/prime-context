# Multiple-drive constraint pivot

Preserve `solve_speed` and add:
- `solve(drives)` accepts a mapping from gear/shaft name to an integer or Fraction speed.
- Validate all drive constraints together. Compatible redundant drives are accepted; conflicting drives raise `InconsistentTrain`.
- Solve all connected constraint components in one exact rational system.
- A component with no drive remains `None` unless its constraints uniquely force zero.
- Return keys in lexical name order.
- Reversing declaration, edge, or drive mapping order must not change results.
- `solve_speed(driver, rpm)` delegates to `solve({driver: rpm})`.
