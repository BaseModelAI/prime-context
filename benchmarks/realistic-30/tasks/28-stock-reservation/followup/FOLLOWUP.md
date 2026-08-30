# Snapshots, previews, and NDJSON CLI

Final requirements:
- `snapshot()` returns exactly sorted `stock`, integer `now`, sorted `seen_ids`, and sorted `open` reservation dictionaries. Lines are sorted by SKU.
- `Inventory.from_snapshot(state)` restores an equivalent inventory.
- `explain(reservation)` previews reserve without mutation and returns exactly `id`, `status`, `reason`, `shortages`, `expires_at`, and `now`.
- Decision order: seen ID -> duplicate/id_seen; otherwise shortages -> insufficient/insufficient_stock; otherwise accepted/stock_available. Shortages are sorted dictionaries with `sku`, `requested`, and `available`.
- CLI: `python -m stockroom.cli --stock JSON` reads NDJSON operations from stdin and writes compact sorted JSON responses.
- Support `reserve`, `release`, `commit`, `amend`, `advance`, `explain`, and `snapshot` operations.
