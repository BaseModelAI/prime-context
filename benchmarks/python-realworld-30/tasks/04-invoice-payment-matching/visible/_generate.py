#!/usr/bin/env python3
"""Runner-side deterministic fixture generator for Task 04."""
from __future__ import annotations

import argparse
import csv
import json
import random
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

SEED = 20260831 + 4
INVOICE_FIELDS = ["invoice_id", "customer_id", "issued_date", "due_date", "amount", "currency"]


def money(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):.2f}"


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def write_payments(path: Path, payments: list[dict[str, str]]) -> None:
    root = ET.Element("payments")
    for payment in payments:
        attributes = {key: payment[key] for key in ("payment_id", "customer_id", "date", "amount", "currency")}
        element = ET.SubElement(root, "payment", attributes)
        ET.SubElement(element, "memo").text = payment["memo"]
    ET.indent(root, space="  ")
    tree = ET.ElementTree(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    tree.write(path, encoding="utf-8", xml_declaration=True)


def main_fixture(output: Path, rng: random.Random) -> None:
    inputs = output / "inputs"
    invoices: list[dict[str, str]] = [
        {"invoice_id": "INV-SPLIT-2", "customer_id": "C-SPLIT", "issued_date": "2025-01-02", "due_date": "2025-01-20", "amount": "90.00", "currency": "USD"},
        {"invoice_id": "INV-SPLIT-1", "customer_id": "C-SPLIT", "issued_date": "2025-01-01", "due_date": "2025-01-10", "amount": "60.00", "currency": "USD"},
        {"invoice_id": "INV-COMBINE-1", "customer_id": "C-COMBINE", "issued_date": "2025-01-03", "due_date": "2025-01-18", "amount": "100.00", "currency": "EUR"},
        {"invoice_id": "INV-CREDIT-CASH", "customer_id": "C-MIX", "issued_date": "2025-01-04", "due_date": "2025-01-19", "amount": "100.00", "currency": "USD"},
        {"invoice_id": "INV-CUSTCR-2", "customer_id": "C-CUSTCR", "issued_date": "2024-12-07", "due_date": "2025-01-06", "amount": "40.00", "currency": "USD"},
        {"invoice_id": "INV-CUSTCR-1", "customer_id": "C-CUSTCR", "issued_date": "2024-12-06", "due_date": "2025-01-05", "amount": "40.00", "currency": "USD"},
        {"invoice_id": "INV-MEMO-TARGET", "customer_id": "C-MEMO", "issued_date": "2025-02-01", "due_date": "2025-03-01", "amount": "80.00", "currency": "USD"},
        {"invoice_id": "INV-MEMO-OLD", "customer_id": "C-MEMO", "issued_date": "2024-12-01", "due_date": "2025-01-01", "amount": "50.00", "currency": "USD"},
        {"invoice_id": "INV-OVER-1", "customer_id": "C-OVER", "issued_date": "2025-01-05", "due_date": "2025-01-25", "amount": "30.00", "currency": "EUR"},
    ]
    credits: list[dict[str, object]] = [
        {"credit_id": "CR-CUSTOMER", "customer_id": "C-CUSTCR", "date": "2025-01-07", "amount": "50.00", "currency": "USD", "invoice_id": None},
        {"credit_id": "CR-SPECIFIC", "customer_id": "C-MIX", "date": "2025-01-06", "amount": "25.00", "currency": "USD", "invoice_id": "INV-CREDIT-CASH"},
    ]
    payments: list[dict[str, str]] = [
        {"payment_id": "PAY-SPLIT", "customer_id": "C-SPLIT", "date": "2025-01-22", "amount": "100.00", "currency": "USD", "memo": "monthly settlement"},
        {"payment_id": "PAY-COMBINE-A", "customer_id": "C-COMBINE", "date": "2025-01-20", "amount": "35.00", "currency": "EUR", "memo": "part one"},
        {"payment_id": "PAY-COMBINE-B", "customer_id": "C-COMBINE", "date": "2025-01-21", "amount": "65.00", "currency": "EUR", "memo": "part two"},
        {"payment_id": "PAY-CREDIT-CASH", "customer_id": "C-MIX", "date": "2025-01-21", "amount": "75.00", "currency": "USD", "memo": "cash after credit"},
        {"payment_id": "PAY-MEMO", "customer_id": "C-MEMO", "date": "2025-02-15", "amount": "60.00", "currency": "USD", "memo": "please apply INV-MEMO-TARGET thanks"},
        {"payment_id": "PAY-NONEXACT", "customer_id": "C-MEMO", "date": "2025-02-16", "amount": "20.00", "currency": "USD", "memo": "reference INV-MEMO-TARGET,"},
        {"payment_id": "PAY-OVER", "customer_id": "C-OVER", "date": "2025-01-26", "amount": "50.00", "currency": "EUR", "memo": "account payment"},
    ]

    base_due = date(2025, 2, 1)
    for group in range(1, 38):
        customer = f"C-F{group:03d}"
        currency = "USD" if group % 2 else "EUR"
        group_rows: list[dict[str, str]] = []
        amounts: list[Decimal] = []
        # Input order and due-date order intentionally differ.
        offsets = (group % 6 + 8, group % 6 + 2, group % 6 + 5)
        for position, suffix in enumerate(("A", "B", "C")):
            amount = Decimal(rng.randrange(2500, 12001)) / Decimal(100)
            due = base_due + timedelta(days=offsets[position] + group)
            row = {
                "invoice_id": f"INV-F{group:03d}-{suffix}",
                "customer_id": customer,
                "issued_date": (due - timedelta(days=30)).isoformat(),
                "due_date": due.isoformat(),
                "amount": money(amount),
                "currency": currency,
            }
            group_rows.append(row)
            amounts.append(amount)
        invoices.extend(group_rows)

        if group % 8 == 0:
            credits.append({
                "credit_id": f"CR-F{group:03d}-SPEC",
                "customer_id": customer,
                "date": "2025-03-01",
                "amount": "5.00",
                "currency": currency,
                "invoice_id": f"INV-F{group:03d}-A",
            })
        if group % 7 == 0:
            credits.append({
                "credit_id": f"CR-F{group:03d}-CUSTOMER",
                "customer_id": customer,
                "date": "2025-03-02",
                "amount": "7.50",
                "currency": currency,
                "invoice_id": None,
            })

        total = sum(amounts, Decimal(0))
        if group % 10 == 0:
            payment_amount = total + Decimal("10.00")
        else:
            percentage = Decimal(rng.randrange(55, 96)) / Decimal(100)
            payment_amount = (total * percentage).quantize(Decimal("0.01"))
        memo = "regular account payment"
        if group % 9 == 0:
            memo = f"priority INV-F{group:03d}-C"
        payments.append({
            "payment_id": f"PAY-F{group:03d}",
            "customer_id": customer,
            "date": "2025-03-10",
            "amount": money(payment_amount),
            "currency": currency,
            "memo": memo,
        })

    if len(invoices) != 120:
        raise AssertionError("main fixture must contain 120 invoices")
    write_csv(inputs / "invoices.csv", INVOICE_FIELDS, invoices)
    write_payments(inputs / "payments.xml", payments)
    (inputs / "credits.json").write_text(json.dumps(credits, indent=2) + "\n", encoding="utf-8")


def edge_fixture(output: Path) -> None:
    inputs = output / "inputs"
    invoices = [
        {"invoice_id": "INV-EDGE-CLOSED", "customer_id": "C-EDGE", "issued_date": "2024-12-01", "due_date": "2025-01-01", "amount": "25.00", "currency": "USD"},
        {"invoice_id": "INV-EDGE-OPEN-B", "customer_id": "C-EDGE", "issued_date": "2024-12-03", "due_date": "2025-01-03", "amount": "15.00", "currency": "USD"},
        {"invoice_id": "INV-EDGE-OPEN-A", "customer_id": "C-EDGE", "issued_date": "2024-12-02", "due_date": "2025-01-02", "amount": "20.00", "currency": "USD"},
    ]
    credits: list[dict[str, object]] = [
        {"credit_id": "CR-EDGE-CLOSE", "customer_id": "C-EDGE", "date": "2025-01-04", "amount": "25.00", "currency": "USD", "invoice_id": "INV-EDGE-CLOSED"}
    ]
    payments = [
        {"payment_id": "PAY-EDGE", "customer_id": "C-EDGE", "date": "2025-01-05", "amount": "50.00", "currency": "USD", "memo": "apply INV-EDGE-CLOSED"}
    ]
    write_csv(inputs / "invoices.csv", INVOICE_FIELDS, invoices)
    write_payments(inputs / "payments.xml", payments)
    (inputs / "credits.json").write_text(json.dumps(credits, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    if args.fixture == "main":
        main_fixture(output, random.Random(SEED))
    else:
        edge_fixture(output)


if __name__ == "__main__":
    main()
