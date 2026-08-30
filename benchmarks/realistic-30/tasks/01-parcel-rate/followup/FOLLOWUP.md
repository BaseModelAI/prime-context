# JSON and NDJSON rating CLI

Final requirements:
- `python -m parcelrate.cli` reads one JSON request from stdin.
- With `--ndjson`, read each nonblank line as one independent request and preserve order.
- Each request has `parcels` and `services`.
- Emit one compact, key-sorted JSON result line per request, with no other output.
