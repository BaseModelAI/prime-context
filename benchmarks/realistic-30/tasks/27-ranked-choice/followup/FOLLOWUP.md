# JSON and NDJSON CLI

Final requirements:
- `python -m rankedchoice.cli` reads one JSON request from stdin.
- With `--ndjson`, read each nonblank line as one independent request and preserve order.
- A request has `ballots` and optional `withdrawn`, defaulting to an empty list.
- Emit one compact sorted JSON result line per request, with no other output.
