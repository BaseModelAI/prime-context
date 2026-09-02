# Multi-Warehouse Order Fulfillment

Build a deterministic fulfillment planner using only Python 3.12 and the standard
library. Make this command work from the workspace root:

```bash
python -m solution.fulfill inputs --output output
```

The command must create `output/` when needed and replace the required output
files on every run.

## Initial inputs

All files are UTF-8 CSV files with headers unless noted otherwise.

- `inputs/orders.csv`: `order_id,priority,due_date,allow_partial`.
  `allow_partial` is `true` or `false`.
- `inputs/order_lines.csv`: `order_id,line_id,sku,requested_qty`. Quantities are
  positive integers. A SKU occurs at most once in an order.
- `inputs/inventory.csv`: `warehouse_id,sku,on_hand`. `on_hand` is the physical
  stock before the rows in `existing_allocations.csv` are deducted.
- `inputs/shipping_cost.csv`: `warehouse_id,base_cost,per_unit_cost`.
  Costs are decimal amounts.
- `inputs/existing_allocations.csv`:
  `order_id,line_id,warehouse_id,quantity,status`, where status is `shipped` or
  `reserved`. These rows are valid parts of their order and must be preserved in
  the initial plan.

There are four warehouses. Treat missing warehouse/SKU inventory as zero.
Validate references well enough to fail clearly on malformed input rather than
silently inventing an order, line, warehouse, or stock quantity.

## Planning rules

First deduct all preserved existing allocations from physical inventory. Then
process orders by this exact key:

1. priority: `urgent`, `high`, `normal`;
2. due date ascending;
3. order ID ascending.

Fix one order's choice before stock is made available to the next order.
Existing allocations count toward the order's filled quantities, used warehouse
set, and three-warehouse limit.

For the unfilled part of the current order, enumerate feasible allocations that
make the order use no more than three warehouses in total. Units of a line may
be split between warehouses. If a full allocation exists, choose
lexicographically by:

1. fewer used warehouses;
2. lower shipping cost;
3. the ascending tuple of used warehouse IDs.

If no full allocation exists and `allow_partial=true`, choose by:

1. more completely filled order lines;
2. more total requested units filled;
3. fewer used warehouses;
4. lower shipping cost;
5. the ascending tuple of used warehouse IDs.

If no full allocation exists and `allow_partial=false`, allocate no new units to
that order. Preserve any pre-existing rows and backorder every remaining unit.
This rule also applies when a non-partial order is only short by one unit.

Shipping cost is calculated per order. It is the sum of one `base_cost` for each
used warehouse plus `per_unit_cost * units` for every unit allocated from that
warehouse, including preserved units. Use `decimal.Decimal` for this comparison.
For the chosen warehouse tuple, source each line from warehouses in increasing
`(per_unit_cost, warehouse_id)` order. This is also the final deterministic tie
rule for allocations that otherwise have the same objective values.

## Initial outputs

Write these exact headers and row orders. Integer fields must be plain base-10
integers with no decimal suffix.

- `output/allocations.csv`:
  `order_id,line_id,warehouse_id,quantity,status`. Include every positive final
  allocation. Preserve the status of input rows and use `reserved` for newly
  planned units. Aggregate rows with the same order, line, warehouse, and status.
  Sort by `order_id,line_id,warehouse_id,status`.
- `output/backorders.csv`:
  `order_id,line_id,sku,requested_qty,allocated_qty,backorder_qty`. Include only
  lines with a positive backorder. Sort by `order_id,line_id`.
- `output/inventory_after.csv`:
  `warehouse_id,sku,on_hand,allocated_qty,remaining_qty`. Include every row from
  `inventory.csv`, even when all numeric values are zero. Sort by
  `warehouse_id,sku`.

The total allocated quantity for a line must never exceed its request. The total
allocated from a warehouse/SKU must never exceed its input `on_hand`. Outputs
must be deterministic and use LF line endings.

## Stated edge behavior

An order that cannot be fully filled and has `allow_partial=false` receives no
new allocation at all. Report every unfilled unit for every line in
`backorders.csv`; do not partially consume stock for that order.

The judge copies only `solution/__init__.py` and `solution/fulfill.py` into fresh fixture workspaces. Keep all candidate implementation code in those declared artifacts.
