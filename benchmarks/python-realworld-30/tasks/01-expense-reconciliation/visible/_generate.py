#!/usr/bin/env python3
"""Runner-side deterministic fixture generator for Task 01."""
from __future__ import annotations

import argparse
import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

SEED = 20260831 + 1
BANK_FIELDS = ["transaction_id", "posted_date", "description", "amount", "currency"]
RECEIPT_FIELDS = ["receipt_id", "merchant", "paid_date", "total", "currency"]


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def main_fixture(output: Path, rng: random.Random) -> None:
    inputs = output / "inputs"
    categories = [
        {"pattern": "transfer", "category": "Transfer"},
        {"pattern": "north market", "category": "Groceries"},
        {"pattern": "market", "category": "General"},
        {"pattern": "fresh mart", "category": "Groceries"},
        {"pattern": "café lumière", "category": "Dining"},
        {"pattern": "acme, inc", "category": "Household"},
        {"pattern": "metro transit", "category": "Transport"},
        {"pattern": "cloud books", "category": "Books"},
        {"pattern": "salary", "category": "Income"},
    ]
    bank = [
        {"transaction_id": "B0001", "posted_date": "2025-01-05", "description": "Café Lumière", "amount": "-23.40", "currency": "USD"},
        {"transaction_id": "B0002", "posted_date": "2025-01-10", "description": "North Market", "amount": "-19.99", "currency": "USD"},
        {"transaction_id": "B0003", "posted_date": "2025-01-11", "description": "North Market", "amount": "-19.99", "currency": "USD"},
        {"transaction_id": "B0004", "posted_date": "2025-01-15", "description": "North Market REFUND", "amount": "5.00", "currency": "USD"},
        {"transaction_id": "B0005", "posted_date": "2025-01-20", "description": "Transfer to Savings", "amount": "-500.00", "currency": "USD"},
        {"transaction_id": "B0006", "posted_date": "2025-02-03", "description": "ACME,   INC.", "amount": "-42.15", "currency": "USD"},
    ]
    merchants = ["Fresh Mart", "Metro Transit", "Cloud Books"]
    start = date(2025, 1, 1)
    for number in range(7, 161):
        merchant = merchants[(number - 7) % len(merchants)]
        day = start + timedelta(days=(number * 3) % 145)
        cents = 700 + number * 37
        amount = f"-{cents // 100}.{cents % 100:02d}"
        if number in {120, 145, 159}:
            amount = f"{cents // 100}.{cents % 100:02d}"
        description = f"{merchant} #{10000 + number}"
        if number == 120:
            description = "Mystery Merchant Refund"
        elif number == 160:
            description = "Neighborhood Kiosk"
        bank.append({
            "transaction_id": f"B{number:04d}",
            "posted_date": day.isoformat(),
            "description": description,
            "amount": amount,
            "currency": "USD",
        })
    receipts = [
        {"receipt_id": "R0004", "merchant": "Café Lumière", "paid_date": "2025-01-06", "total": "23.40", "currency": "USD"},
        {"receipt_id": "R0002", "merchant": "North Market", "paid_date": "2025-01-10", "total": "19.99", "currency": "USD"},
        {"receipt_id": "R0003", "merchant": "North Market", "paid_date": "2025-01-10", "total": "19.99", "currency": "USD"},
        {"receipt_id": "R0001", "merchant": "ACME, INC", "paid_date": "2025-02-04", "total": "42.15", "currency": "USD"},
    ]
    for row in bank[6:106]:
        paid = date.fromisoformat(row["posted_date"]) + timedelta(days=rng.choice([-1, 0, 1]))
        receipts.append({
            "receipt_id": f"R{len(receipts) + 1:04d}",
            "merchant": row["description"].split(" #", 1)[0],
            "paid_date": paid.isoformat(),
            "total": row["amount"].removeprefix("-"),
            "currency": row["currency"],
        })
    receipts.append({"receipt_id": "R9999", "merchant": "Corner Cash Stall", "paid_date": "2025-03-09", "total": "11.00", "currency": "USD"})
    assert len(bank) == 160 and len(receipts) == 105
    write_csv(inputs / "bank.csv", BANK_FIELDS, bank)
    write_csv(inputs / "categories.csv", ["pattern", "category"], categories)
    (inputs / "receipts.json").write_text(json.dumps(receipts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def edge_fixture(output: Path) -> None:
    inputs = output / "inputs"
    write_csv(inputs / "bank.csv", BANK_FIELDS, [
        {"transaction_id": "E1", "posted_date": "2025-08-20", "description": "Compatible Shop", "amount": "-10.00", "currency": "USD"}
    ])
    write_csv(inputs / "categories.csv", ["pattern", "category"], [
        {"pattern": "compatible shop", "category": "Supplies"}
    ])
    receipts = [
        {"receipt_id": "A-EARLY", "merchant": "Wrong Store", "paid_date": "2025-08-20", "total": "10.00", "currency": "USD"},
        {"receipt_id": "Z-COMPATIBLE", "merchant": "Compatible Shop Downtown", "paid_date": "2025-08-20", "total": "10.00", "currency": "USD"},
    ]
    (inputs / "receipts.json").write_text(json.dumps(receipts, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), default="main")
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    if args.fixture == "main":
        main_fixture(output, random.Random(SEED))
    else:
        edge_fixture(output)


if __name__ == "__main__":
    main()
