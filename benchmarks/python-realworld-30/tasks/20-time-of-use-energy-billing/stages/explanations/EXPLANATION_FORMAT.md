# Required explanation format

Write one UTF-8 text file per billed customer with LF endings. Use these lines exactly and in this order:

```text
Customer: <customer_id>
Period: <YYYY-MM>
Band: <band> | Rate: <rate_id> | Intervals: <integer> | kWh: <four decimals> | Energy: <two decimals>
... one Band line per bill_detail.csv row, sorted by band then rate_id ...
Demand | Rate: <demand_rate_id> | kW: <three decimals> | Charge: <two decimals>
Tax | Rate: <four decimals> | Charge: <two decimals>
Prior total: <two decimals>
Correction delta: <signed two decimals>
Final total: <two decimals>
```

`Prior total` is the total under the original tariff. `Correction delta` is final minus prior. Prefix a positive delta with `+`; use `-` for a negative delta and exactly `0.00` for zero. Every file ends with one newline.
