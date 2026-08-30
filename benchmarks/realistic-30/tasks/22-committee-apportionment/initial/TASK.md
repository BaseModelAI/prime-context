# Committee Seat Apportionment

Implement the `committee` package using only the Python standard library.

Initial API:
- `allocate(seats, votes) -> dict[str, int]`.

Initial behavior:
- Use Hamilton largest-remainder apportionment with exact integer arithmetic.
- Return every input party, including zero-seat parties.
- Give leftover seats by descending fractional remainder, then ascending party name.
- `seats == 0` returns all zeroes.
- Positive seats with no positive votes raises `ValueError`.

Run `python run_tests.py`. Edit only files under `committee/`. Keep the active goal open for staged pivots.
