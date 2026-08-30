# NDJSON CLI follow-up

Final requirements:
- `python -m tripsplit.cli` reads NDJSON requests from stdin.
- Each nonblank request has `id`, `people`, and `expenses`.
- Emit one compact sorted JSON line with the same `id` and `settlements`.
- Preserve request order and ignore blank lines.
- Do not read or write any other files.
