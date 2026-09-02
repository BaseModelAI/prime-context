#!/usr/bin/env python3.12
"""Judge task 22 against fresh deterministic main and edge fixtures."""
from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import subprocess
import tempfile
from decimal import Decimal
from pathlib import Path

PYTHON = "/usr/bin/python3.12"
OUTPUT_LIMIT = 4096
TASK_DIR = Path(__file__).resolve().parent


def copy_candidate(workspace: Path, target: Path) -> bool:
    for relative in (Path("solution/__init__.py"), Path("solution/payroll.py")):
        source = workspace / relative
        if source.is_file():
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    return (target / "solution" / "payroll.py").is_file()


def materialize_stage(stage: str, fixture: str, workspace: Path) -> None:
    source = TASK_DIR / "stages" / stage
    with tempfile.TemporaryDirectory(prefix="pcbench-22-stage-") as td:
        payload = Path(td)
        for item in source.rglob("*"):
            rel = item.relative_to(source)
            if item.is_file() and item.name != "_generate.py":
                (payload / rel).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, payload / rel)
        generator = source / "_generate.py"
        if generator.is_file():
            subprocess.run(
                [PYTHON, "-E", "-S", str(generator), "--output", str(payload), "--fixture", fixture],
                cwd=source, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                timeout=30,
            )
        for item in payload.rglob("*"):
            if item.is_file():
                destination = workspace / item.relative_to(payload)
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, destination)


def fresh_run(candidate: Path, fixture: str) -> tuple[Path, int, str]:
    holder = Path(tempfile.mkdtemp(prefix=f"pcbench-22-{fixture}-"))
    work = holder / "workspace"
    subprocess.run(
        [PYTHON, "-E", "-S", str(TASK_DIR / "seed.py"), "--workspace", str(work), "--fixture", fixture],
        cwd=TASK_DIR, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30,
    )
    materialize_stage("corrections", fixture, work)
    materialize_stage("union-rules", fixture, work)
    copy_candidate(candidate, work)
    out = work / "output"
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir()
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        try:
            completed = subprocess.run(
                [PYTHON, "-E", "-S", "-m", "solution.payroll", "inputs", "--week-ending", "2025-11-09", "--output", "output"],
                cwd=work, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, timeout=45,
                env={"PATH": os.environ.get("PATH", "")},
            )
            code = completed.returncode
        except subprocess.TimeoutExpired:
            code = 124
        stdout.seek(0)
        stderr.seek(0)
        diagnostic = (stdout.read(OUTPUT_LIMIT) + stderr.read(OUTPUT_LIMIT)).decode("utf-8", "replace")
    return holder, code, diagnostic[:OUTPUT_LIMIT]


def rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


def exact_header(path: Path, expected: list[str]) -> bool:
    try:
        with path.open(newline="", encoding="utf-8") as stream:
            return next(csv.reader(stream)) == expected
    except (OSError, StopIteration, UnicodeError, csv.Error):
        return False


def money(value: str) -> Decimal:
    return Decimal(value)


def check_main(candidate: Path) -> tuple[list[bool], bool, bool, str]:
    holder, code, diagnostic = fresh_run(candidate, "main")
    try:
        out = holder / "workspace" / "output"
        payroll_header = ["employee_id", "regular_hours", "overtime_hours", "doubletime_hours", "night_minutes", "holiday_hours", "gross_pay"]
        shift_header = ["employee_id", "shift_id", "paid_minutes", "regular_minutes", "overtime_minutes", "doubletime_minutes", "night_minutes", "holiday_minutes", "gross_pay"]
        exception_header = ["employee_id", "shift_id", "record_id", "reason"]
        correction_header = ["employee_id", "old_gross_pay", "corrected_gross_pay", "delta"]
        structural = code == 0 and all((out / name).is_file() for name in (
            "payroll.csv", "shift_detail.csv", "exceptions.csv", "correction_summary.csv"
        ))
        if not structural:
            return [False] * 5, code == 0, False, diagnostic
        try:
            payroll = rows(out / "payroll.csv")
            shifts = rows(out / "shift_detail.csv")
            exceptions = rows(out / "exceptions.csv")
            corrections = rows(out / "correction_summary.csv")
            parsed = all((
                exact_header(out / "payroll.csv", payroll_header),
                exact_header(out / "shift_detail.csv", shift_header),
                exact_header(out / "exceptions.csv", exception_header),
                exact_header(out / "correction_summary.csv", correction_header),
            ))
            pay = {row["employee_id"]: row for row in payroll}
            detail = {(row["employee_id"], row["shift_id"]): row for row in shifts}
        except (OSError, UnicodeError, csv.Error, KeyError):
            return [False] * 5, True, False, diagnostic

        # 1. Pairing, automatic/explicit breaks, and the unmatched IN exception.
        pairing = (
            detail.get(("E1", "E1-3"), {}).get("paid_minutes") == "510"
            and detail.get(("E2", "U-NIGHT"), {}).get("paid_minutes") == "570"
            and any(row.get("employee_id") == "E4" and row.get("shift_id") == "BROKEN" and row.get("record_id") == "R0019" for row in exceptions)
        )
        # 2. Non-union weekly overtime and union local-day overtime/double time do not stack.
        tiers = (
            pay.get("E1", {}).get("regular_hours") == "40.00"
            and pay.get("E1", {}).get("overtime_hours") == "1.50"
            and pay.get("E2", {}).get("regular_hours") == "17.50"
            and pay.get("E2", {}).get("overtime_hours") == "4.00"
            and pay.get("E2", {}).get("doubletime_hours") == "0.50"
        )
        # 3. Night and holiday classification is minute based.
        minute_premiums = (
            pay.get("E2", {}).get("night_minutes") == "450"
            and pay.get("E3", {}).get("night_minutes") == "0"
            and pay.get("E3", {}).get("holiday_hours") == "2.00"
        )
        # 4. The replacement punch changes only E1 by the exact amount.
        correction = corrections == [{
            "employee_id": "E1", "old_gross_pay": "875.00",
            "corrected_gross_pay": "845.00", "delta": "-30.00",
        }]
        # 5. Every employee gross total is exact, including deterministic filler rows.
        expected_ids = {"E1", "E2", "E3"} | {f"E{n}" for n in range(10, 30)}
        exact_totals = parsed and set(pay) == expected_ids
        expected_anchor = {"E1": Decimal("845.00"), "E2": Decimal("757.50"), "E3": Decimal("88.00")}
        try:
            exact_totals = exact_totals and all(money(pay[e]["gross_pay"]) == value for e, value in expected_anchor.items())
            employee_rates = {row["employee_id"]: Decimal(row["hourly_rate"]) for row in rows(holder / "workspace" / "inputs" / "employees.csv")}
            exact_totals = exact_totals and all(
                money(pay[f"E{n}"]["gross_pay"]) == employee_rates[f"E{n}"] * Decimal("7.5")
                for n in range(10, 30)
            )
        except (KeyError, ArithmeticError):
            exact_totals = False
        return [pairing, tiers, minute_premiums, correction, exact_totals], True, parsed, diagnostic
    finally:
        shutil.rmtree(holder, ignore_errors=True)


def check_edge(candidate: Path) -> tuple[bool, str]:
    holder, code, diagnostic = fresh_run(candidate, "edge")
    try:
        out = holder / "workspace" / "output"
        if code != 0:
            return False, diagnostic
        try:
            pay = {row["employee_id"]: row for row in rows(out / "payroll.csv")}
            detail = {(row["employee_id"], row["shift_id"]): row for row in rows(out / "shift_detail.csv")}
            edge = pay["E9"]
            shift = detail[("E9", "DST")]
            passed = (
                edge["regular_hours"] == "3.00"
                and edge["night_minutes"] == "180"
                and Decimal(edge["gross_pay"]) == Decimal("198.00")
                and shift["paid_minutes"] == "180"
            )
            return passed, diagnostic
        except (OSError, UnicodeError, csv.Error, KeyError, ArithmeticError):
            return False, diagnostic
    finally:
        shutil.rmtree(holder, ignore_errors=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "solution" / "payroll.py").is_file()
    notes: list[str] = []
    if artifact:
        try:
            checks, runnable, parsed, diagnostic = check_main(candidate)
        except Exception as exc:
            checks, runnable, parsed, diagnostic = [False] * 5, True, False, f"malformed main output: {exc}"
        try:
            edge, edge_diagnostic = check_edge(candidate)
        except Exception as exc:
            edge, edge_diagnostic = False, f"malformed edge output: {exc}"
        if diagnostic and not runnable:
            notes.append("main command failed: " + diagnostic[:240].replace("\n", " "))
        if edge_diagnostic and not edge:
            notes.append("edge command/check failed: " + edge_diagnostic[:240].replace("\n", " "))
    else:
        checks, runnable, parsed, edge = [False] * 5, False, False, False
    passed = sum(checks)
    if not artifact:
        level = 0
    elif not runnable:
        level = 1
    elif not parsed:
        level = 1
    elif passed == 5:
        level = 5 if edge else 4
    else:
        level = 3 if passed else 2
    result = {
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": 5,
        "edge_check_passed": edge,
        "notes": notes[:3],
    }
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
