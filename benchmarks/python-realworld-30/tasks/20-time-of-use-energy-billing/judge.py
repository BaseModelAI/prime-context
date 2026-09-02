#!/usr/bin/env python3
"""Fresh main-and-edge judge for Task 20."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
from zoneinfo import ZoneInfo

TASK = Path(__file__).resolve().parent
PYTHON = shutil.which("python3.12") or "python3.12"
PERIOD = "2025-10"
CENT = Decimal("0.01")
BILLS_HEADER = [
    "customer_id", "period", "energy_charge", "demand_rate_id", "demand_kw",
    "demand_charge", "tax_rate", "tax_charge", "total",
]
DETAIL_HEADER = [
    "customer_id", "period", "band", "rate_id", "interval_count", "kwh", "energy_charge",
]
ADJUST_HEADER = ["customer_id", "old_total", "corrected_total", "delta"]


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def fmt(value: Decimal, places: int) -> str:
    return f"{value:.{places}f}"


def invoke(script: Path, *arguments: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [PYTHON, "-E", "-S", str(script), *arguments], cwd=cwd,
        text=True, capture_output=True, timeout=300,
    )


def copy_payload(source: Path, destination: Path, fixture: str) -> bool:
    payload = Path(tempfile.mkdtemp(prefix="task20-payload-"))
    try:
        for path in sorted(source.rglob("*")):
            relative = path.relative_to(source)
            if relative.name == "_generate.py":
                continue
            target = payload / relative
            if path.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            elif path.is_file():
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, target)
        generator = source / "_generate.py"
        if generator.is_file():
            result = invoke(
                generator, "--output", str(payload), "--fixture", fixture, cwd=source
            )
            if result.returncode:
                return False
        shutil.copytree(payload, destination, dirs_exist_ok=True)
        return True
    finally:
        shutil.rmtree(payload, ignore_errors=True)


def read_inputs(root: Path, corrected: bool) -> dict[str, object]:
    with (root / "inputs/customers.csv").open(encoding="utf-8", newline="") as handle:
        customers = {row["customer_id"]: row for row in csv.DictReader(handle)}
    with (root / "inputs/readings.csv").open(encoding="utf-8", newline="") as handle:
        readings = list(csv.DictReader(handle))
    tariffs = json.loads((root / "inputs/tariffs.json").read_text(encoding="utf-8"))
    holidays = set(json.loads((root / "inputs/holidays.json").read_text(encoding="utf-8"))["dates"])
    correction = None
    correction_path = root / "inputs/tariff_correction.json"
    if corrected and correction_path.is_file():
        correction = json.loads(correction_path.read_text(encoding="utf-8"))

    groups: dict[tuple[str, str, str], dict[str, object]] = {}
    demand_max: dict[str, Decimal] = {}
    billed: set[str] = set()
    affected: set[str] = set()
    qualifying = set(tariffs["demand"]["qualifying_bands"])

    for row in readings:
        customer_id = row["customer_id"]
        customer = customers[customer_id]
        instant = datetime.fromisoformat(row["interval_start"])
        if instant.tzinfo is None:
            raise ValueError("reading offset missing")
        local = instant.astimezone(ZoneInfo(customer["timezone"]))
        if local.strftime("%Y-%m") != PERIOD:
            continue
        billed.add(customer_id)
        date_text = local.date().isoformat()
        schedule_name = "holiday" if date_text in holidays else "weekend" if local.weekday() >= 5 else "weekday"
        minute = local.hour * 60 + local.minute
        band = ""
        for item in tariffs["day_schedules"][schedule_name]:
            start_h, start_m = map(int, item["start"].split(":"))
            end_h, end_m = map(int, item["end"].split(":"))
            if start_h * 60 + start_m <= minute < end_h * 60 + end_m:
                band = item["band"]
                break
        if not band:
            raise ValueError("schedule gap")
        wall = local.replace(tzinfo=None)
        original = next(
            rate for rate in tariffs["energy_rates"]
            if rate["band"] == band
            and datetime.fromisoformat(rate["effective_from"]) <= wall
            < datetime.fromisoformat(rate["effective_to"])
        )
        rate_id = original["rate_id"]
        price = Decimal(original["price_per_kwh"])
        if (
            correction is not None
            and rate_id == correction["rate_id"]
            and wall >= datetime.fromisoformat(correction["effective_from"])
        ):
            rate_id = correction["new_rate_id"]
            price = Decimal(correction["new_price_per_kwh"])
            affected.add(customer_id)
        key = (customer_id, band, rate_id)
        group = groups.setdefault(key, {"count": 0, "kwh": Decimal(0), "price": price})
        group["count"] = int(group["count"]) + 1
        group["kwh"] = Decimal(group["kwh"]) + Decimal(row["kwh"])
        quantity = Decimal(row["kwh"])
        if band in qualifying and quantity >= 0:
            demand_max[customer_id] = max(demand_max.get(customer_id, Decimal(0)), Decimal(row["kw"]))

    details: list[dict[str, str]] = []
    for (customer_id, band, rate_id), item in sorted(groups.items()):
        quantity = Decimal(item["kwh"])
        charge = money(quantity * Decimal(item["price"]))
        details.append({
            "customer_id": customer_id,
            "period": PERIOD,
            "band": band,
            "rate_id": rate_id,
            "interval_count": str(item["count"]),
            "kwh": fmt(quantity, 4),
            "energy_charge": fmt(charge, 2),
        })

    bills: list[dict[str, str]] = []
    demand_rate = tariffs["demand"]
    for customer_id in sorted(billed):
        energy = sum(
            (Decimal(row["energy_charge"]) for row in details if row["customer_id"] == customer_id),
            Decimal(0),
        )
        kw = demand_max.get(customer_id, Decimal(0))
        demand_charge = money(kw * Decimal(demand_rate["price_per_kw"]))
        tax_rate = Decimal(customers[customer_id]["tax_rate"])
        tax = money((energy + demand_charge) * tax_rate)
        total = energy + demand_charge + tax
        bills.append({
            "customer_id": customer_id,
            "period": PERIOD,
            "energy_charge": fmt(energy, 2),
            "demand_rate_id": demand_rate["rate_id"],
            "demand_kw": fmt(kw, 3),
            "demand_charge": fmt(demand_charge, 2),
            "tax_rate": fmt(tax_rate, 4),
            "tax_charge": fmt(tax, 2),
            "total": fmt(total, 2),
        })
    return {"bills": bills, "details": details, "affected": affected}


def expected_outputs(root: Path) -> dict[str, object]:
    original = read_inputs(root, False)
    corrected = read_inputs(root, True)
    old_by_id = {row["customer_id"]: row for row in original["bills"]}
    new_by_id = {row["customer_id"]: row for row in corrected["bills"]}
    adjustments = []
    for customer_id in sorted(corrected["affected"]):
        old_total = Decimal(old_by_id[customer_id]["total"])
        new_total = Decimal(new_by_id[customer_id]["total"])
        adjustments.append({
            "customer_id": customer_id,
            "old_total": fmt(old_total, 2),
            "corrected_total": fmt(new_total, 2),
            "delta": fmt(new_total - old_total, 2),
        })
    explanations: dict[str, str] = {}
    detail_rows = corrected["details"]
    adjustment_by_id = {row["customer_id"]: row for row in adjustments}
    for bill in corrected["bills"]:
        customer_id = bill["customer_id"]
        lines = [f"Customer: {customer_id}", f"Period: {PERIOD}"]
        for row in detail_rows:
            if row["customer_id"] == customer_id:
                lines.append(
                    f"Band: {row['band']} | Rate: {row['rate_id']} | Intervals: {row['interval_count']} | "
                    f"kWh: {row['kwh']} | Energy: {row['energy_charge']}"
                )
        lines.append(
            f"Demand | Rate: {bill['demand_rate_id']} | kW: {bill['demand_kw']} | Charge: {bill['demand_charge']}"
        )
        lines.append(f"Tax | Rate: {bill['tax_rate']} | Charge: {bill['tax_charge']}")
        adjustment = adjustment_by_id.get(customer_id)
        prior = adjustment["old_total"] if adjustment else bill["total"]
        delta = Decimal(adjustment["delta"]) if adjustment else Decimal(0)
        signed_delta = "0.00" if delta == 0 else f"{delta:+.2f}"
        lines.extend([
            f"Prior total: {prior}",
            f"Correction delta: {signed_delta}",
            f"Final total: {bill['total']}",
        ])
        explanations[customer_id] = "\n".join(lines) + "\n"
    return {
        "bills": corrected["bills"],
        "details": corrected["details"],
        "adjustments": adjustments,
        "explanations": explanations,
    }


def prepare(candidate: Path, fixture: str) -> tuple[Path, tempfile.TemporaryDirectory[str], bool, dict[str, object] | None, str]:
    holder = tempfile.TemporaryDirectory(prefix=f"task20-{fixture}-")
    work = Path(holder.name) / "workspace"
    seeded = invoke(TASK / "seed.py", "--workspace", str(work), "--fixture", fixture, cwd=TASK)
    if seeded.returncode:
        return work, holder, False, None, "fixture seed failed"
    for source in (TASK / "visible", TASK / "stages/tariff-correction", TASK / "stages/explanations"):
        if not copy_payload(source, work, fixture):
            return work, holder, False, None, "fixture generator failed"
    expected = expected_outputs(work)
    shutil.rmtree(work / "solution", ignore_errors=True)
    artifact = candidate / "solution"
    if artifact.is_dir():
        shutil.copytree(artifact, work / "solution")
    else:
        (work / "solution").mkdir()
    completed = subprocess.run(
        [PYTHON, "-E", "-S", "-m", "solution.energy_bill", "inputs", "--period", PERIOD, "--output", "output"],
        cwd=work, text=True, capture_output=True, timeout=180,
    )
    detail = "" if completed.returncode == 0 else completed.stderr[-300:]
    return work, holder, completed.returncode == 0, expected, detail


def read_csv(path: Path, header: list[str]) -> tuple[list[dict[str, str]], bool]:
    raw = path.read_bytes()
    clean = bool(raw) and raw.endswith(b"\n") and b"\r" not in raw
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != header:
            raise ValueError(f"bad header: {path.name}")
        rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError(f"malformed row: {path.name}")
    return rows, clean


def select(rows: list[dict[str, str]], fields: list[str]) -> list[dict[str, str]]:
    return [{field: row[field] for field in fields} for row in rows]


def explanations_match(root: Path, expected: dict[str, str]) -> bool:
    directory = root / "output/explanations"
    if not directory.is_dir():
        return False
    actual_files = sorted(path.name for path in directory.iterdir() if path.is_file())
    wanted_files = sorted(f"{customer_id}.txt" for customer_id in expected)
    if actual_files != wanted_files:
        return False
    return all(
        (directory / f"{customer_id}.txt").read_text(encoding="utf-8") == text
        and b"\r" not in (directory / f"{customer_id}.txt").read_bytes()
        for customer_id, text in expected.items()
    )


def check_main(work: Path, runnable: bool, expected: dict[str, object] | None) -> tuple[list[bool], bool, list[str]]:
    checks = [False] * 5
    notes: list[str] = []
    if not runnable or expected is None:
        return checks, False, ["main command failed"]
    parseable = False
    try:
        bills, bills_clean = read_csv(work / "output/bills.csv", BILLS_HEADER)
        details, details_clean = read_csv(work / "output/bill_detail.csv", DETAIL_HEADER)
        parseable = True
        bill_identity = select(bills, ["customer_id", "period"])
        detail_identity = select(details, ["customer_id", "period", "band", "rate_id", "interval_count"])
        expected_bill_identity = select(expected["bills"], ["customer_id", "period"])
        expected_detail_identity = select(expected["details"], ["customer_id", "period", "band", "rate_id", "interval_count"])
        london_count = sum(int(row["interval_count"]) for row in details if row["customer_id"] == "C-LONDON")
        checks[0] = (
            bills_clean and details_clean and bill_identity == expected_bill_identity
            and detail_identity == expected_detail_identity and london_count == 2980
        )
        amount_fields = ["customer_id", "period", "band", "rate_id", "kwh", "energy_charge"]
        bill_amount_fields = ["customer_id", "period", "energy_charge", "tax_rate", "tax_charge", "total"]
        checks[1] = (
            select(details, amount_fields) == select(expected["details"], amount_fields)
            and select(bills, bill_amount_fields) == select(expected["bills"], bill_amount_fields)
        )
        demand_fields = ["customer_id", "demand_rate_id", "demand_kw", "demand_charge"]
        checks[2] = select(bills, demand_fields) == select(expected["bills"], demand_fields)
    except (OSError, UnicodeError, csv.Error, ValueError, KeyError) as exc:
        notes.append(f"main billing outputs invalid: {type(exc).__name__}")
    try:
        adjustments, clean = read_csv(work / "output/adjustments.csv", ADJUST_HEADER)
        bill_totals = {row["customer_id"]: row["total"] for row in bills}
        checks[3] = (
            clean and adjustments == expected["adjustments"]
            and all(bill_totals[row["customer_id"]] == row["corrected_total"] for row in adjustments)
            and any(row["delta"] != "0.00" for row in adjustments)
        )
    except (OSError, UnicodeError, csv.Error, ValueError, KeyError, UnboundLocalError):
        pass
    try:
        checks[4] = explanations_match(work, expected["explanations"])
    except (OSError, UnicodeError):
        pass
    for number, passed in enumerate(checks, 1):
        if not passed:
            notes.append(f"main semantic check {number} failed")
    return checks, parseable, notes


def check_edge(work: Path, runnable: bool, expected: dict[str, object] | None) -> tuple[bool, str]:
    if not runnable or expected is None:
        return False, "edge command failed"
    try:
        bills, bills_clean = read_csv(work / "output/bills.csv", BILLS_HEADER)
        details, details_clean = read_csv(work / "output/bill_detail.csv", DETAIL_HEADER)
        adjustments, adjustments_clean = read_csv(work / "output/adjustments.csv", ADJUST_HEADER)
        row = details[0]
        passed = (
            bills_clean and details_clean and adjustments_clean
            and bills == expected["bills"] and details == expected["details"]
            and adjustments == expected["adjustments"]
            and explanations_match(work, expected["explanations"])
            and len(details) == 1 and row["interval_count"] == "3"
            and row["kwh"] == "1.0000" and row["energy_charge"] == "0.25"
            and bills[0]["demand_kw"] == "6.000" and bills[0]["demand_charge"] == "72.00"
        )
        return passed, "" if passed else "negative-kWh edge semantics failed"
    except (OSError, UnicodeError, csv.Error, ValueError, KeyError, IndexError):
        return False, "negative-kWh edge outputs missing"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "solution/energy_bill.py").is_file()
    notes: list[str] = []

    main_work, main_holder, main_done, main_expected, detail = prepare(candidate, "main")
    try:
        checks, parseable, main_notes = check_main(main_work, main_done, main_expected)
        notes.extend(main_notes)
        if detail and not main_done:
            notes.append(detail)
    finally:
        main_holder.cleanup()

    edge_work, edge_holder, edge_done, edge_expected, _ = prepare(candidate, "edge")
    try:
        edge, edge_note = check_edge(edge_work, edge_done, edge_expected)
        if edge_note:
            notes.append(edge_note)
    finally:
        edge_holder.cleanup()

    passed = sum(checks)
    if passed == 5 and edge:
        level = 5
    elif passed == 5:
        level = 4
    elif passed:
        level = 3
    elif parseable:
        level = 2
    elif artifact:
        level = 1
    else:
        level = 0
    print(json.dumps({
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": 5,
        "edge_check_passed": edge,
        "notes": notes,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
