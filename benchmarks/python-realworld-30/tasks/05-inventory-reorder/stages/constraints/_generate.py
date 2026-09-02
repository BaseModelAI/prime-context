#!/usr/bin/env python3
"""Generate stage-two blackout and transfer inputs for Task 05."""
from __future__ import annotations

import argparse
import csv
import json
import random
from pathlib import Path

SEED = 20260831 + 5


def write_costs(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=["from_warehouse", "to_warehouse", "cost_per_unit"],
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    random.Random(SEED).getstate()
    inputs = args.output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)

    if args.fixture == "main":
        constraints = {
            "supplier_blackouts": [
                {"supplier_id": "SUP-A", "start_date": "2025-06-05", "end_date": "2025-06-10"},
                {"supplier_id": "SUP-C", "start_date": "2025-06-09", "end_date": "2025-06-12"},
            ],
            "transfer_policy": {
                "planning_order": "sku_then_recipient_warehouse",
                "quantity": "whole_units_up_to_recipient_target",
                "donor_floor": "forecast_daily_times_safety_days",
                "donor_physical_limit": "on_hand_not_already_sent",
                "tie_break": "cost_then_donor_warehouse"
            }
        }
        costs = [
            {"from_warehouse": "WEST", "to_warehouse": "EAST", "cost_per_unit": "0.40"},
            {"from_warehouse": "NORTH", "to_warehouse": "EAST", "cost_per_unit": "0.55"},
            {"from_warehouse": "EAST", "to_warehouse": "NORTH", "cost_per_unit": "0.35"},
            {"from_warehouse": "WEST", "to_warehouse": "NORTH", "cost_per_unit": "0.35"},
            {"from_warehouse": "EAST", "to_warehouse": "WEST", "cost_per_unit": "0.60"},
            {"from_warehouse": "NORTH", "to_warehouse": "WEST", "cost_per_unit": "0.60"},
        ]
    else:
        constraints = {"supplier_blackouts": []}
        costs = []

    (inputs / "constraints.json").write_text(
        json.dumps(constraints, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    write_costs(inputs / "transfer_costs.csv", costs)


if __name__ == "__main__":
    main()
