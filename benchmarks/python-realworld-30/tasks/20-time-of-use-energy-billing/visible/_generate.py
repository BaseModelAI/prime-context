#!/usr/bin/env python3
"""Generate Task 20 billing inputs outside the candidate workspace."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import random
from zoneinfo import ZoneInfo

SEED = 20260831 + 20


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def tariffs() -> dict[str, object]:
    return {
        "effective_time_basis": "customer_local",
        "day_schedules": {
            "weekday": [
                {"band": "off_peak", "start": "00:00", "end": "07:00"},
                {"band": "shoulder", "start": "07:00", "end": "16:00"},
                {"band": "peak", "start": "16:00", "end": "21:00"},
                {"band": "shoulder", "start": "21:00", "end": "23:00"},
                {"band": "off_peak", "start": "23:00", "end": "24:00"},
            ],
            "weekend": [
                {"band": "weekend", "start": "00:00", "end": "24:00"},
            ],
            "holiday": [
                {"band": "holiday", "start": "00:00", "end": "24:00"},
            ],
        },
        "energy_rates": [
            {"band": "off_peak", "rate_id": "OFF-OCT", "effective_from": "2025-10-01T00:00:00", "effective_to": "2025-11-01T00:00:00", "price_per_kwh": "0.1000"},
            {"band": "weekend", "rate_id": "WEEKEND-OCT", "effective_from": "2025-10-01T00:00:00", "effective_to": "2025-11-01T00:00:00", "price_per_kwh": "0.1200"},
            {"band": "holiday", "rate_id": "HOLIDAY-OCT", "effective_from": "2025-10-01T00:00:00", "effective_to": "2025-11-01T00:00:00", "price_per_kwh": "0.0800"},
            {"band": "shoulder", "rate_id": "SHOULDER-A", "effective_from": "2025-10-01T00:00:00", "effective_to": "2025-10-20T00:00:00", "price_per_kwh": "0.1800"},
            {"band": "shoulder", "rate_id": "SHOULDER-B", "effective_from": "2025-10-20T00:00:00", "effective_to": "2025-11-01T00:00:00", "price_per_kwh": "0.1900"},
            {"band": "peak", "rate_id": "PEAK-OCT", "effective_from": "2025-10-01T00:00:00", "effective_to": "2025-11-01T00:00:00", "price_per_kwh": "0.3000"},
        ],
        "demand": {
            "rate_id": "DEMAND-OCT",
            "price_per_kw": "12.00",
            "qualifying_bands": ["peak"],
        },
    }


def customer_rows(edge: bool) -> list[dict[str, str]]:
    if edge:
        return [{"customer_id": "C-EDGE", "timezone": "America/New_York", "tax_rate": "0.1000"}]
    return [
        {"customer_id": "C-EAST", "timezone": "America/New_York", "tax_rate": "0.0825"},
        {"customer_id": "C-LONDON", "timezone": "Europe/London", "tax_rate": "0.2000"},
        {"customer_id": "C-PHOENIX", "timezone": "America/Phoenix", "tax_rate": "0.0750"},
    ]


def main_readings(customers: list[dict[str, str]]) -> list[dict[str, str]]:
    rng = random.Random(SEED)
    result: list[dict[str, str]] = []
    first = datetime(2025, 9, 30, tzinfo=timezone.utc)
    stop = datetime(2025, 11, 2, 12, tzinfo=timezone.utc)
    for customer in customers:
        customer_id = customer["customer_id"]
        zone = ZoneInfo(customer["timezone"])
        instant = first
        while instant < stop:
            local = instant.astimezone(zone)
            if local.strftime("%Y-%m") == "2025-10":
                quarter = local.minute // 15
                units = 18 + (local.hour * 3 + quarter * 2 + len(customer_id)) % 25 + rng.randrange(9)
                kwh, kw = f"{units / 100:.2f}", f"{units * 4 / 100:.2f}"
                # Fixed anchors exercise demand, a holiday, and London's repeated DST hour.
                if customer_id == "C-EAST" and local.replace(tzinfo=None) == datetime(2025, 10, 16, 17, 0):
                    kwh, kw = "2.50", "11.75"
                elif customer_id == "C-LONDON" and local.date().isoformat() == "2025-10-26" and local.hour == 1:
                    kwh = "0.80" if local.utcoffset() == timedelta(hours=1) else "0.90"
                    kw = "3.20" if local.utcoffset() == timedelta(hours=1) else "3.60"
                elif customer_id == "C-PHOENIX" and local.replace(tzinfo=None) == datetime(2025, 10, 13, 12, 0):
                    kwh, kw = "1.25", "5.00"
                # Some meters serialize the same instant with a UTC offset rather than
                # the customer's current local offset. The customer timezone is authoritative.
                timestamp = (
                    instant.isoformat(timespec="seconds")
                    if (local.day + local.hour + quarter) % 11 == 0
                    else local.isoformat(timespec="seconds")
                )
                result.append({
                    "customer_id": customer_id,
                    "interval_start": timestamp,
                    "kwh": kwh,
                    "kw": kw,
                })
            instant += timedelta(minutes=15)
    result.sort(key=lambda row: (
        datetime.fromisoformat(row["interval_start"]).astimezone(timezone.utc),
        row["customer_id"],
    ))
    return result


def edge_readings() -> list[dict[str, str]]:
    return [
        {"customer_id": "C-EDGE", "interval_start": "2025-10-15T16:00:00-04:00", "kwh": "1.00", "kw": "4.00"},
        {"customer_id": "C-EDGE", "interval_start": "2025-10-15T16:15:00-04:00", "kwh": "-0.50", "kw": "99.00"},
        {"customer_id": "C-EDGE", "interval_start": "2025-10-15T16:30:00-04:00", "kwh": "0.50", "kw": "6.00"},
    ]


def generate(output: Path, fixture: str) -> None:
    inputs = output / "inputs"
    edge = fixture == "edge"
    customers = customer_rows(edge)
    write_csv(inputs / "customers.csv", ["customer_id", "timezone", "tax_rate"], customers)
    write_csv(
        inputs / "readings.csv",
        ["customer_id", "interval_start", "kwh", "kw"],
        edge_readings() if edge else main_readings(customers),
    )
    (inputs / "tariffs.json").write_text(
        json.dumps(tariffs(), indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    (inputs / "holidays.json").write_text(
        json.dumps({"dates": ["2025-10-13"]}, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    generate(args.output.resolve(), args.fixture)
