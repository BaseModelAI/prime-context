# Portable snapshots, explanations, and NDJSON CLI

Final requirements:
- `snapshot()` returns exactly `size`, `allowed_lateness`, `watermark`, sorted `seen_ids`, and sorted `open_windows` dictionaries.
- `EventWindow.from_snapshot(state)` restores an equivalent counter.
- `explain(event)` previews without mutation and returns exactly `event_id`, `status`, `reason`, `window_start`, `window_end`, `watermark`, `final_at`.
- Decision order matches add: seen ID -> duplicate/event_id_seen; final window -> late/window_finalized; otherwise accepted/window_open.
- CLI: `python -m eventwindow.cli --size N --allowed-lateness N` reads NDJSON operations from stdin and writes compact sorted JSON responses.
- Support `add`, `watermark`, `snapshot`, and `explain` operations. Add returns op/status; watermark returns op/emitted.
