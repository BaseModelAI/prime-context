#!/usr/bin/env python3
"""Direct main-and-edge judge for Task 01."""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from collections import defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path

BANK_FIELDS = ["transaction_id", "posted_date", "description", "amount", "currency"]
RECON_FIELDS = BANK_FIELDS + ["category", "matched_receipt_id", "status"]
RECEIPT_FIELDS = ["receipt_id", "merchant", "paid_date", "total", "currency"]


def normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split()).casefold()


def read_csv(path: Path, expected_fields: list[str]) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != expected_fields:
            raise ValueError(f"wrong CSV header in {path.name}")
        return list(reader)


def expected_semantics(
    inputs: Path,
) -> tuple[
    list[dict[str, str]],
    list[dict[str, str]],
    dict[str, dict[str, str]],
    list[dict[str, str]],
]:
    """Calculate business facts, not serialized reference output files."""
    bank = read_csv(inputs / "bank.csv", BANK_FIELDS)
    categories = read_csv(inputs / "categories.csv", ["pattern", "category"])
    receipts = json.loads((inputs / "receipts.json").read_text(encoding="utf-8"))
    used: set[str] = set()
    row_facts: list[dict[str, str]] = []
    totals: dict[str, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))

    for bank_row in bank:
        description = normalize(bank_row["description"])
        category = "Uncategorized"
        for rule in categories:
            if normalize(rule["pattern"]) in description:
                category = rule["category"]
                break

        amount = Decimal(bank_row["amount"])
        if amount > 0 and category == "Uncategorized":
            category = "Refund"

        receipt_id = ""
        status = "not_applicable"
        if amount < 0:
            posted = date.fromisoformat(bank_row["posted_date"])
            candidates: list[tuple[int, str]] = []
            for receipt in receipts:
                rid = receipt["receipt_id"]
                if rid in used or receipt["currency"] != bank_row["currency"]:
                    continue
                if Decimal(receipt["total"]) != -amount:
                    continue
                difference = abs((date.fromisoformat(receipt["paid_date"]) - posted).days)
                if difference > 2:
                    continue
                merchant = normalize(receipt["merchant"])
                if merchant in description or description in merchant:
                    candidates.append((difference, rid))
            if candidates:
                _, receipt_id = min(candidates)
                used.add(receipt_id)
                status = "matched"
            else:
                status = "unmatched"

        row_facts.append({
            "transaction_id": bank_row["transaction_id"],
            "category": category,
            "matched_receipt_id": receipt_id,
            "status": status,
        })
        if category != "Transfer":
            month = bank_row["posted_date"][:7]
            totals[month][category] -= amount

    summary_facts = {
        month: {
            category: f"{amount.quantize(Decimal('0.01')):.2f}"
            for category, amount in sorted(values.items())
        }
        for month, values in sorted(totals.items())
    }
    unused_receipts = sorted(
        (row for row in receipts if row["receipt_id"] not in used),
        key=lambda row: row["receipt_id"],
    )
    return bank, row_facts, summary_facts, unused_receipts


def rows_have_expected_semantics(
    actual: list[dict[str, str]], expected: list[dict[str, str]]
) -> bool:
    semantic_fields = ("category", "matched_receipt_id", "status")
    return len(actual) == len(expected) and all(
        actual_row["transaction_id"] == fact["transaction_id"]
        and all(actual_row[field] == fact[field] for field in semantic_fields)
        for actual_row, fact in zip(actual, expected)
    )


def summary_has_expected_semantics(
    actual: dict[str, object], expected: dict[str, dict[str, str]], raw: str
) -> bool:
    if not raw.endswith("\n") or list(actual) != sorted(actual):
        return False
    if set(actual) != set(expected):
        return False
    money = re.compile(r"-?(?:0|[1-9]\d*)\.\d{2}")
    for month, expected_categories in expected.items():
        categories = actual.get(month)
        if not isinstance(categories, dict):
            return False
        if list(categories) != sorted(categories) or set(categories) != set(expected_categories):
            return False
        for category, expected_value in expected_categories.items():
            value = categories.get(category)
            if not isinstance(value, str) or money.fullmatch(value) is None:
                return False
            if value != expected_value:
                return False
    return True


def receipts_have_expected_content(
    actual: list[dict[str, str]], expected: list[dict[str, str]]
) -> bool:
    if len(actual) != len(expected):
        return False
    if [row["receipt_id"] for row in actual] != sorted(row["receipt_id"] for row in actual):
        return False
    return all(
        all(actual_row[field] == expected_row[field] for field in RECEIPT_FIELDS)
        for actual_row, expected_row in zip(actual, expected)
    )


def generate_fixture(target: Path, fixture: str) -> None:
    task_dir = Path(__file__).parent
    subprocess.run(
        [
            sys.executable,
            str(task_dir / "seed.py"),
            "--workspace",
            str(target),
            "--fixture",
            fixture,
        ],
        check=True,
        text=True,
        capture_output=True,
        timeout=30,
    )
    subprocess.run(
        [
            sys.executable,
            str(task_dir / "visible" / "_generate.py"),
            "--output",
            str(target),
            "--fixture",
            fixture,
        ],
        check=True,
        text=True,
        capture_output=True,
        timeout=30,
    )


def execute(source_workspace: Path, fixture: str) -> tuple[Path, subprocess.CompletedProcess[str], tempfile.TemporaryDirectory[str]]:
    temporary = tempfile.TemporaryDirectory(prefix=f"pcbench-01-{fixture}-")
    run_root = Path(temporary.name)
    generate_fixture(run_root, fixture)
    solution = source_workspace / "solution"
    if solution.is_dir():
        shutil.rmtree(run_root / "solution")
        shutil.copytree(solution, run_root / "solution")
    completed = subprocess.run(
        [sys.executable, "-E", "-S", "-m", "solution.reconcile", "--bank", "inputs/bank.csv", "--receipts", "inputs/receipts.json", "--categories", "inputs/categories.csv", "--output", "output"],
        cwd=run_root,
        text=True,
        capture_output=True,
        timeout=30,
    )
    return run_root, completed, temporary


def module_imports(root: Path) -> bool:
    completed = subprocess.run(
        [sys.executable, "-E", "-S", "-c", "import solution.reconcile"],
        cwd=root,
        text=True,
        capture_output=True,
        timeout=10,
    )
    return completed.returncode == 0


def parse_outputs(
    root: Path,
) -> tuple[list[dict[str, str]], dict[str, object], str, list[dict[str, str]]]:
    reconciliation = read_csv(root / "output" / "reconciliation.csv", RECON_FIELDS)
    summary_raw = (root / "output" / "monthly_summary.json").read_text(encoding="utf-8")
    summary = json.loads(summary_raw)
    unmatched = read_csv(root / "output" / "unmatched_receipts.csv", RECEIPT_FIELDS)
    if not isinstance(summary, dict):
        raise ValueError("monthly_summary.json is not an object")
    return reconciliation, summary, summary_raw, unmatched


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    args = parser.parse_args()
    workspace = Path(args.workspace).resolve()
    artifact = (workspace / "solution" / "reconcile.py").is_file()
    notes: list[str] = []
    main_checks = [False] * 5
    runnable = False
    main_parseable = False

    main_temp = edge_temp = None
    try:
        if artifact:
            main_root, main_run, main_temp = execute(workspace, "main")
            runnable = main_run.returncode == 0 or module_imports(main_root)
            if main_run.returncode != 0:
                notes.append("main command failed")
            else:
                try:
                    actual_rows, actual_summary, summary_raw, actual_unmatched = parse_outputs(main_root)
                    bank, row_facts, summary_facts, unused_receipts = expected_semantics(
                        main_root / "inputs"
                    )
                    main_parseable = True

                    # 1. The input records and their order must be preserved.
                    main_checks[0] = len(actual_rows) == len(bank) and all(
                        all(actual[field] == source[field] for field in BANK_FIELDS)
                        for actual, source in zip(actual_rows, bank)
                    )

                    # 2. Check the stated rules for every row and the named anchors directly.
                    anchors = {
                        "B0001": ("Dining", "R0004", "matched"),
                        "B0002": ("Groceries", "R0002", "matched"),
                        "B0003": ("Groceries", "R0003", "matched"),
                        "B0004": ("Groceries", "", "not_applicable"),
                        "B0005": ("Transfer", "", "unmatched"),
                        "B0006": ("Household", "R0001", "matched"),
                        "B0120": ("Refund", "", "not_applicable"),
                        "B0160": ("Uncategorized", "", "unmatched"),
                    }
                    actual_by_id = {row["transaction_id"]: row for row in actual_rows}
                    anchors_ok = all(
                        transaction_id in actual_by_id
                        and (
                            actual_by_id[transaction_id]["category"],
                            actual_by_id[transaction_id]["matched_receipt_id"],
                            actual_by_id[transaction_id]["status"],
                        )
                        == expected
                        for transaction_id, expected in anchors.items()
                    )
                    main_checks[1] = anchors_ok and rows_have_expected_semantics(
                        actual_rows, row_facts
                    )

                    # 3. A nonempty receipt ID may occur on only one bank row.
                    matched_ids = [
                        row["matched_receipt_id"]
                        for row in actual_rows
                        if row["matched_receipt_id"]
                    ]
                    main_checks[2] = len(matched_ids) == len(set(matched_ids))

                    # 4. Totals, key order, money strings, and the required newline are semantic output rules.
                    main_checks[3] = summary_has_expected_semantics(
                        actual_summary, summary_facts, summary_raw
                    )

                    # 5. The unused receipts must have the exact content and requested ID order.
                    main_checks[4] = receipts_have_expected_content(
                        actual_unmatched, unused_receipts
                    )
                except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError, KeyError) as exc:
                    notes.append(f"main outputs invalid: {type(exc).__name__}")

        edge_passed = False
        if artifact:
            edge_root, edge_run, edge_temp = execute(workspace, "edge")
            if edge_run.returncode == 0:
                try:
                    rows, _, _, unmatched = parse_outputs(edge_root)
                    edge_passed = (
                        len(rows) == 1
                        and rows[0]["matched_receipt_id"] == "Z-COMPATIBLE"
                        and rows[0]["status"] == "matched"
                        and [row["receipt_id"] for row in unmatched] == ["A-EARLY"]
                    )
                except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError, KeyError):
                    edge_passed = False
            else:
                notes.append("edge command failed")
    except (OSError, subprocess.SubprocessError) as exc:
        edge_passed = False
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
    result = {
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": len(main_checks),
        "edge_check_passed": edge_passed,
        "notes": notes,
    }
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
