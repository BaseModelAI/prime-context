# Webhook Receiver

Complete the partially implemented `webhook_app` package in this workspace. Use only the Python standard library. Keep all durable delivery state in the SQLite database named on the command line. The judge uses only loopback HTTP services and starts each command from the workspace root.

## Commands

The initial version must support both commands below:

```bash
python -m webhook_app serve --db workspace/webhooks.db --port 0
python -m webhook_app worker --db workspace/webhooks.db --sink-url-file inputs/sink_url.txt --now 2025-07-01T12:00:00Z
```

Create the database and its parent directory if they do not exist. A server started with `--port 0` must bind to `127.0.0.1` on an available port. Once ready, it must print exactly one line of the form `LISTENING <port>` to standard output and flush it. It must continue serving until it receives a normal process termination signal.

## Receiver HTTP interface

`POST /events` accepts a UTF-8 JSON request body. The top-level value must be an object. On acceptance:

- insert one durable event with status `pending`;
- preserve that JSON object as the body later sent to the sink; and
- return HTTP `202` with JSON `{"id": <local numeric ID>}`.

Malformed JSON, invalid UTF-8, and a valid JSON value that is not an object must return HTTP `400` and must not insert a database row.

`GET /events/<id>` returns HTTP `200` and a JSON object with these fields:

- `id`: the numeric local ID;
- `status`: `pending`, `delivered`, or `failed`;
- `attempt_count`: the total number of sink requests attempted so far; and
- `next_attempt_at`: either `null` or a UTC timestamp formatted `YYYY-MM-DDTHH:MM:SSZ`.

An unknown ID returns `404`. JSON whitespace and extra response fields are not significant.

## Delivery worker

The worker is a one-shot command; it must not sleep. Read and trim the sink URL from `--sink-url-file`. For every due `pending` event, in ascending local-ID order, send one HTTP `POST` to that URL. The request body must be the stored event JSON object, with `Content-Type: application/json`. An event is due when `next_attempt_at` is null or is no later than `--now`.

Treat every `2xx` sink response as success. Mark that event `delivered`, increment `attempt_count`, and clear `next_attempt_at`. Treat a non-`2xx` response or a connection error as a failed attempt. Increment `attempt_count` and use this exact schedule:

| Failed delivery number in the cycle | Result |
| ---: | --- |
| 1 | remain `pending`; next attempt is `--now` + 1 minute |
| 2 | remain `pending`; next attempt is `--now` + 2 minutes |
| 3 | remain `pending`; next attempt is `--now` + 4 minutes |
| 4 | set status `failed`; clear `next_attempt_at` |

Timestamps use UTC and the exact `YYYY-MM-DDTHH:MM:SSZ` form. Commit every state transition to SQLite so separate worker processes and receiver restarts observe it. A later worker invocation before the stored due time must not contact the sink for that event.
