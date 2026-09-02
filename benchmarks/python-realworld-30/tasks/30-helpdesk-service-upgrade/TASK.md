# Helpdesk Service Upgrade

Repair and extend the editable `service/helpdesk/` package using only Python 3.12 and the standard library. The runner launches this candidate service from `service/` on `127.0.0.1`, writes its URL to `inputs/helpdesk_url.txt`, and restarts it after each later stage so code changes take effect. There is no fixture service or external agent API. Preserve every supplied SQLite agent, ticket, comment, and numeric ID while migrating the version-1 database in place.

Run initial commands from `service/`:

```bash
python -m helpdesk serve --db ../workspace/helpdesk.db --port 0
python -m helpdesk create-agent ../workspace/helpdesk.db --email agent@example.test
```

`create-agent` inserts a normalized, case-folded email directly in the local database. It is idempotent and prints one JSON agent record. New agents use `1970-01-01T00:00:00Z` so the command never reads wall-clock time.

A server binds only to `127.0.0.1`. With `--port 0`, print exactly one flushed `LISTENING <port>` line when ready, then serve. Bodies and errors use UTF-8 JSON.

## Required API

* `POST /tickets` requires `subject`, `body`, `requester_email`, `priority`, and `created_at`; it creates an `open` ticket and returns `201` with the full record. `assignee_id` may be null.
* `GET /tickets/<id>` returns the ticket with `comments`, or `404`.
* `PATCH /tickets/<id>` may update `subject`, `body`, `status`, `priority`, or `assignee_id`; deterministic `updated_at` is required.
* `POST /tickets/<id>/comments` requires `author_email`, `author_type` (`customer` or `agent`), `body`, and `created_at`, and returns `201`. A customer comment reopens a `resolved` or `closed` ticket.
* `GET /tickets` lists by ascending numeric ID. Optional `status` and numeric `assignee` filters use AND.

Statuses are `open`, `pending_customer`, `resolved`, and `closed`. Priorities are `urgent`, `normal`, and `low`. Reject invalid JSON, enums, unknown assignees, and missing ticket IDs without partial writes. Server writes must commit so they survive runner-managed restarts.

Later stages add mbox import/deduplication, business-time SLA and reopening, deterministic search/export, and stale maintenance. Keep every prior behavior. In particular, external `Message-ID` is globally unique: if the same value occurs in two different mbox files, import it only once and report the later copy as skipped. Future inputs do not exist before their stage.

Normalize timestamps to RFC 3339 UTC with `Z`, and emails with Unicode NFKC plus case-folding. Do not use wall-clock time, optional SQLite extensions, subprocess tools, public network, or any second API.
