# Watermarks and bounded-lateness pivot

Preserve the initial API and add:
- Watermark starts as `None`, may stay equal, and cannot decrease.
- `advance_watermark(value) -> list[Window]` emits each newly final window once and removes it from current state.
- A window is final when `watermark >= end + allowed_lateness`.
- A new ID targeting an already final window is `late` and is not added to seen IDs.
- An already accepted ID is always `duplicate`, even after finalization.
- Sort emitted windows by `(start, key)`.
