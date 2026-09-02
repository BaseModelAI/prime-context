# SLA and escalations

`inputs/sla.json` supplies UTC business intervals by weekday, a list of full-day UTC holidays, and priority durations in business minutes. An interval includes its start and excludes its end. SLA time starts at ticket creation. Every customer comment that reopens a resolved or closed ticket starts a new SLA at that comment timestamp. Time outside intervals does not consume minutes. The exact instant the final business minute ends is the due time. Store `sla_due_at` as RFC 3339 UTC with a `Z` suffix.

Commands which need SLA values read `../inputs/sla.json` when run from `service/` and update missing or newly reopened due times. Run:

```bash
cd service
python -m helpdesk escalations ../workspace/helpdesk.db --as-of 2025-05-28T17:00:00Z --output ../output/escalations.csv
```

Include open and pending-customer tickets whose due time is at or before `--as-of`. Write UTF-8 CSV with this exact header:

```text
ticket_id,priority,due_at,minutes_overdue,assignee_email
```

`minutes_overdue` counts only business minutes after the due instant through `--as-of`. Order rows by ascending numeric ticket ID. An unassigned ticket has an empty `assignee_email`.
