# Idempotent event intake

Use the `X-Event-ID` request header as the external event identifier. The first valid `POST /events` with a new header value follows the existing behavior and returns `202` with its new local numeric ID.

If that exact external ID is posted again, return HTTP `200` with `{"id": <original local ID>}`. Do not insert or enqueue another event. Do not replace the original payload or change its delivery status, retry time, or attempt counters. The mapping must be durable in SQLite and continue to work after service restarts.

Requests without `X-Event-ID` retain the original non-idempotent `202` behavior. All previous receiver, worker, retry, restart, and replay requirements remain in force.
