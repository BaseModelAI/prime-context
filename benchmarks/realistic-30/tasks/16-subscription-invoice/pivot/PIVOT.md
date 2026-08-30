# Plan changes and metered usage pivot

Preserve initial behavior and add event types:
- A `plan_change` has unique `id`, effective `at` date, and a complete replacement plan.
- Split active service at in-month effective dates and emit one separately rounded recurring line per segment.
- A `usage` event has unique `id`, `at` date, and positive integer `units`; assign it to the active segment containing that date.
- Plans may define graduated `tiers` with positive integer `up_to` cumulative bounds or final `null`, and nonnegative Decimal-string `unit_price`.
- Aggregate usage by segment, reset tiers at each plan change, and emit one usage line after that segment's recurring line.
- Ignore usage outside active service. Reject duplicate plan-change dates.
- Event input order must not affect output.
