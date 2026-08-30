# Incremental serial decoder pivot

Preserve exact batch decoding and add `FrameDecoder(max_payload=65535)`:
- `feed(chunk) -> list[Frame]` accepts bytes-like chunks and emits every newly completed frame.
- Input may split at any byte and may contain garbage between frames.
- Resynchronize at the next magic sequence and expose cumulative `dropped_bytes`.
- Retain only bytes that may be part of an incomplete valid frame.
- A candidate length above `max_payload` is false magic: discard its first byte and continue searching without allocating that payload.
- `finish()` returns any final completed frames, discards terminal garbage, and raises `ValueError` for a plausible but incomplete frame.
- Feeding after `finish()` raises `RuntimeError`.
