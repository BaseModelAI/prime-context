# Utility Consumption Anomaly Report

Build a deterministic utility-usage reporting command using only the Python standard library:

```bash
python -m solution.utility_anomalies inputs/monthly_usage.csv --output output
```

The input header is `meter_id,month,kwh`. `month` is `YYYY-MM` and `kwh` is a decimal number. Rows are ordered by meter and month, but your result must not depend on input row order.

For each meter, consider observations in month order. Once six prior **observed** values exist, compare the current value with the median of exactly those preceding six observations. Missing calendar months are gaps, not zero-valued observations and do not reset this rolling window. MAD is the median of the six absolute deviations from that baseline median. Flag the current row when:

```text
abs(kwh - median) > max(3 * MAD, 0.25 * median)
```

Severity is `abs(kwh - median) / median` when the median is positive, and zero otherwise. Direction is `high` above the median and `low` below it.

Create `output/anomalies.csv` with this exact header:

```text
meter_id,month,kwh,baseline_median,mad,severity,direction
```

Format all numeric fields with exactly six digits after the decimal point. Sort anomalies by descending numeric severity, then `meter_id`, then `month` in ascending Unicode order.

Create `output/gaps.csv` with header `meter_id,month`. For each meter, list every absent calendar month strictly between its first and last observed month. Sort by meter then month.

Create a self-contained UTF-8 `output/report.html` with no JavaScript or external resources. It must state the exact total meter, anomaly, and gap counts and contain a table of the ten largest anomalies in the same order as the CSV (or all rows when fewer than ten). Escape all dynamic HTML text, including meter IDs. CSV files and the HTML file must use LF line endings.

The held-out edge has six identical values followed by a 30% increase. MAD is zero, but the 25% branch must still flag the increase.
