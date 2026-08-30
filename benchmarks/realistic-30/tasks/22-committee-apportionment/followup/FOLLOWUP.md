# Request adapter and JSON/NDJSON CLI

Final requirements:
- `process_request(request)` returns `{"allocation": allocate(...)}` using `seats`, `votes`, and optional `min_basis_points` and `caps`.
- `python -m committee.cli` reads one JSON object from stdin.
- With `--ndjson`, read each nonblank line as one request and emit one response per line in input order.
- Print compact sorted JSON with one trailing newline per response and no other output.
