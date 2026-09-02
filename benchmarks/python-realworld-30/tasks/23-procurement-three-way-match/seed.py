#!/usr/bin/env python3
"""Create deterministic initial fixtures for Task 23."""

import argparse
import csv
import json
import random
import shutil
import xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path

SEED = 20260831 + 23


def decimal_text(value: Decimal) -> str:
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def write_csv(path: Path, header: list[str], rows: list[list[str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def write_invoices(path: Path, invoices: list[dict]) -> None:
    root = ET.Element("supplier_invoices")
    for invoice in invoices:
        node = ET.SubElement(
            root,
            "invoice",
            {key: str(invoice[key]) for key in (
                "invoice_id", "supplier_id", "po_id", "invoice_date",
                "currency", "freight", "tax"
            )},
        )
        for line in invoice["lines"]:
            ET.SubElement(node, "line", {key: str(value) for key, value in line.items()})
    ET.indent(root, space="  ")
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write("\n")


def seed_edge(inputs: Path) -> None:
    write_csv(
        inputs / "items.csv",
        ["item_id", "description", "base_unit", "eaches_per_case"],
        [["EDGE-ITEM", "Edge fasteners", "each", "10"]],
    )
    write_csv(
        inputs / "purchase_orders.csv",
        ["po_id", "line_id", "supplier_id", "item_id", "ordered_qty", "unit", "unit_price", "currency"],
        [["PO-EDGE", "L01", "SUP-EDGE", "EDGE-ITEM", "10", "each", "10.00", "USD"]],
    )
    receipts = {
        "receipts": [{
            "receipt_id": "REC-EDGE-1", "received_date": "2025-07-03",
            "po_id": "PO-EDGE", "line_id": "L01", "quantity": "1", "unit": "case"
        }]
    }
    (inputs / "goods_receipts.json").write_text(
        json.dumps(receipts, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    write_invoices(inputs / "supplier_invoices.xml", [{
        "invoice_id": "INV-EDGE", "supplier_id": "SUP-EDGE", "po_id": "PO-EDGE",
        "invoice_date": "2025-07-05", "currency": "USD", "freight": "5.00", "tax": "0.00",
        "lines": [{
            "invoice_line_id": "INV-EDGE-L1", "po_line_id": "L01", "item_id": "EDGE-ITEM",
            "quantity": "10", "unit": "each", "unit_price": "10.00"
        }],
    }])


def seed_main(inputs: Path, rng: random.Random) -> None:
    factors = [6, 12, 24, 48]
    items = []
    for index in range(1, 13):
        items.append([
            f"ITEM-{index:03d}", f"Procurement item {index:02d}", "each", str(factors[(index - 1) % len(factors)])
        ])
    write_csv(
        inputs / "items.csv",
        ["item_id", "description", "base_unit", "eaches_per_case"],
        items,
    )

    po_rows = [
        ["PO-100", "L01", "SUP-ALPHA", "ITEM-001", "100", "each", "10.00", "USD"],
        ["PO-100", "L02", "SUP-ALPHA", "ITEM-003", "10", "case", "480.00", "USD"],
        ["PO-101", "L01", "SUP-ALPHA", "ITEM-005", "240", "each", "2.50", "USD"],
        ["PO-200", "L01", "SUP-BETA", "ITEM-002", "5", "case", "180.00", "USD"],
        ["PO-200", "L02", "SUP-BETA", "ITEM-006", "80", "each", "4.00", "USD"],
        ["PO-300", "L01", "SUP-GAMMA", "ITEM-007", "50", "each", "8.00", "EUR"],
    ]
    suppliers = [("SUP-ALPHA", "USD"), ("SUP-BETA", "USD"), ("SUP-GAMMA", "EUR"), ("SUP-DELTA", "USD")]
    for index in range(24):
        po_id = f"PO-{400 + index // 2:03d}"
        line_id = f"L{index % 2 + 1:02d}"
        supplier, currency = suppliers[(index // 2) % len(suppliers)]
        item_number = index % 12 + 1
        factor = Decimal(factors[(item_number - 1) % len(factors)])
        unit = "case" if index % 3 == 0 else "each"
        ordered = Decimal(rng.randrange(4, 13) if unit == "case" else rng.randrange(36, 151))
        base_price = Decimal(rng.randrange(125, 2601)) / Decimal("100")
        named_price = base_price * factor if unit == "case" else base_price
        po_rows.append([
            po_id, line_id, supplier, f"ITEM-{item_number:03d}", decimal_text(ordered), unit,
            f"{named_price:.2f}", currency,
        ])
    write_csv(
        inputs / "purchase_orders.csv",
        ["po_id", "line_id", "supplier_id", "item_id", "ordered_qty", "unit", "unit_price", "currency"],
        po_rows,
    )

    receipts = [
        {"receipt_id": "REC-001", "received_date": "2025-06-02", "po_id": "PO-100", "line_id": "L01", "quantity": "60", "unit": "each"},
        {"receipt_id": "REC-002", "received_date": "2025-06-04", "po_id": "PO-100", "line_id": "L01", "quantity": "4", "unit": "case"},
        {"receipt_id": "REC-003", "received_date": "2025-06-05", "po_id": "PO-100", "line_id": "L02", "quantity": "10", "unit": "case"},
        {"receipt_id": "REC-004", "received_date": "2025-06-06", "po_id": "PO-101", "line_id": "L01", "quantity": "240", "unit": "each"},
        {"receipt_id": "REC-005", "received_date": "2025-06-06", "po_id": "PO-200", "line_id": "L01", "quantity": "5", "unit": "case"},
        {"receipt_id": "REC-006", "received_date": "2025-06-07", "po_id": "PO-200", "line_id": "L02", "quantity": "80", "unit": "each"},
        {"receipt_id": "REC-007", "received_date": "2025-06-08", "po_id": "PO-300", "line_id": "L01", "quantity": "50", "unit": "each"},
    ]

    invoices = [
        {
            "invoice_id": "INV-100-A", "supplier_id": "SUP-ALPHA", "po_id": "PO-100",
            "invoice_date": "2025-06-08", "currency": "USD", "freight": "18.00", "tax": "96.00",
            "lines": [
                {"invoice_line_id": "INV-100-A-1", "po_line_id": "L01", "item_id": "ITEM-001", "quantity": "8", "unit": "case", "unit_price": "120.00"},
                {"invoice_line_id": "INV-100-A-2", "po_line_id": "L02", "item_id": "ITEM-003", "quantity": "10", "unit": "case", "unit_price": "484.80"},
            ],
        },
        {
            "invoice_id": "INV-100-B", "supplier_id": "SUP-ALPHA", "po_id": "PO-100",
            "invoice_date": "2025-06-09", "currency": "USD", "freight": "0.00", "tax": "4.00",
            "lines": [
                {"invoice_line_id": "INV-100-B-1", "po_line_id": "L01", "item_id": "ITEM-001", "quantity": "4", "unit": "each", "unit_price": "10.00"},
            ],
        },
        {
            "invoice_id": "INV-101", "supplier_id": "SUP-ALPHA", "po_id": "PO-101",
            "invoice_date": "2025-06-10", "currency": "USD", "freight": "5.00", "tax": "30.31",
            "lines": [
                {"invoice_line_id": "INV-101-1", "po_line_id": "L01", "item_id": "ITEM-005", "quantity": "240", "unit": "each", "unit_price": "2.526"},
            ],
        },
        {
            "invoice_id": "INV-200", "supplier_id": "SUP-BETA", "po_id": "PO-200",
            "invoice_date": "2025-06-11", "currency": "USD", "freight": "12.00", "tax": "62.50",
            "lines": [
                {"invoice_line_id": "INV-200-1", "po_line_id": "L01", "item_id": "ITEM-002", "quantity": "62", "unit": "each", "unit_price": "15.00"},
                {"invoice_line_id": "INV-200-2", "po_line_id": "L02", "item_id": "ITEM-006", "quantity": "80", "unit": "each", "unit_price": "4.00"},
            ],
        },
        {
            "invoice_id": "INV-300", "supplier_id": "SUP-GAMMA", "po_id": "PO-300",
            "invoice_date": "2025-06-12", "currency": "EUR", "freight": "9.00", "tax": "38.81",
            "lines": [
                {"invoice_line_id": "INV-300-1", "po_line_id": "L01", "item_id": "ITEM-007", "quantity": "49", "unit": "each", "unit_price": "7.92"},
            ],
        },
    ]

    po_lookup = {(row[0], row[1]): row for row in po_rows}
    grouped: dict[str, list[list[str]]] = {}
    for row in po_rows[6:]:
        grouped.setdefault(row[0], []).append(row)
    for po_offset, (po_id, rows) in enumerate(sorted(grouped.items())):
        supplier, currency = rows[0][2], rows[0][7]
        invoice_lines = []
        for row in rows:
            _, line_id, _, item_id, ordered_text, unit, price_text, _ = row
            ordered = Decimal(ordered_text)
            factor = Decimal(items[int(item_id[-3:]) - 1][3])
            normalized_ordered = ordered * factor if unit == "case" else ordered
            if (po_offset * 2 + int(line_id[-2:]) - 1) % 4 == 0:
                first = ordered * Decimal("0.4")
                second = ordered - first
                receipt_parts = [first, second]
            else:
                receipt_parts = [ordered]
            for part_index, part in enumerate(receipt_parts, 1):
                receipts.append({
                    "receipt_id": f"REC-{po_id[3:]}-{line_id[1:]}-{part_index}",
                    "received_date": f"2025-06-{13 + po_offset:02d}", "po_id": po_id,
                    "line_id": line_id, "quantity": decimal_text(part), "unit": unit,
                })
            serial = po_offset * 2 + int(line_id[-2:]) - 1
            qty_adjustments = [Decimal("0"), Decimal("0.01"), Decimal("0.02"), Decimal("0.03"), Decimal("-0.025")]
            price_adjustments = [Decimal("0"), Decimal("0.005"), Decimal("0.01"), Decimal("0.015"), Decimal("-0.02"), Decimal("0")]
            normalized_invoice_qty = normalized_ordered * (Decimal("1") + qty_adjustments[serial % 5])
            invoice_qty = normalized_invoice_qty / factor if unit == "case" else normalized_invoice_qty
            invoice_price = Decimal(price_text) * (Decimal("1") + price_adjustments[serial % 6])
            invoice_lines.append({
                "invoice_line_id": f"INV-{po_id[3:]}-{line_id}", "po_line_id": line_id,
                "item_id": item_id, "quantity": decimal_text(invoice_qty), "unit": unit,
                "unit_price": decimal_text(invoice_price),
            })
        invoices.append({
            "invoice_id": f"INV-{po_id[3:]}", "supplier_id": supplier, "po_id": po_id,
            "invoice_date": f"2025-06-{15 + po_offset:02d}", "currency": currency,
            "freight": f"{Decimal(3 + po_offset % 6):.2f}",
            "tax": f"{Decimal(7 + po_offset * 2):.2f}", "lines": invoice_lines,
        })

    # Deliberately scramble record order. Output order is defined by PO and line.
    rng.shuffle(receipts)
    (inputs / "goods_receipts.json").write_text(
        json.dumps({"receipts": receipts}, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    write_invoices(inputs / "supplier_invoices.xml", invoices)


def seed(workspace: Path, fixture: str) -> None:
    rng = random.Random(SEED)
    if workspace.exists():
        shutil.rmtree(workspace)
    inputs = workspace / "inputs"
    inputs.mkdir(parents=True)
    (workspace / "solution").mkdir()
    (workspace / "output").mkdir()
    if fixture == "edge":
        seed_edge(inputs)
    else:
        seed_main(inputs, rng)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    seed(args.workspace.resolve(), args.fixture)


if __name__ == "__main__":
    main()
