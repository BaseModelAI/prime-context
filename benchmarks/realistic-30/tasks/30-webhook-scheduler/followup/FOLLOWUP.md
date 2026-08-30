# Per-host limits, cancellation, and JSON CLI

Final requirements:
- Host key is lower-cased `urlsplit(url).hostname`; ports share a host.
- At most `max_per_host` futures may run per host. Other hosts must still dispatch. A later `pump()` fills freed slots.
- Protect callback-touched state with one re-entrant lock.
- `cancel`: pending becomes cancelled and returns true. Running calls `Future.cancel()` and returns true only if it succeeds. Terminal returns false. Cancelled work never retries.
- `close()` shuts down only an executor owned by the scheduler.
- CLI entry: `webhooks.cli.main(argv, stdout, sender, clock, executor)` for `--json --id ID URL PAYLOAD_JSON`.
- JSON mode emits exactly one compact, sorted, newline-terminated `DeliveryView` object. Return 0 succeeded, 1 failed/cancelled, and 2 pending/running or usage error.
