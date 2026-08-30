# Daily-cap settlement pivot

Preserve raw charge behavior and add:
- Optional `daily_cap` Decimal string in rules.
- Group charges by rider and service day after pairing and pricing.
- If a group's positive charge total exceeds the cap, append one `daily_cap` adjustment whose negative amount makes the group total equal the cap.
- Adjustment `started_at` is the lexically greatest started_at in its group and sorts after ordinary charges at that timestamp.
- Return groups in service-day/rider order, with charges chronological and their adjustment last.
- Riders are capped independently and the 04:00 service-day boundary remains exact.
