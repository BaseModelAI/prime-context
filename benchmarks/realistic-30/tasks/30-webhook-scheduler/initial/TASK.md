# Webhook Delivery Scheduler

Implement the `webhooks` package using only the Python standard library.

Initial API:
- `SendResult(status: int)` and immutable `DeliveryView` in `webhooks.models`.
- `WebhookScheduler(sender, clock, executor, max_attempts=3, backoff_base=1.0, max_per_host=2)`.
- `submit(url, payload, delivery_id=None, not_before=None) -> str`.
- Nonblocking `pump() -> int`, plus `get(id)`, `list()`, `cancel(id)`, and `close()`.

Initial behavior:
- Canonical JSON bytes use sorted keys and compact separators; send `Content-Type: application/json`.
- Use only the injected clock for scheduler time. Never sleep.
- Pending jobs are selected by `(next_attempt_at, insertion_sequence)`.
- Increment attempts when dispatched. Any 2xx response succeeds.
- Other response behavior will evolve through live steering.

Run `python run_tests.py`. Edit only files under `webhooks/`. Keep the active goal open for staged pivots.
