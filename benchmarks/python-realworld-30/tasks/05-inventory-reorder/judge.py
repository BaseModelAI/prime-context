#!/usr/bin/env python3
"""Direct semantic main-and-edge judge for Task 05."""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation, ROUND_CEILING, ROUND_FLOOR
from pathlib import Path

TASK_DIR = Path(__file__).resolve().parent
REORDER_FIELDS = [
    "sku", "warehouse", "forecast_daily", "target_qty", "on_hand",
    "eligible_open_po", "reorder_qty", "supplier_id", "case_pack",
    "order_cases", "arrival_date",
]
FOUR_DECIMAL = re.compile(r"^(?:0|[1-9]\d*)\.\d{4}$")
WHOLE_NUMBER = re.compile(r"^(?:0|[1-9]\d*)$")


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    data = path.read_bytes()
    if b"\r" in data or (data and not data.endswith(b"\n")):
        raise ValueError(f"{path.name} must use LF line endings")
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def ceil_int(value: Decimal) -> int:
    return int(value.to_integral_value(rounding=ROUND_CEILING))


def floor_int(value: Decimal) -> int:
    return int(value.to_integral_value(rounding=ROUND_FLOOR))


def reference(inputs: Path) -> dict[str, object]:
    product_fields, product_rows = read_csv(inputs / "products.csv")
    _, stock_rows = read_csv(inputs / "stock.csv")
    _, demand_rows = read_csv(inputs / "demand.csv")
    _, po_rows = read_csv(inputs / "open_pos.csv")
    products = {
        row["sku"]: {
            "supplier_id": row["supplier_id"],
            "case_pack": int(row["case_pack"]),
            "lead_days": int(row["lead_days"]),
            "safety_days": int(row["safety_days"]),
        }
        for row in product_rows
    }
    stock = {(r["sku"], r["warehouse"]): int(r["on_hand"]) for r in stock_rows}
    suppliers_doc = json.loads((inputs / "suppliers.json").read_text(encoding="utf-8"))
    minimums = {str(x["supplier_id"]): int(x["minimum_cases"]) for x in suppliers_doc}
    as_of = date(2025, 6, 1)
    window_start = as_of - timedelta(days=28)
    demand: dict[tuple[str, str], int] = defaultdict(int)
    for row in demand_rows:
        day = date.fromisoformat(row["date"])
        if window_start <= day < as_of:
            demand[(row["sku"], row["warehouse"])] += int(row["quantity"])
    eligible: dict[tuple[str, str], int] = defaultdict(int)
    for row in po_rows:
        sku = row["sku"]
        boundary = as_of + timedelta(days=int(products[sku]["lead_days"]))
        if date.fromisoformat(row["arrival_date"]) <= boundary:
            eligible[(sku, row["warehouse"])] += int(row["quantity"])

    forecasts: dict[tuple[str, str], Decimal] = {}
    targets: dict[tuple[str, str], Decimal] = {}
    safety: dict[tuple[str, str], Decimal] = {}
    position: dict[tuple[str, str], Decimal] = {}
    original_shortage: dict[tuple[str, str], Decimal] = {}
    keys = sorted(stock)
    for key in keys:
        sku, _warehouse = key
        forecast = Decimal(demand[key]) / Decimal(28)
        forecasts[key] = forecast
        product = products[sku]
        target_days = int(product["lead_days"]) + int(product["safety_days"])
        targets[key] = Decimal(demand[key] * target_days) / Decimal(28)
        safety[key] = (
            Decimal(demand[key] * int(product["safety_days"])) / Decimal(28)
        )
        position[key] = Decimal(stock[key] + eligible[key])

    # Stage-two transfers. Received units cannot be forwarded in the same plan.
    costs: dict[tuple[str, str], Decimal] = {}
    transfer_path = inputs / "transfer_costs.csv"
    if transfer_path.exists():
        _, cost_rows = read_csv(transfer_path)
        for row in cost_rows:
            costs[(row["from_warehouse"], row["to_warehouse"])] = Decimal(row["cost_per_unit"])
    transfer_out: dict[tuple[str, str], int] = defaultdict(int)
    transfers: list[dict[str, object]] = []
    skus = sorted(products)
    for sku in skus:
        recipients = sorted(warehouse for item_sku, warehouse in keys if item_sku == sku)
        for recipient in recipients:
            recipient_key = (sku, recipient)
            need = max(0, floor_int(targets[recipient_key] - position[recipient_key]))
            while need:
                choices: list[tuple[Decimal, str, int]] = []
                for donor in recipients:
                    if donor == recipient or (donor, recipient) not in costs:
                        continue
                    donor_key = (sku, donor)
                    physical = stock[donor_key] - transfer_out[donor_key]
                    above_safety = max(0, floor_int(position[donor_key] - safety[donor_key]))
                    available = min(physical, above_safety)
                    if available:
                        choices.append((costs[(donor, recipient)], donor, available))
                if not choices:
                    break
                cost, donor, available = min(choices, key=lambda item: (item[0], item[1]))
                quantity = min(need, available)
                donor_key = (sku, donor)
                transfer_out[donor_key] += quantity
                position[donor_key] -= quantity
                position[recipient_key] += quantity
                need -= quantity
                transfers.append({
                    "sku": sku, "from_warehouse": donor, "to_warehouse": recipient,
                    "quantity": quantity, "cost_per_unit": cost,
                })

    orders: dict[tuple[str, str], dict[str, object]] = {}
    for key in keys:
        sku, warehouse = key
        product = products[sku]
        shortage = max(Decimal(0), targets[key] - position[key])
        original_shortage[key] = shortage
        units = ceil_int(shortage)
        pack = int(product["case_pack"])
        cases = (units + pack - 1) // pack if units else 0
        orders[key] = {"cases": cases, "quantity": cases * pack, "padding": 0}

    # Supplier minimum padding applies only when that supplier already has an order.
    for supplier in sorted(minimums):
        candidate_keys = [
            key for key in keys
            if products[key[0]]["supplier_id"] == supplier and int(orders[key]["cases"]) > 0
        ]
        total = sum(int(orders[key]["cases"]) for key in candidate_keys)
        minimum = minimums[supplier]
        if not candidate_keys or total >= minimum:
            continue
        while total < minimum:
            def rank(key: tuple[str, str]) -> tuple[Decimal, str, str]:
                pack = int(products[key[0]]["case_pack"])
                remaining = max(
                    Decimal(0),
                    original_shortage[key] - Decimal(int(orders[key]["padding"]) * pack),
                )
                return (-remaining, key[0], key[1])
            chosen = min(candidate_keys, key=rank)
            orders[chosen]["cases"] = int(orders[chosen]["cases"]) + 1
            orders[chosen]["padding"] = int(orders[chosen]["padding"]) + 1
            orders[chosen]["quantity"] = int(orders[chosen]["quantity"]) + int(products[chosen[0]]["case_pack"])
            total += 1

    blackouts: dict[str, list[tuple[date, date]]] = defaultdict(list)
    constraints_path = inputs / "constraints.json"
    if constraints_path.exists():
        doc = json.loads(constraints_path.read_text(encoding="utf-8"))
        for item in doc.get("supplier_blackouts", []):
            blackouts[str(item["supplier_id"])].append(
                (date.fromisoformat(item["start_date"]), date.fromisoformat(item["end_date"]))
            )
    arrivals: dict[tuple[str, str], str] = {}
    for key in keys:
        sku, _warehouse = key
        if int(orders[key]["quantity"]) == 0:
            arrivals[key] = ""
            continue
        product = products[sku]
        arrival = as_of + timedelta(days=int(product["lead_days"]))
        changed = True
        while changed:
            changed = False
            for start, end in sorted(blackouts[str(product["supplier_id"])]):
                if start <= arrival <= end:
                    arrival = end + timedelta(days=1)
                    changed = True
        arrivals[key] = arrival.isoformat()

    return {
        "products": products, "stock": stock, "eligible": eligible,
        "forecasts": forecasts, "targets": targets, "safety": safety,
        "positions": position, "orders": orders, "arrivals": arrivals,
        "minimums": minimums, "transfers": transfers, "keys": keys,
    }


def generate_payload(generator: Path, workspace: Path, fixture: str) -> None:
    subprocess.run(
        [sys.executable, str(generator), "--output", str(workspace), "--fixture", fixture],
        cwd=generator.parent, check=True, capture_output=True, text=True, timeout=30,
    )


def copy_solution(candidate: Path, destination: Path) -> bool:
    source = candidate / "solution"
    if not source.is_dir() or not any(p.is_file() for p in source.rglob("*.py")):
        return False
    shutil.rmtree(destination / "solution", ignore_errors=True)
    shutil.copytree(source, destination / "solution")
    return True


def prepare(candidate: Path, fixture: str) -> tuple[tempfile.TemporaryDirectory[str], Path, bool]:
    temporary = tempfile.TemporaryDirectory(prefix=f"task05-{fixture}-")
    workspace = Path(temporary.name) / "workspace"
    subprocess.run(
        [sys.executable, str(TASK_DIR / "seed.py"), "--workspace", str(workspace), "--fixture", fixture],
        cwd=TASK_DIR, check=True, capture_output=True, text=True, timeout=30,
    )
    artifact = copy_solution(candidate, workspace)
    generate_payload(TASK_DIR / "visible" / "_generate.py", workspace, fixture)
    generate_payload(TASK_DIR / "stages" / "constraints" / "_generate.py", workspace, fixture)
    return temporary, workspace, artifact


def run_candidate(workspace: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-E", "-S", "-m", "solution.reorder", "inputs", "--as-of", "2025-06-01", "--output", "output"],
        cwd=workspace, capture_output=True, text=True, timeout=40,
    )


def parse_transfers(path: Path) -> list[dict[str, object]]:
    fields, rows = read_csv(path)
    aliases = {
        "sku": ("sku",),
        "from_warehouse": ("from_warehouse", "from", "donor_warehouse", "donor", "source_warehouse"),
        "to_warehouse": ("to_warehouse", "to", "recipient_warehouse", "recipient", "destination_warehouse"),
        "quantity": ("quantity", "qty", "transfer_qty"),
    }
    selected: dict[str, str] = {}
    for target, options in aliases.items():
        found = next((name for name in options if name in fields), None)
        if found is None:
            raise ValueError(f"transfers.csv has no {target} column")
        selected[target] = found
    result: list[dict[str, object]] = []
    for row in rows:
        result.append({
            "sku": row[selected["sku"]],
            "from_warehouse": row[selected["from_warehouse"]],
            "to_warehouse": row[selected["to_warehouse"]],
            "quantity": int(row[selected["quantity"]]),
        })
    return result


def parse_outputs(workspace: Path) -> tuple[list[dict[str, str]], dict[str, object], list[dict[str, object]]]:
    fields, reorder = read_csv(workspace / "output" / "reorder.csv")
    if fields != REORDER_FIELDS:
        raise ValueError("wrong reorder.csv header")
    supplier_doc = json.loads((workspace / "output" / "supplier_orders.json").read_text(encoding="utf-8"))
    if not isinstance(supplier_doc, dict) or not isinstance(supplier_doc.get("suppliers"), list):
        raise ValueError("supplier_orders.json has wrong shape")
    transfers = parse_transfers(workspace / "output" / "transfers.csv")
    return reorder, supplier_doc, transfers


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    notes: list[str] = []
    main_checks = [False] * 5
    edge_passed = False
    main_parseable = False
    artifact = (args.workspace / "solution").is_dir() and any((args.workspace / "solution").rglob("*.py"))
    runnable = False
    main_temp = edge_temp = None
    try:
        main_temp, main_ws, copied = prepare(args.workspace, "main")
        artifact = artifact and copied
        run = run_candidate(main_ws) if copied else None
        if run is not None:
            runnable = run.returncode == 0
            if not runnable:
                imported = subprocess.run(
                    [sys.executable, "-E", "-S", "-c", "import solution.reorder"], cwd=main_ws,
                    capture_output=True, text=True, timeout=10,
                )
                runnable = imported.returncode == 0
        if run is None or run.returncode != 0:
            notes.append("main command failed")
        else:
            try:
                rows, supplier_doc, transfers = parse_outputs(main_ws)
                main_parseable = True
                expected = reference(main_ws / "inputs")
                keys = expected["keys"]
                row_keys = [(r["sku"], r["warehouse"]) for r in rows]
                rows_by_key = {key: row for key, row in zip(row_keys, rows)}
                structure_ok = row_keys == keys and len(rows_by_key) == len(keys)

                # 1. Exact 28-day forecast, targets, stock, and inclusive PO boundary.
                forecast_ok = structure_ok
                if forecast_ok:
                    for key in keys:
                        row = rows_by_key[key]
                        forecast_ok &= FOUR_DECIMAL.fullmatch(row["forecast_daily"]) is not None
                        forecast_ok &= FOUR_DECIMAL.fullmatch(row["target_qty"]) is not None
                        forecast_ok &= Decimal(row["forecast_daily"]) == expected["forecasts"][key].quantize(Decimal("0.0001"))
                        forecast_ok &= Decimal(row["target_qty"]) == expected["targets"][key].quantize(Decimal("0.0001"))
                        forecast_ok &= WHOLE_NUMBER.fullmatch(row["on_hand"]) is not None
                        forecast_ok &= WHOLE_NUMBER.fullmatch(row["eligible_open_po"]) is not None
                        forecast_ok &= int(row["on_hand"]) == expected["stock"][key]
                        forecast_ok &= int(row["eligible_open_po"]) == expected["eligible"][key]
                main_checks[0] = bool(forecast_ok)

                # 2. Purchase quantities use the post-transfer shortage and case packs.
                purchase_ok = structure_ok
                if purchase_ok:
                    for key in keys:
                        row = rows_by_key[key]
                        product = expected["products"][key[0]]
                        order = expected["orders"][key]
                        purchase_ok &= row["supplier_id"] == product["supplier_id"]
                        purchase_ok &= WHOLE_NUMBER.fullmatch(row["case_pack"]) is not None
                        purchase_ok &= WHOLE_NUMBER.fullmatch(row["reorder_qty"]) is not None
                        purchase_ok &= WHOLE_NUMBER.fullmatch(row["order_cases"]) is not None
                        purchase_ok &= int(row["case_pack"]) == product["case_pack"]
                        purchase_ok &= int(row["reorder_qty"]) == order["quantity"]
                        purchase_ok &= int(row["order_cases"]) == order["cases"]
                        purchase_ok &= (int(row["reorder_qty"]) % int(row["case_pack"]) == 0)
                main_checks[1] = bool(purchase_ok)

                # 3. Supplier aggregation conserves lines and observes aggregate minima.
                aggregate_ok = supplier_doc.get("as_of") == "2025-06-01"
                actual_suppliers = supplier_doc.get("suppliers", [])
                expected_suppliers: list[dict[str, object]] = []
                for supplier in sorted(expected["minimums"]):
                    supplier_keys = [
                        key for key in keys
                        if expected["products"][key[0]]["supplier_id"] == supplier
                        and expected["orders"][key]["quantity"]
                    ]
                    if not supplier_keys:
                        continue
                    expected_suppliers.append({
                        "supplier_id": supplier,
                        "minimum_cases": expected["minimums"][supplier],
                        "total_cases": sum(expected["orders"][key]["cases"] for key in supplier_keys),
                        "lines": [{
                            "sku": key[0], "warehouse": key[1],
                            "quantity": expected["orders"][key]["quantity"],
                            "cases": expected["orders"][key]["cases"],
                            "arrival_date": expected["arrivals"][key],
                        } for key in supplier_keys],
                    })
                aggregate_ok &= actual_suppliers == expected_suppliers
                # Explicit minimum-padding anchor.
                z = next((x for x in expected_suppliers if x["supplier_id"] == "SUP-Z"), None)
                aggregate_ok &= z is not None and z["total_cases"] == 8
                main_checks[2] = bool(aggregate_ok)

                # 4. Transfers follow cost/donor order and preserve donor safety.
                expected_transfers = expected["transfers"]
                normalize = lambda items: sorted(
                    (x["sku"], x["from_warehouse"], x["to_warehouse"], int(x["quantity"]))
                    for x in items
                )
                transfer_ok = normalize(transfers) == normalize(expected_transfers)
                # The two hand-authored anchors make cost choice and lexical tie observable.
                sku3 = [x for x in expected_transfers if x["sku"] == "SKU003" and x["to_warehouse"] == "EAST"]
                sku4 = [x for x in expected_transfers if x["sku"] == "SKU004" and x["to_warehouse"] == "WEST"]
                transfer_ok &= bool(sku3) and sku3[0]["from_warehouse"] == "WEST"
                transfer_ok &= bool(sku4) and sku4[0]["from_warehouse"] == "EAST"
                main_checks[3] = bool(transfer_ok)

                # 5. Purchase arrivals move past inclusive supplier blackouts.
                arrival_ok = structure_ok
                if arrival_ok:
                    for key in keys:
                        arrival_ok &= rows_by_key[key]["arrival_date"] == expected["arrivals"][key]
                shifted_a = [
                    expected["arrivals"][key] for key in keys
                    if expected["products"][key[0]]["supplier_id"] == "SUP-A"
                    and expected["orders"][key]["quantity"]
                ]
                arrival_ok &= bool(shifted_a) and set(shifted_a) == {"2025-06-11"}
                main_checks[4] = bool(arrival_ok)
            except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, InvalidOperation,
                    ValueError, KeyError, TypeError) as exc:
                notes.append(f"main outputs invalid: {type(exc).__name__}")

        edge_temp, edge_ws, edge_copied = prepare(args.workspace, "edge")
        edge_run = run_candidate(edge_ws) if edge_copied else None
        if edge_run is None or edge_run.returncode != 0:
            notes.append("edge command failed")
        else:
            try:
                edge_rows, edge_supplier_doc, edge_transfers = parse_outputs(edge_ws)
                edge_passed = (
                    len(edge_rows) == 1
                    and edge_rows[0]["sku"] == "NEW001"
                    and edge_rows[0]["warehouse"] == "EAST"
                    and edge_rows[0]["forecast_daily"] == "0.0000"
                    and edge_rows[0]["target_qty"] == "0.0000"
                    and edge_rows[0]["reorder_qty"] == "0"
                    and edge_rows[0]["order_cases"] == "0"
                    and edge_rows[0]["arrival_date"] == ""
                    and edge_supplier_doc.get("suppliers") == []
                    and edge_transfers == []
                )
            except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, InvalidOperation,
                    ValueError, KeyError, TypeError):
                edge_passed = False
    except (OSError, subprocess.SubprocessError) as exc:
        notes.append(f"judge execution failed: {type(exc).__name__}")
    finally:
        if main_temp is not None:
            main_temp.cleanup()
        if edge_temp is not None:
            edge_temp.cleanup()

    passed = sum(main_checks)
    if not artifact or not runnable:
        level = 0
    elif not main_parseable:
        level = 1
    elif passed == len(main_checks):
        level = 5 if edge_passed else 4
    elif passed:
        level = 3
    else:
        level = 2
    print(json.dumps({
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": len(main_checks),
        "edge_check_passed": edge_passed,
        "notes": notes,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
