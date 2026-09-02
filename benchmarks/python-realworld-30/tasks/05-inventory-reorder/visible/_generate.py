#!/usr/bin/env python3
"""Generate deterministic product, stock, demand, PO, and supplier inputs."""
from __future__ import annotations

import argparse
import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 20260831 + 5
WAREHOUSES = ("EAST", "NORTH", "WEST")


def write_csv(path: Path, fields: list[str], rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def product_record(number: int) -> dict[str, object]:
    suppliers = ("SUP-A", "SUP-B", "SUP-C", "SUP-D")
    packs = (6, 8, 12, 10)
    leads = (5, 7, 9, 12)
    safeties = (3, 4, 5, 6)
    slot = (number - 1) % 4
    record: dict[str, object] = {
        "sku": f"SKU{number:03d}", "supplier_id": suppliers[slot],
        "case_pack": packs[slot], "lead_days": leads[slot], "safety_days": safeties[slot],
    }
    if number == 79:
        record.update(supplier_id="SUP-Z", case_pack=4, lead_days=3, safety_days=2)
    elif number == 80:
        record.update(supplier_id="SUP-Z", case_pack=5, lead_days=3, safety_days=2)
    return record


def anchor_demand(sku: str, warehouse: str) -> int | None:
    anchors = {
        "SKU001": {"EAST": 4, "NORTH": 3, "WEST": 2},
        "SKU002": {"EAST": 5, "NORTH": 1, "WEST": 2},
        "SKU003": {"EAST": 6, "NORTH": 1, "WEST": 5},
        "SKU004": {"EAST": 1, "NORTH": 1, "WEST": 4},
        "SKU079": {"EAST": 1, "NORTH": 0, "WEST": 0},
        "SKU080": {"EAST": 2, "NORTH": 0, "WEST": 0},
    }
    return anchors.get(sku, {}).get(warehouse)


def generate_main(inputs: Path) -> None:
    rng = random.Random(SEED)
    products = [product_record(number) for number in range(1, 81)]
    write_csv(inputs / "products.csv",
              ["sku", "supplier_id", "case_pack", "lead_days", "safety_days"], products)

    stock_rows: list[dict[str, object]] = []
    stock_overrides = {
        ("SKU001", "EAST"): 0, ("SKU001", "NORTH"): 20, ("SKU001", "WEST"): 50,
        ("SKU002", "EAST"): 0, ("SKU002", "NORTH"): 0, ("SKU002", "WEST"): 0,
        ("SKU003", "EAST"): 0, ("SKU003", "NORTH"): 80, ("SKU003", "WEST"): 100,
        ("SKU004", "EAST"): 50, ("SKU004", "NORTH"): 50, ("SKU004", "WEST"): 0,
        ("SKU079", "EAST"): 0, ("SKU079", "NORTH"): 0, ("SKU079", "WEST"): 0,
        ("SKU080", "EAST"): 0, ("SKU080", "NORTH"): 0, ("SKU080", "WEST"): 0,
    }
    for product in products:
        sku = str(product["sku"])
        for warehouse in WAREHOUSES:
            on_hand = stock_overrides.get((sku, warehouse), rng.randrange(8, 75))
            stock_rows.append({"sku": sku, "warehouse": warehouse, "on_hand": on_hand})
    write_csv(inputs / "stock.csv", ["sku", "warehouse", "on_hand"], stock_rows)

    first_day = date(2025, 4, 6)  # 56 complete days ending 2025-05-31.
    demand_rows: list[dict[str, object]] = []
    for offset in range(56):
        day = first_day + timedelta(days=offset)
        for product in products:
            sku = str(product["sku"])
            for warehouse in WAREHOUSES:
                fixed = anchor_demand(sku, warehouse)
                quantity = fixed if fixed is not None else rng.randrange(0, 9)
                demand_rows.append({
                    "date": day.isoformat(), "sku": sku,
                    "warehouse": warehouse, "quantity": quantity,
                })
    write_csv(inputs / "demand.csv", ["date", "sku", "warehouse", "quantity"], demand_rows)

    anchor_skus = {"SKU001", "SKU002", "SKU003", "SKU004", "SKU079", "SKU080"}
    po_rows: list[dict[str, object]] = []
    po_number = 1
    as_of = date(2025, 6, 1)
    for product in products:
        sku = str(product["sku"])
        if sku in anchor_skus:
            continue
        lead = int(product["lead_days"])
        for warehouse in WAREHOUSES:
            if rng.random() < 0.24:
                # Alternate an inclusive-boundary PO and a deliberately late PO.
                delta = lead if po_number % 2 else lead + 2
                po_rows.append({
                    "po_id": f"PO{po_number:04d}", "sku": sku, "warehouse": warehouse,
                    "quantity": rng.randrange(3, 31),
                    "arrival_date": (as_of + timedelta(days=delta)).isoformat(),
                })
                po_number += 1
    # Explicitly test the inclusive lead boundary and exclusion of the next day.
    po_rows.extend([
        {"po_id": "PO-BOUNDARY", "sku": "SKU010", "warehouse": "EAST",
         "quantity": 11, "arrival_date": "2025-06-08"},
        {"po_id": "PO-LATE", "sku": "SKU010", "warehouse": "EAST",
         "quantity": 29, "arrival_date": "2025-06-09"},
    ])
    po_rows.sort(key=lambda row: str(row["po_id"]))
    write_csv(inputs / "open_pos.csv",
              ["po_id", "sku", "warehouse", "quantity", "arrival_date"], po_rows)

    suppliers = [
        {"supplier_id": "SUP-A", "minimum_cases": 4},
        {"supplier_id": "SUP-B", "minimum_cases": 5},
        {"supplier_id": "SUP-C", "minimum_cases": 4},
        {"supplier_id": "SUP-D", "minimum_cases": 6},
        {"supplier_id": "SUP-Z", "minimum_cases": 8},
    ]
    (inputs / "suppliers.json").write_text(
        json.dumps(suppliers, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def generate_edge(inputs: Path) -> None:
    write_csv(inputs / "products.csv",
              ["sku", "supplier_id", "case_pack", "lead_days", "safety_days"],
              [{"sku": "NEW001", "supplier_id": "SUP-N", "case_pack": 6,
                "lead_days": 5, "safety_days": 3}])
    write_csv(inputs / "stock.csv", ["sku", "warehouse", "on_hand"],
              [{"sku": "NEW001", "warehouse": "EAST", "on_hand": 24}])
    write_csv(inputs / "demand.csv", ["date", "sku", "warehouse", "quantity"], [])
    write_csv(inputs / "open_pos.csv",
              ["po_id", "sku", "warehouse", "quantity", "arrival_date"], [])
    (inputs / "suppliers.json").write_text(
        json.dumps([{"supplier_id": "SUP-N", "minimum_cases": 4}], indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    inputs = args.output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    if args.fixture == "main":
        generate_main(inputs)
    else:
        generate_edge(inputs)


if __name__ == "__main__":
    main()
