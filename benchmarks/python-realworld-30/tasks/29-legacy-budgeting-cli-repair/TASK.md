# Legacy Budgeting CLI Repair

Repair the editable `budgetdesk/` package. Use Python 3.12 and the standard library only. Do not replace or discard the supplied SQLite data.

## Commands for this stage

From the workspace root, these commands must work:

```bash
python -m budgetdesk import workspace/budget.db inputs/accounts.json inputs/statements
python -m budgetdesk report workspace/budget.db --month 2025-05 --output output/monthly.json
```

`import` accepts a directory and reads its regular `.csv` files in lexical filename order. It must create or migrate the database as needed. Running it again with the same files must not add or change transactions.

## Input formats

`inputs/accounts.json` has an `accounts` array. Each item supplies `source_account`, `name`, `kind`, and `dialect` (`bank_a` or `bank_b`). The statement filename is `<source_account>.csv`.

* `bank_a` columns are `id,date,description,amount`. Amounts are signed: credits are positive and debits are negative. Dates are ISO `YYYY-MM-DD`.
* `bank_b` columns are `Transaction ID,Posted,Details,Debit,Credit`. Exactly one money column is non-empty. Debit is negative and credit is positive. Dates are `MM/DD/YYYY`.

Trim outer whitespace, normalize descriptions to Unicode NFKC, collapse internal whitespace to one ASCII space, and retain their case. Parse and store money with `decimal.Decimal`, at exactly two decimal places. Never use binary floating point for a stored or reported money value.

The durable identity of a source row is `(source_account, source_id)`. The same source ID may legally occur in two accounts. Ignore an exact repeated identity. Apply the rules in `inputs/category_rules.json` in listed order. A case-insensitive regular expression is matched against the normalized description; first match wins. Each rule supplies a `category` and a `kind` of `income`, `spending`, or `transfer`. An unmatched negative row is `Uncategorized` spending and an unmatched positive row is `Other Income` income.

## Monthly report

Write UTF-8 JSON with this shape (JSON whitespace is not significant):

```json
{
  "month": "2025-05",
  "income": "4100.00",
  "spending": "1438.50",
  "transfers_in": "500.00",
  "transfers_out": "500.00",
  "categories": {"Groceries": "118.50"},
  "budget_variance": {"Groceries": "81.50"}
}
```

The example shows real fixture totals but omits other category keys. Include every category with nonzero spending in `categories`, sorted by category name. Spending and transfer totals are positive magnitudes. Transfers are excluded from income and spending. `inputs/budgets.json` maps every budgeted category to a positive amount. `budget_variance` contains every budget key, sorted by category name, and equals budget minus category spending (zero when absent). Format every money value as a string with exactly two fractional digits. Use only transactions whose normalized date is in the requested month. Write deterministic JSON (sorted object keys is acceptable).

Later follow-ups will introduce split transactions and deterministic exports. Retain all behavior from this stage.
