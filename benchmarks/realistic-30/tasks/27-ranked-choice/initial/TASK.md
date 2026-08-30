# Ranked-Choice Election Tabulator

Implement the `rankedchoice` package using only the Python standard library.

Initial API:
- `tabulate(ballots, *, withdrawn=()) -> dict`.
- Initial ballots are ranking lists with implicit weight 1.

Initial behavior:
- Candidates are the union of ranked names minus withdrawn names.
- Each round assigns each ballot to its first active ranked candidate; otherwise its weight is exhausted.
- Include every active candidate in counts, sorted lexically.
- Win requires strictly more than half of non-exhausted weight.
- Otherwise eliminate a minimum-count candidate, breaking ties by eliminating the lexicographically greatest name.
- Return winner and ordered round dictionaries containing counts, exhausted, and eliminated. No active candidates returns no winner and no rounds.

Run `python run_tests.py`. Edit only files under `rankedchoice/`. Keep the active goal open for staged pivots.
