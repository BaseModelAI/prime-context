# Failed-event replay

Add this command:

```bash
python -m webhook_app replay --db workspace/webhooks.db --failed
```

`--failed` selects every event currently in `failed` status. Reset each selected event to `pending`, clear `next_attempt_at`, and reset its failed-delivery count for the new cycle to zero. Do not contact the sink from the replay command. Preserve the event payload and the total `attempt_count`; `GET /events/<id>` must continue to report that lifetime total.

The worker retry delays and four-failure terminal rule apply independently to the new cycle. Persist the cycle count in SQLite so worker invocations and receiver restarts do not lose it. Running replay when no event is failed succeeds without changing pending or delivered events.
