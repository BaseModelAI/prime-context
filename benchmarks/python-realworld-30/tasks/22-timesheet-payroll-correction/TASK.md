# Timesheet and Payroll Correction

Implement `solution/payroll.py` so the following Python 3.12 standard-library-only command runs:

```bash
python -m solution.payroll inputs --week-ending 2025-11-09 --output output
```

All currency calculations must use `decimal.Decimal`. Input timestamps are ISO 8601
strings with explicit UTC offsets. Punches are minute-aligned. The requested week is
the Monday through Sunday containing `--week-ending`, based on each employee's local
date.

## Inputs

- `employees.csv`: `employee_id,name,group,hourly_rate,timezone`. Group `U` is union;
  other groups are non-union. Time zones are IANA names.
- `punches.csv`: `record_id,employee_id,shift_id,kind,timestamp`. Kinds are `IN`,
  `BREAK_START`, `BREAK_END`, and `OUT`.
- `holidays.csv`: `date,name`, where the date is a local calendar date.
- `company_rules.json`: fixed rule values supplied with the fixture.

Sort a shift's punches by instant, then record ID. Pair one `IN` with one later `OUT`.
An explicit `BREAK_START`/`BREAK_END` pair removes that actual elapsed interval. Report
unmatched, duplicate, reversed, or unknown punch sequences in `exceptions.csv` and do
not invent their time.

## Pay rules

- If a valid shift spans more than six actual elapsed hours and contains no explicit
  break, remove its final 30 worked minutes. Otherwise subtract only explicit breaks.
- Calculate on exact elapsed one-minute intervals. Convert each interval's start instant
  to the employee zone for local-day, holiday, and night classification. This makes
  repeated fall-back minutes count twice.
- Non-union paid minutes above 40 hours in chronological order during the week earn
  1.5 times base. Group `U` has no weekly overtime under the initial rules.
- Local-time minutes whose clock time is at or after 22:00 or before 06:00 earn an
  additive 10% of base pay, including overtime minutes.
- Holiday minutes earn an additive 100% of base pay. Additive premiums do not change
  overtime thresholds.
- Sum exact Decimal minute amounts, then round each reported money value once to cents
  with `ROUND_HALF_UP`.

## Outputs

Replace the output files deterministically:

- `payroll.csv`, header
  `employee_id,regular_hours,overtime_hours,doubletime_hours,night_minutes,holiday_hours,gross_pay`.
  Include every employee with valid paid time, ordered by employee ID. Hours use two
  decimal places and money uses two decimal places.
- `shift_detail.csv`, header
  `employee_id,shift_id,paid_minutes,regular_minutes,overtime_minutes,doubletime_minutes,night_minutes,holiday_minutes,gross_pay`,
  ordered by employee ID then first punch instant then shift ID.
- `exceptions.csv`, header `employee_id,shift_id,record_id,reason`, ordered by all four
  fields. Write the header even when empty.

Do not modify `inputs/`. Write only `solution/` and the selected output directory.
A daylight-saving fall-back shift is paid by actual elapsed time rather than naive
wall-clock subtraction.

The judge copies only `solution/__init__.py` and `solution/payroll.py` into fresh fixture workspaces. Keep all candidate implementation code in those declared artifacts.
