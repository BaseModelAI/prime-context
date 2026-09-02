# Support SLA Event Analysis

Build a streaming support-ticket SLA report using only the Python standard library:

```bash
python -m solution.sla_report inputs/events.jsonl inputs/sla.json --output output
```

`events.jsonl` is UTF-8 JSON Lines. Each object has `event_id`, `ticket_id`, `timestamp`, and `type`. A `created` event also has `priority`. Supported types are `created`, `agent_reply`, `bot_reply`, `waiting_customer`, `customer_reply`, `resolved`, and `reopened`. Timestamps are UTC ISO 8601 strings ending in `Z`. Lines are mostly time ordered, but tickets are interleaved and an individual ticket's events may be out of order. Ignore every occurrence of an `event_id` after its first occurrence in the file. Stream the file line by line; do not load the entire file text as one string.

For each ticket, sort retained events by timestamp and then event ID. The creation is its first `created` event. First response is the first `agent_reply` strictly after creation; `bot_reply` never counts. Resolution is final only when the last `resolved` event is later than every `reopened` event. A reopen therefore invalidates an earlier resolution until another resolution occurs.

First-response time is elapsed whole minutes from creation to first response. Resolution time is elapsed whole minutes from creation to the last final resolution, less each complete non-overlapping interval from `waiting_customer` to the next `customer_reply`. Ignore an incomplete waiting interval and ignore waiting events while already waiting. Clip a complete interval to the creation/final-resolution range before subtracting it. All fixture timestamps fall on minute boundaries.

`sla.json` maps priority names to `first_response_minutes` and `resolution_minutes`. A value breaches its target only when it is strictly greater. A missing first response or non-final resolution is represented by an empty CSV field and counts as a breach for that metric.

Write `output/tickets.csv` with exact header:

```text
ticket_id,priority,created_at,first_response_minutes,resolution_minutes,first_response_breached,resolution_breached,status
```

Use lowercase `true`/`false`. Status is `resolved` or `open`. Sort rows by `ticket_id` in ascending Unicode order.

Write `output/summary.json` as an object with `total_tickets` and `by_priority`. Every priority from `sla.json` must appear in lexical order. Its object contains `tickets`, `first_response_breaches`, and `resolution_breaches`. Write deterministic sorted keys and a final LF newline. Both output files use UTF-8 and LF endings.

The held-out edge has out-of-order events and a duplicate event ID. Timestamp ordering and first-occurrence deduplication must produce the stated business result.
