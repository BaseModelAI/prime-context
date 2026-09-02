#!/usr/bin/env python3
"""Generate Task 07 main or edge inputs."""
from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path

SEED = 20260831 + 7


def add_month(year: int, month: int, offset: int) -> str:
    index = year * 12 + month - 1 + offset
    return f"{index // 12:04d}-{index % 12 + 1:02d}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    inputs = args.output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    rows: list[tuple[str, str, str]] = []
    if args.fixture == "edge":
        for offset in range(6):
            rows.append(("EDGE-MAD-0", add_month(2025, 1, offset), "100.000000"))
        rows.append(("EDGE-MAD-0", "2025-07", "130.000000"))
    else:
        rng = random.Random(SEED)
        missing = {
            "METER-0007": {9},
            "METER-0019": {4, 21},
            "METER-0033": {16},
            "METER-&<50>": {12},
        }
        spikes = {
            ("METER-0003", 8): 2,
            ("METER-0012", 18): 2,
            ("METER-0028", 23): -1,
            ("METER-&<50>", 27): 2,
        }
        ids = [f"METER-{number:04d}" for number in range(1, 50)] + ["METER-&<50>"]
        for number, meter_id in enumerate(ids, 1):
            baseline = 90 + number * 3
            phase = rng.randrange(7)
            for offset in range(30):
                if offset in missing.get(meter_id, set()):
                    continue
                value = baseline + ((offset + phase) % 7 - 3)
                kind = spikes.get((meter_id, offset))
                if kind == 2:
                    value = baseline * 2
                elif kind == -1:
                    value = baseline // 2
                rows.append((meter_id, add_month(2023, 1, offset), f"{value}.000000"))
    with (inputs / "monthly_usage.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["meter_id", "month", "kwh"])
        writer.writerows(rows)


if __name__ == "__main__":
    main()
