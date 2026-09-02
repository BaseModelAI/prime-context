# Invoice and Payment Matching

Build `solution/invoice_match.py`. It must run from the workspace root as:

```bash
python -m solution.invoice_match inputs --output output
```

Use only the Python standard library. Use `decimal.Decimal`, not binary floating point, for all money calculations.

## Inputs

The input directory contains:

- `invoices.csv` with the exact header `invoice_id,customer_id,issued_date,due_date,amount,currency`. Invoice IDs are unique. Amounts are positive.
- `payments.xml` with a `<payments>` root. Each child is a `<payment>` whose attributes are `payment_id`, `customer_id`, `date`, `amount`, and `currency`, and which has one `<memo>` child. Payment IDs are unique and amounts are positive.
- `credits.json`, a JSON array in source order. Each object has `credit_id`, `customer_id`, `date`, `amount`, `currency`, and `invoice_id`. A nonempty string `invoice_id` makes the credit invoice-specific; `null` makes it customer-level. Credit IDs are unique and amounts are positive.

Dates are ISO `YYYY-MM-DD`. Money input has two fractional digits.

## Matching rules

An invoice starts with its full amount as its open balance. Apply sources in this exact order:

1. invoice-specific credits, in their JSON order;
2. customer-level credits, in their JSON order;
3. payments, in XML document order.

An invoice-specific credit applies only to its named invoice, and only when its customer and currency agree. It does not spill to other invoices. Any amount which cannot be used is unapplied.

Allocate a customer-level credit among that customer's open invoices in the same currency. Allocate by oldest `due_date`, breaking a tie by lexical `invoice_id`.

Allocate a payment the same way, with one precedence rule. Split its memo on whitespace. If a token is exactly equal, including case and punctuation, to the ID of an open invoice with the same customer and currency, apply to that invoice first. If several tokens qualify, use the first qualifying token from left to right. After that invoice is full, allocate any remainder by oldest due date and invoice ID. A token for a closed invoice or for a different customer or currency has no precedence; allocate the whole payment normally.

An allocation may finish an invoice but must never make its balance negative. A source may create several application rows. If a source has money left after all allowed allocations, report the remainder once as unapplied. Fully applied sources have no exception row.

## Outputs

Create the output directory if necessary. Replace these three files deterministically:

1. `invoice_status.csv`, with the exact header:

   `invoice_id,customer_id,issued_date,due_date,amount,currency,applied_credit,applied_payment,balance,status`

   Include one row per invoice in original CSV order. Preserve the invoice identifiers, dates, and currency. `status` is `paid` when the balance is zero and `open` otherwise.

2. `applications.csv`, with the exact header:

   `source_type,source_id,invoice_id,amount,currency`

   Write one row per nonzero allocation in the processing and allocation order above. `source_type` is `credit` or `payment`.

3. `exceptions.csv`, with the exact header:

   `source_type,source_id,customer_id,currency,unapplied_amount,reason`

   Write one row when a source has a positive remainder, in source processing order. The exact `reason` value is `unapplied_balance`.

Every monetary field in every output uses exactly two fractional digits. CSV files are UTF-8 and are written with `newline=""`.

## Stated edge behavior

A payment can name an invoice that an earlier source has already closed and can exceed the customer's remaining open balance. In that case, skip the closed named invoice, finish the customer's other open invoices in normal order, and report the payment remainder as unapplied.
