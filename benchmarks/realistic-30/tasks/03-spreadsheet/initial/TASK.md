# Incremental Spreadsheet Engine

Implement the `miniworkbook` package using only the Python standard library.

Initial API:
- `Workbook.set(cell, value_or_formula)` accepts `Decimal`, integer, decimal string, or a formula beginning with `=`.
- `Workbook.get(cell) -> Decimal`.
- Support cell references, parentheses, unary minus, `+`, `-`, `*`, `/`, and `SUM(A1:B3)`.
- Formula names and normalized cell addresses are uppercase. An unset cell evaluates to zero.
- Implement a tokenizer/parser; do not use `eval`.
- Detect dependency cycles and raise `CycleError` rather than recursing forever.

Run `python run_tests.py`. Edit only files under `miniworkbook/`. Keep the active goal open for staged pivots.
