# Concessions and weekly caps

Final requirements:
- `riders` may map rider IDs to a product with inclusive `start`, optional inclusive `end`, integer `discount_percent`, and optional `weekly_cap` Decimal string.
- Product effectiveness uses service day. Apply the discount to each positive raw charge, rounded to cents with `ROUND_HALF_EVEN`.
- Apply discounts first, then daily caps, then weekly caps.
- ISO weeks begin Monday and groups remain rider-specific.
- When a post-daily-cap weekly total exceeds the cap, append one `weekly_cap` adjustment to the rider's last service-day group in that week.
- Order a weekly adjustment after any daily adjustment. Its amount makes the week total exactly the cap.
