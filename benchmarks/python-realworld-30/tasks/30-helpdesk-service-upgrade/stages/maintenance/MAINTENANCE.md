# Stale-ticket maintenance

`../inputs/maintenance.json` sets `pending_customer_business_days`. Run:

```bash
cd service
python -m helpdesk maintenance ../workspace/helpdesk.db --as-of 2025-06-02T17:00:00Z --output ../output/maintenance.json
```

For a `pending_customer` ticket, count full configured business days after its `pending_since` timestamp, using the business intervals and holidays in `../inputs/sla.json`. The server must set `pending_since` whenever a ticket enters `pending_customer` and clear it when it leaves that status. Legacy version-1 rows already in that status use `updated_at`. Close a ticket when the configured number of full business days has elapsed. Set `updated_at` to `--as-of` and keep all comments.

Write JSON with exactly `as_of` and `closed_ticket_ids`; the ID list is numeric and ascending. Repeating the command at the same time is idempotent.
