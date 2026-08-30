# Daily overtime and night differential pivot

Preserve weekly defaults and add optional contract fields:
- `daily_overtime_after` hours, default 24.
- `daily_doubletime_after` hours, default 24 and not less than the overtime threshold.
- `night_differential` nonnegative Decimal dollars per hour, default zero.
- Local night quarters start at or after 22:00 or before 06:00.
- Classify each quarter by the maximum multiplier that applies: regular 1.0, weekly/daily overtime 1.5, or daily double time 2.0. Rules never stack.
- Add night differential after multiplied base pay.
- Return doubletime hours and differential totals. Round only final employee and payroll monetary totals to cents.
