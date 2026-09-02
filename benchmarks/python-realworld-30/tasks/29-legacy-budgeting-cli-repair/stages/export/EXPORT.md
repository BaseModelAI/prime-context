# Deterministic export follow-up

Add:

```bash
python -m budgetdesk export workspace/budget.db --format csv --output output/transactions.csv
python -m budgetdesk export workspace/budget.db --format json --output output/transactions.json
```

Use the columns and ordering in `inputs/export_schema.json`. Emit one row for an unsplit transaction. Emit one row per part for a split transaction, repeating the original parent fields. For unsplit rows, the three split fields are empty strings. For split rows, `split_part` is the decimal integer text and split money has two decimals. CSV has the exact header and `lineterminator="\n"`. JSON is an array of objects with the same string keys and values, in the same order as CSV. It ends with one newline. Export all dates and all original source IDs.
