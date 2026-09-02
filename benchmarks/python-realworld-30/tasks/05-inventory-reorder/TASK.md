# Inventory Reorder and Transfer Plan

Use Python 3.12 and the standard library only. Do not use the network or install packages.

Implement `solution/reorder.py` so this command works:

```bash
python -m solution.reorder inputs --as-of 2025-06-01 --output output
```

The input directory initially contains:

- `products.csv`: `sku,supplier_id,case_pack,lead_days,safety_days`;
- `stock.csv`: `sku,warehouse,on_hand`;
- `demand.csv`: `date,sku,warehouse,quantity` for daily completed demand;
- `open_pos.csv`: `po_id,sku,warehouse,quantity,arrival_date`;
- `suppliers.json`: supplier objects with `supplier_id` and `minimum_cases`.

Treat quantities and case counts as non-negative whole units.

## Forecast and order rules

For each product and each warehouse present in `stock.csv`:

1. A complete demand day is strictly before `--as-of`. Forecast daily demand as the arithmetic mean of exactly the last 28 complete calendar days (`as-of - 28 days` through `as-of - 1 day`, inclusive). A missing SKU/warehouse/day is zero. Ignore older rows and rows on or after `--as-of`.
2. Target stock is `forecast_daily * (lead_days + safety_days)`.
3. Stock position is on-hand plus open-PO quantity for that SKU/warehouse whose arrival is on or before `as-of + lead_days`. The boundary is inclusive; later POs do not reduce this order.
4. The uncovered target is `max(0, target_stock - stock_position)`. Round it up to a whole unit, then round it up to a multiple of the product's case pack.
5. Combine nonzero lines by supplier. If their aggregate cases are below `minimum_cases`, add one case at a time. Rank candidate lines by their original unrounded uncovered target minus units already added only for minimum padding, largest first; floor that ranking value at zero. Break ties by SKU, then warehouse. These padding cases are part of that line's order.
6. A purchase arrival is `as-of + lead_days`.

Use decimal arithmetic for means and targets. Format forecast and target values with four digits after the decimal point; do not use binary floating point for those output values.

## Initial outputs

Create `output` if needed and replace both files on every run.

`reorder.csv` has one row for every SKU/warehouse, sorted by SKU then warehouse, and this exact header:

```text
sku,warehouse,forecast_daily,target_qty,on_hand,eligible_open_po,reorder_qty,supplier_id,case_pack,order_cases,arrival_date
```

Integer fields have no decimal suffix. `arrival_date` is blank when `reorder_qty` is zero.

`supplier_orders.json` has this shape, with suppliers and lines sorted by ID, SKU, and warehouse:

```json
{
  "as_of": "2025-06-01",
  "suppliers": [
    {
      "supplier_id": "SUP-A",
      "minimum_cases": 6,
      "total_cases": 9,
      "lines": [
        {
          "sku": "SKU001",
          "warehouse": "EAST",
          "quantity": 18,
          "cases": 3,
          "arrival_date": "2025-06-06"
        }
      ]
    }
  ]
}
```

Include only suppliers and lines with nonzero orders. Values in the example show the schema, not fixture answers. JSON whitespace is not significant, but content and ordering must be deterministic.

## Ordering and stated edge behavior

CSV uses UTF-8 and LF line endings. JSON object keys must be deterministic. A product with stock but no demand history has forecast zero and must not create a purchase. If transfer planning is introduced later, it must not create a transfer for that zero-demand product either.
