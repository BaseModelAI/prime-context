# Expiration, commit, and amendment pivot

Preserve the initial API and add:
- Inventory time starts at 0. `advance_time(now)` is monotonic and returns IDs newly expired, sorted by `(expires_at, id)`. Expiration occurs when `now >= expires_at` and releases holds once.
- Reserving with `expires_at <= current time` raises `ValueError`.
- `commit(id)` returns `"committed"` or `"missing"`. It removes the hold and permanently deducts its quantities from stock. The ID remains seen.
- `amend(id, lines)` returns `"accepted"`, `"insufficient"`, or `"missing"`. It atomically evaluates the replacement as if the reservation's old hold were released. On failure, retain the old reservation unchanged. Preserve its expiration.
- Aggregate duplicate SKUs within one request before availability checks.
