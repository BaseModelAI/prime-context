#!/usr/bin/env python3
"""Create deterministic main and edge fixtures for task 24."""

from __future__ import annotations

import argparse
import csv
import random
import shutil
from pathlib import Path

SEED = 20260831 + 24
WAREHOUSES = ("W-A", "W-B", "W-C", "W-D")
SHIPPING = (
    ("W-A", "5.00", "0.35"),
    ("W-B", "4.00", "0.55"),
    ("W-C", "7.00", "0.20"),
    ("W-D", "3.50", "0.80"),
)


def write_csv(path: Path, header: tuple[str, ...], rows: list[tuple[object, ...]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def main_rows() -> dict[str, list[tuple[object, ...]]]:
    rng = random.Random(SEED)
    ordinary_skus = [f"SKU{i:03d}" for i in range(1, 61)]
    anchor_skus = [
        "FULL001", "SPLIT001", "SPLIT002", "SHIP001", "RESV001",
        "PART001", "PART002", "NOPART001", "EXP001", "EXP002",
    ]
    skus = ordinary_skus + anchor_skus

    inventory: dict[tuple[str, str], int] = {}
    for warehouse in WAREHOUSES:
        for sku in ordinary_skus:
            inventory[warehouse, sku] = rng.randint(14, 34)
        for sku in anchor_skus:
            inventory[warehouse, sku] = 0

    # Hand-authored stock makes the important allocation choices observable.
    inventory.update({
        ("W-A", "FULL001"): 9, ("W-B", "FULL001"): 9,
        ("W-C", "FULL001"): 5, ("W-D", "FULL001"): 9,
        ("W-A", "SPLIT001"): 4, ("W-B", "SPLIT002"): 4,
        ("W-C", "SPLIT001"): 3, ("W-C", "SPLIT002"): 3,
        ("W-B", "SHIP001"): 4,
        ("W-B", "RESV001"): 5,
        ("W-A", "PART001"): 5, ("W-C", "PART002"): 3,
        ("W-A", "NOPART001"): 4, ("W-C", "NOPART001"): 3,
        ("W-A", "EXP001"): 6, ("W-C", "EXP002"): 7,
    })

    special_orders = {
        "O0001": ("urgent", "2025-09-01", "false", [("L01", "FULL001", 9)]),
        "O0002": ("urgent", "2025-09-02", "false", [
            ("L01", "SPLIT001", 4), ("L02", "SPLIT002", 4)]),
        "O0003": ("high", "2025-09-03", "false", [("L01", "SHIP001", 4)]),
        "O0004": ("high", "2025-09-04", "false", [("L01", "RESV001", 5)]),
        "O0005": ("normal", "2025-09-05", "true", [
            ("L01", "PART001", 5), ("L02", "PART002", 5)]),
        "O0006": ("normal", "2025-09-06", "false", [("L01", "NOPART001", 10)]),
        "O0010": ("high", "2025-09-10", "false", [("L01", "EXP001", 6)]),
        "O0011": ("high", "2025-09-11", "false", [("L01", "EXP002", 7)]),
        "O0499": ("normal", "2025-09-01", "false", [("L01", "EXP001", 6)]),
        "O0500": ("normal", "2025-09-01", "false", [("L01", "EXP002", 7)]),
    }

    orders: list[tuple[object, ...]] = []
    lines: list[tuple[object, ...]] = []
    priorities = ("urgent", "high", "normal")
    priority_weights = (10, 25, 65)
    for number in range(1, 501):
        order_id = f"O{number:04d}"
        if order_id in special_orders:
            priority, due, allow_partial, order_lines = special_orders[order_id]
        else:
            priority = rng.choices(priorities, weights=priority_weights, k=1)[0]
            due = f"2025-09-{rng.randint(2, 30):02d}"
            allow_partial = "true" if rng.random() < 0.42 else "false"
            count = rng.randint(1, 3)
            selected = rng.sample(ordinary_skus, count)
            order_lines = [
                (f"L{index:02d}", sku, rng.randint(2, 12))
                for index, sku in enumerate(selected, 1)
            ]
        orders.append((order_id, priority, due, allow_partial))
        for line_id, sku, quantity in order_lines:
            lines.append((order_id, line_id, sku, quantity))

    existing = [
        ("O0003", "L01", "W-B", 4, "shipped"),
        ("O0004", "L01", "W-B", 5, "reserved"),
    ]
    inventory_rows = [
        (warehouse, sku, inventory[warehouse, sku])
        for warehouse in WAREHOUSES for sku in sorted(skus)
    ]
    return {
        "orders": orders,
        "lines": lines,
        "inventory": inventory_rows,
        "shipping": list(SHIPPING),
        "existing": existing,
    }


def edge_rows() -> dict[str, list[tuple[object, ...]]]:
    inventory = []
    for warehouse in WAREHOUSES:
        quantity = {"W-A": 2, "W-B": 2, "W-C": 0, "W-D": 0}[warehouse]
        inventory.append((warehouse, "EDGE001", quantity))
    return {
        "orders": [("E0001", "normal", "2025-09-20", "false")],
        "lines": [("E0001", "L01", "EDGE001", 5)],
        "inventory": inventory,
        "shipping": list(SHIPPING),
        "existing": [],
    }


def seed(workspace: Path, fixture: str) -> None:
    inputs = workspace / "inputs"
    if inputs.exists():
        shutil.rmtree(inputs)
    inputs.mkdir(parents=True)
    rows = main_rows() if fixture == "main" else edge_rows()
    write_csv(inputs / "orders.csv", ("order_id", "priority", "due_date", "allow_partial"), rows["orders"])
    write_csv(inputs / "order_lines.csv", ("order_id", "line_id", "sku", "requested_qty"), rows["lines"])
    write_csv(inputs / "inventory.csv", ("warehouse_id", "sku", "on_hand"), rows["inventory"])
    write_csv(inputs / "shipping_cost.csv", ("warehouse_id", "base_cost", "per_unit_cost"), rows["shipping"])
    write_csv(
        inputs / "existing_allocations.csv",
        ("order_id", "line_id", "warehouse_id", "quantity", "status"),
        rows["existing"],
    )
    (workspace / "solution").mkdir(exist_ok=True)
    (workspace / "output").mkdir(exist_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", choices=("main", "edge"), default="main")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    seed(args.workspace, args.fixture)
