# Time-of-Use Energy Billing

Use Python 3.12 and only the standard library. Implement this command:

```bash
python3.12 -E -S -m solution.energy_bill inputs --period 2025-10 --output output
```

The input files are:

* `customers.csv`: `customer_id,timezone,tax_rate`.
* `readings.csv`: 15-minute rows with `customer_id,interval_start,kwh,kw`. Each timestamp has an explicit UTC offset.
* `tariffs.json`: local day schedules, effective energy rates, and the monthly demand rule.
* `holidays.json`: local calendar dates that use the holiday schedule.

For every reading, parse `interval_start` as an instant and convert that instant to the customer's `zoneinfo` timezone. Use this converted local timestamp for the requested billing month, the local date type, the half-open schedule band, and the half-open energy-rate effective period. A holiday schedule takes precedence over a weekend schedule; a weekend takes precedence over a weekday. Times and effective-period boundaries in `tariffs.json` are customer-local wall times. `24:00` is only a schedule end boundary.

Use `Decimal` for every quantity, rate, charge, and total. Group interval kWh by `(customer_id, band, rate_id)`, then multiply the grouped quantity by that rate. Round each group charge to cents with `ROUND_HALF_UP`. The billed energy charge is the sum of those rounded group charges.

For the demand charge, consider only intervals in a band listed by `demand.qualifying_bands`. The billed kW is the largest eligible interval kW for the month. Multiply it by `demand.price_per_kw` and round to cents with `ROUND_HALF_UP`. If there is no eligible interval, both demand kW and charge are zero. A documented meter-correction interval can have negative kWh: its kWh still reduces its energy group quantity and charge, but that interval is excluded from demand-maximum selection regardless of its `kw` value.

Compute tax by multiplying `energy_charge + demand_charge` by the customer's tax rate and rounding to cents with `ROUND_HALF_UP`. The total is energy charge plus demand charge plus tax.

Create `output` as needed and replace deterministic outputs on every run. Write UTF-8 CSV with LF records and these exact headers:

```text
bills.csv:
customer_id,period,energy_charge,demand_rate_id,demand_kw,demand_charge,tax_rate,tax_charge,total

bill_detail.csv:
customer_id,period,band,rate_id,interval_count,kwh,energy_charge
```

Sort bills by `customer_id`. Sort detail by `(customer_id, band, rate_id)`. Format kWh with four decimals, demand kW with three decimals, tax rates with four decimals, and every monetary value with two decimals. Preserve exact tariff rate IDs. Do not put the generated reading corpus in source code or load it into a conversation; process the local files.
