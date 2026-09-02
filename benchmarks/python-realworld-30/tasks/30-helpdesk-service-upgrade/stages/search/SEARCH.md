# Search and export

Add `GET /search?q=<text>` to the existing server. Normalize searchable text with Unicode NFKC and case-fold it, then tokenize maximal Unicode alphanumeric runs. Normalize query terms the same way. Every query term must occur in at least one of the ticket subject, ticket body, or any comment body.

For each matching ticket, count occurrences of all query terms in each field group. Its score is `3 * subject_hits + 2 * body_hits + comment_hits`. Return `{"tickets": [...]}` with each full ticket record plus integer `score`, ordered by descending score, then descending normalized `updated_at`, then ascending numeric ticket ID. The same token repeated in the query is counted once.

Add:

```bash
cd service
python -m helpdesk export ../workspace/helpdesk.db --status open --output ../output/tickets.csv
```

Export matching tickets in ascending numeric ticket ID with exact header:

```text
ticket_id,subject,status,priority,assignee_email,requester_email,created_at,updated_at,sla_due_at
```

The status filter is required. Use an empty field for null values and normal CSV quoting with LF record endings.
