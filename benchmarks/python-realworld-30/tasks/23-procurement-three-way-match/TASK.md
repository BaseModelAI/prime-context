# Procurement Three-Way Match

Implement `solution/three_way_match.py` so this Python 3.12 standard-library-only command runs:

```bash
python -m solution.three_way_match inputs --output output
```

Use `decimal.Decimal` for every quantity and money calculation. Do not modify `inputs/`.
Replace all selected output files deterministically.

## Inputs and normalization

- `items.csv` gives `item_id,description,base_unit,eaches_per_case`. The base unit is
  `each`. Multiply a case quantity by `eaches_per_case`. Divide a case unit price by
  that factor. Preserve exact decimal values; display normalized quantities without
  unnecessary trailing zeroes.
- `purchase_orders.csv` has one row per PO line.
- `goods_receipts.json` contains a `receipts` array. Aggregate receipt quantities by
  `(po_id,line_id)` after unit conversion.
- `supplier_invoices.xml` has `invoice` elements with header freight and tax and child
  `line` elements. Aggregate invoice quantities and line extensions by PO line after
  conversion. The aggregate invoice unit price is total line extension divided by
  normalized invoice quantity. A zero invoice quantity has unit price zero.

Normalize ordered, received, and invoiced quantity to eaches. Normalize the PO unit
price to price per each. A line passes quantity when
`abs(received_qty - invoiced_qty) <= 0.02 * ordered_qty`. It passes price when
`abs(invoice_unit_price - po_unit_price) <= 0.01 * po_unit_price`. Equality passes.
The line status is `pass` only when both tests pass, otherwise `exception`. Header
freight and tax are never allocated to line unit prices.

## Initial outputs

- `line_matches.csv`, exact header
  `po_id,line_id,supplier_id,item_id,ordered_qty,received_qty,invoiced_qty,po_unit_price,invoice_unit_price,quantity_variance,price_variance,quantity_pass,price_pass,credit_applied,line_payable,status`.
  `quantity_variance` and `price_variance` are non-negative absolute magnitudes:
  `abs(received_qty - invoiced_qty)` and `abs(invoice_unit_price - po_unit_price)`.
  Use those same magnitudes in `exceptions.csv`. Initially `credit_applied` is `0.00`.
  `line_payable` is the sum of invoice line extensions for that PO line. Money fields
  use two decimals with `ROUND_HALF_UP`. Boolean fields are lowercase `true` or
  `false`. Sort by PO ID then line ID.
- `exceptions.csv`, exact header
  `po_id,line_id,reason,quantity_variance,price_variance`. Emit one `quantity` row for a
  failed quantity test and one `price` row for a failed price test. Sort by PO ID,
  line ID, then reason.
- `supplier_summary.json` with top-level key `suppliers`. Its value is a list ordered by
  supplier ID. Each object has exactly `supplier_id`, `currency`, `line_gross`,
  `credit_applied`, `line_payable`, `freight`, `tax`, `header_credit`,
  `unapplied_credit`, and `final_payable`. Compute supplier `line_gross` and
  `line_payable` by summing each PO line's already two-decimal displayed gross and
  payable amounts; do not sum unrounded line extensions and round only at the supplier
  level. Initially credit values are `0.00` and `final_payable = line_payable + freight
  + tax`. All money values are two-decimal strings. Each supplier in this fixture has
  one currency.

Validate PO, item, invoice, and receipt references and fail clearly on malformed input.
Write only `solution/` and the selected output directory.

The judge copies only `solution/__init__.py` and `solution/three_way_match.py` into fresh fixture workspaces. Keep all candidate implementation code in those declared artifacts.
