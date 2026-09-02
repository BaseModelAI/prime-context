#!/usr/bin/env python3
"""Direct main-and-edge judge for Task 04."""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation
from pathlib import Path

INVOICE_FIELDS = ["invoice_id", "customer_id", "issued_date", "due_date", "amount", "currency"]
STATUS_FIELDS = INVOICE_FIELDS + ["applied_credit", "applied_payment", "balance", "status"]
APPLICATION_FIELDS = ["source_type", "source_id", "invoice_id", "amount", "currency"]
EXCEPTION_FIELDS = ["source_type", "source_id", "customer_id", "currency", "unapplied_amount", "reason"]
MONEY_PATTERN = re.compile(r"^\d+\.\d{2}$")
ZERO = Decimal("0.00")


def read_csv(path: Path, expected_fields: list[str]) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != expected_fields:
            raise ValueError(f"wrong CSV header in {path.name}")
        return list(reader)


def read_inputs(inputs: Path) -> tuple[list[dict[str, str]], list[dict[str, object]], list[dict[str, str]]]:
    invoices = read_csv(inputs / "invoices.csv", INVOICE_FIELDS)
    credits = json.loads((inputs / "credits.json").read_text(encoding="utf-8"))
    if not isinstance(credits, list):
        raise ValueError("credits.json is not an array")
    root = ET.parse(inputs / "payments.xml").getroot()
    if root.tag != "payments":
        raise ValueError("wrong payments XML root")
    payments: list[dict[str, str]] = []
    for element in root:
        if element.tag != "payment":
            raise ValueError("unexpected payments XML child")
        payment = dict(element.attrib)
        payment["memo"] = element.findtext("memo", default="")
        payments.append(payment)
    return invoices, credits, payments


def format_money(value: Decimal) -> str:
    return f"{value.quantize(Decimal('0.01')):.2f}"


def reference(inputs: Path) -> tuple[
    list[dict[str, str]],
    list[dict[str, str]],
    list[dict[str, str]],
    dict[tuple[str, str], tuple[Decimal, str, str]],
]:
    invoices, credits, payments = read_inputs(inputs)
    states: list[dict[str, object]] = []
    by_id: dict[str, dict[str, object]] = {}
    for row in invoices:
        state: dict[str, object] = {
            **row,
            "balance": Decimal(row["amount"]),
            "applied_credit": ZERO,
            "applied_payment": ZERO,
        }
        states.append(state)
        by_id[row["invoice_id"]] = state

    applications: list[dict[str, str]] = []
    exceptions: list[dict[str, str]] = []
    source_amounts: dict[tuple[str, str], tuple[Decimal, str, str]] = {}

    def apply(state: dict[str, object], source_type: str, source_id: str, amount: Decimal, currency: str) -> Decimal:
        balance = state["balance"]
        if not isinstance(balance, Decimal):
            raise TypeError("invalid reference balance")
        used = min(balance, amount)
        if used <= ZERO:
            return amount
        state["balance"] = balance - used
        total_key = "applied_credit" if source_type == "credit" else "applied_payment"
        current = state[total_key]
        if not isinstance(current, Decimal):
            raise TypeError("invalid reference total")
        state[total_key] = current + used
        applications.append({
            "source_type": source_type,
            "source_id": source_id,
            "invoice_id": str(state["invoice_id"]),
            "amount": format_money(used),
            "currency": currency,
        })
        return amount - used

    def normal_order(customer_id: str, currency: str) -> list[dict[str, object]]:
        return sorted(
            (
                state for state in states
                if state["customer_id"] == customer_id
                and state["currency"] == currency
                and isinstance(state["balance"], Decimal)
                and state["balance"] > ZERO
            ),
            key=lambda state: (str(state["due_date"]), str(state["invoice_id"])),
        )

    ordered_sources: list[tuple[str, dict[str, object]]] = []
    ordered_sources.extend(("credit", credit) for credit in credits if credit.get("invoice_id") is not None)
    ordered_sources.extend(("credit", credit) for credit in credits if credit.get("invoice_id") is None)
    ordered_sources.extend(("payment", payment) for payment in payments)

    for source_type, source in ordered_sources:
        id_field = "credit_id" if source_type == "credit" else "payment_id"
        source_id = str(source[id_field])
        customer_id = str(source["customer_id"])
        currency = str(source["currency"])
        remaining = Decimal(str(source["amount"]))
        source_amounts[(source_type, source_id)] = (remaining, customer_id, currency)

        if source_type == "credit" and source.get("invoice_id") is not None:
            state = by_id.get(str(source["invoice_id"]))
            if (
                state is not None
                and state["customer_id"] == customer_id
                and state["currency"] == currency
                and isinstance(state["balance"], Decimal)
                and state["balance"] > ZERO
            ):
                remaining = apply(state, source_type, source_id, remaining, currency)
        else:
            if source_type == "payment":
                for token in str(source.get("memo", "")).split():
                    state = by_id.get(token)
                    if (
                        state is not None
                        and state["customer_id"] == customer_id
                        and state["currency"] == currency
                        and isinstance(state["balance"], Decimal)
                        and state["balance"] > ZERO
                    ):
                        remaining = apply(state, source_type, source_id, remaining, currency)
                        break
            if remaining > ZERO:
                for state in normal_order(customer_id, currency):
                    remaining = apply(state, source_type, source_id, remaining, currency)
                    if remaining == ZERO:
                        break

        if remaining > ZERO:
            exceptions.append({
                "source_type": source_type,
                "source_id": source_id,
                "customer_id": customer_id,
                "currency": currency,
                "unapplied_amount": format_money(remaining),
                "reason": "unapplied_balance",
            })

    statuses: list[dict[str, str]] = []
    for state in states:
        balance = state["balance"]
        credit = state["applied_credit"]
        payment = state["applied_payment"]
        if not isinstance(balance, Decimal) or not isinstance(credit, Decimal) or not isinstance(payment, Decimal):
            raise TypeError("invalid reference state")
        statuses.append({
            **{field: str(state[field]) for field in INVOICE_FIELDS},
            "amount": format_money(Decimal(str(state["amount"]))),
            "applied_credit": format_money(credit),
            "applied_payment": format_money(payment),
            "balance": format_money(balance),
            "status": "paid" if balance == ZERO else "open",
        })
    return statuses, applications, exceptions, source_amounts


def require_money(rows: list[dict[str, str]], fields: list[str]) -> None:
    for row in rows:
        for field in fields:
            value = row[field]
            if not MONEY_PATTERN.fullmatch(value):
                raise ValueError(f"{field} is not a nonnegative two-decimal amount")
            Decimal(value)


def parse_outputs(root: Path) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]]]:
    statuses = read_csv(root / "output" / "invoice_status.csv", STATUS_FIELDS)
    applications = read_csv(root / "output" / "applications.csv", APPLICATION_FIELDS)
    exceptions = read_csv(root / "output" / "exceptions.csv", EXCEPTION_FIELDS)
    require_money(statuses, ["amount", "applied_credit", "applied_payment", "balance"])
    require_money(applications, ["amount"])
    require_money(exceptions, ["unapplied_amount"])
    return statuses, applications, exceptions


def conserved(
    applications: list[dict[str, str]],
    exceptions: list[dict[str, str]],
    sources: dict[tuple[str, str], tuple[Decimal, str, str]],
) -> bool:
    totals = {key: ZERO for key in sources}
    for row in applications:
        key = (row["source_type"], row["source_id"])
        if key not in sources or row["currency"] != sources[key][2]:
            return False
        amount = Decimal(row["amount"])
        if amount <= ZERO:
            return False
        totals[key] += amount
    for row in exceptions:
        key = (row["source_type"], row["source_id"])
        if key not in sources:
            return False
        _, customer_id, currency = sources[key]
        if row["customer_id"] != customer_id or row["currency"] != currency:
            return False
        amount = Decimal(row["unapplied_amount"])
        if amount <= ZERO:
            return False
        totals[key] += amount
    return all(totals[key] == details[0] for key, details in sources.items())


def generate_fixture(target: Path, fixture: str) -> None:
    task_dir = Path(__file__).resolve().parent
    subprocess.run(
        [sys.executable, str(task_dir / "seed.py"), "--workspace", str(target), "--fixture", fixture],
        check=True,
        text=True,
        capture_output=True,
        timeout=30,
    )
    generator = task_dir / "visible" / "_generate.py"
    subprocess.run(
        [sys.executable, str(generator), "--output", str(target), "--fixture", fixture],
        check=True,
        text=True,
        capture_output=True,
        timeout=30,
    )


def execute(source_workspace: Path, fixture: str) -> tuple[Path, subprocess.CompletedProcess[str], tempfile.TemporaryDirectory[str]]:
    temporary = tempfile.TemporaryDirectory(prefix=f"pcbench-04-{fixture}-")
    run_root = Path(temporary.name)
    generate_fixture(run_root, fixture)
    solution = source_workspace / "solution"
    if solution.is_dir():
        shutil.rmtree(run_root / "solution")
        shutil.copytree(solution, run_root / "solution")
    completed = subprocess.run(
        [sys.executable, "-E", "-S", "-m", "solution.invoice_match", "inputs", "--output", "output"],
        cwd=run_root,
        text=True,
        capture_output=True,
        timeout=30,
    )
    return run_root, completed, temporary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    args = parser.parse_args()
    workspace = Path(args.workspace).resolve()
    artifact = (workspace / "solution" / "invoice_match.py").is_file()
    notes: list[str] = []
    main_checks = [False] * 5
    main_parseable = False
    runnable = False
    edge_passed = False
    main_temp = edge_temp = None

    try:
        if artifact:
            main_root, main_run, main_temp = execute(workspace, "main")
            runnable = main_run.returncode == 0
            if not runnable:
                imported = subprocess.run(
                    [sys.executable, "-E", "-S", "-c", "import solution.invoice_match"], cwd=main_root,
                    capture_output=True, text=True, timeout=10,
                )
                runnable = imported.returncode == 0
            if main_run.returncode != 0:
                notes.append("main command failed")
            else:
                try:
                    actual_statuses, actual_apps, actual_exceptions = parse_outputs(main_root)
                    expected_statuses, expected_apps, expected_exceptions, source_amounts = reference(main_root / "inputs")
                    main_parseable = True
                    main_checks[0] = conserved(actual_apps, actual_exceptions, source_amounts)
                    memo_apps = [
                        (row["invoice_id"], row["amount"])
                        for row in actual_apps if row["source_id"] == "PAY-MEMO"
                    ]
                    nonexact_apps = [
                        (row["invoice_id"], row["amount"])
                        for row in actual_apps if row["source_id"] == "PAY-NONEXACT"
                    ]
                    main_checks[1] = memo_apps == [("INV-MEMO-TARGET", "60.00")] and nonexact_apps == [("INV-MEMO-OLD", "20.00")]
                    main_checks[2] = actual_apps == expected_apps
                    main_checks[3] = actual_statuses == expected_statuses
                    main_checks[4] = actual_exceptions == expected_exceptions
                except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ET.ParseError, InvalidOperation, ValueError, KeyError, TypeError) as exc:
                    notes.append(f"main outputs invalid: {type(exc).__name__}")

        if artifact:
            edge_root, edge_run, edge_temp = execute(workspace, "edge")
            if edge_run.returncode != 0:
                notes.append("edge command failed")
            else:
                try:
                    actual_statuses, actual_apps, actual_exceptions = parse_outputs(edge_root)
                    expected_statuses, expected_apps, expected_exceptions, _ = reference(edge_root / "inputs")
                    edge_payment = [
                        (row["invoice_id"], row["amount"])
                        for row in actual_apps if row["source_id"] == "PAY-EDGE"
                    ]
                    edge_passed = (
                        actual_statuses == expected_statuses
                        and actual_apps == expected_apps
                        and actual_exceptions == expected_exceptions
                        and edge_payment == [("INV-EDGE-OPEN-A", "20.00"), ("INV-EDGE-OPEN-B", "15.00")]
                        and actual_exceptions == [{
                            "source_type": "payment",
                            "source_id": "PAY-EDGE",
                            "customer_id": "C-EDGE",
                            "currency": "USD",
                            "unapplied_amount": "15.00",
                            "reason": "unapplied_balance",
                        }]
                    )
                except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ET.ParseError, InvalidOperation, ValueError, KeyError, TypeError):
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
