# Authoritative DNS Zone Compiler

Implement the `dnszone` package using only the Python standard library.

Initial API:
- Immutable `Answer(name, type, value, ttl)`.
- `compile_zone(records, origin, default_ttl=300) -> Zone`.
- `Zone.resolve(qname, qtype) -> tuple[Answer, ...]`.

Initial behavior:
- Support `A`, `AAAA`, `CNAME`, and `TXT` records.
- Expand relative owner names under origin; `@` means origin and names ending in `.` are absolute.
- Canonicalize DNS names to lowercase with a trailing dot.
- Direct queries are case-insensitive and return matching records sorted by value.
- A missing owner or type returns an empty tuple.
- Validate IP addresses, positive integer TTLs, owner names, types, and CNAME targets.

Run `python run_tests.py`. Edit only files under `dnszone/`. Keep the active goal open for staged pivots.
