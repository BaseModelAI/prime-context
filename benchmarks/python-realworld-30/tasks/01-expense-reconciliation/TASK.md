# Household Expense Reconciliation

Build `solution/reconcile.py`. It must run from the workspace root as:

```bash
python -m solution.reconcile --bank inputs/bank.csv --receipts inputs/receipts.json --categories inputs/categories.csv --output output
```

Use only the Python standard library. Use `decimal.Decimal`, not binary floating point, for every money calculation.

## Inputs

- `bank.csv` has 160 rows with `transaction_id,posted_date,description,amount,currency`. Negative amounts are debits. Positive amounts are refunds or income.
- `receipts.json` is a JSON array of 105 objects. Each object has `receipt_id,merchant,paid_date,total,currency`.
- `categories.csv` has ordered `pattern,category` rows.

Normalize text with Unicode NFKC, collapse all whitespace to one space, strip the result, and compare case-insensitively. Categorize every bank row by the first category pattern that is a normalized substring of the normalized description. Use `Uncategorized` if no pattern matches. A positive row whose description matches no category uses `Refund` instead.

A receipt may match one debit when currency and absolute amount are equal, the dates differ by at most two days, and either the normalized merchant contains the normalized bank description or the normalized bank description contains the normalized merchant. Filter out incompatible receipts first. If several remain, choose the smallest absolute date difference, then lexical `receipt_id`. Process bank rows in input order, and never reuse a receipt. Positive rows are not receipt-matched.

For `status`, write `matched` for a matched debit, `unmatched` for any other debit, and `not_applicable` for a positive row. Leave `matched_receipt_id` empty when there is no match.

## Outputs

Create the output directory and replace these files deterministically:

1. `reconciliation.csv`: header is the bank header followed by `category,matched_receipt_id,status`. Preserve every bank row in its original order and spelling.
2. `monthly_summary.json`: an object keyed by `YYYY-MM`, then category. Values are two-decimal strings. A debit adds its absolute amount to spending; every positive row subtracts its amount from its assigned category. Omit `Transfer` rows completely. Include non-Transfer categories even when the resulting total is negative. Sort month keys and category keys and end the file with a newline.
3. `unmatched_receipts.csv`: header `receipt_id,merchant,paid_date,total,currency`; include unused receipts in lexical `receipt_id` order and preserve their original field spelling.

CSV files use UTF-8, `newline=""`, and the exact headers above.

## Stated edge behavior

When two receipts have the same amount and date but only one merchant is compatible with the bank description, the compatible receipt must win even if its ID sorts later.
