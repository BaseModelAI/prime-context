#!/usr/bin/env python3
"""Generate Task 06 volunteers, availability, shifts, and travel times."""
from __future__ import annotations

import argparse
import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

SEED = 20260831 + 6


def write(path: Path, header: list[str], rows: list[list[object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    inputs = args.output / "inputs"
    rng = random.Random(SEED)
    rng.getstate()
    if args.fixture == "edge":
        write(inputs / "volunteers.csv", ["volunteer_id", "skills", "preferred_locations", "max_shifts"], [["EDGE-V1", "first_aid", "EDGE-LOC", 2]])
        write(inputs / "availability.csv", ["volunteer_id", "start", "end"], [["EDGE-V1", "2025-06-01T00:00", "2025-06-02T00:00"]])
        write(inputs / "shifts.csv", ["shift_id", "start", "end", "location", "required_skill", "seats"], [["EDGE-S1", "2025-06-01T09:00", "2025-06-01T11:00", "EDGE-LOC", "water_rescue", 1]])
        write(inputs / "travel_times.csv", ["from_location", "to_location", "minutes"], [])
        return
    volunteers = []
    for number in range(1, 25):
        volunteer = f"V{number:02d}"
        skill = "medical" if number <= 12 else "logistics"
        volunteers.append([volunteer, skill, f"LOC-{volunteer}", 3])
    write(inputs / "volunteers.csv", ["volunteer_id", "skills", "preferred_locations", "max_shifts"], volunteers)
    intended = list(range(1, 7)) * 2 + list(range(7, 13))
    intended += list(range(13, 19)) * 2 + list(range(19, 25))
    backups = {"V01": ("V07", "V08"), "V13": ("V19", "V20")}
    shifts = []
    availability = []
    origin = datetime(2025, 6, 1, 9)
    for index, volunteer_number in enumerate(intended, 1):
        group_index = index - 1 if index <= 18 else index - 19
        start = origin + timedelta(days=group_index, hours=0 if index <= 18 else 4)
        end = start + timedelta(hours=2)
        start_text = start.isoformat(timespec="minutes")
        end_text = end.isoformat(timespec="minutes")
        volunteer = f"V{volunteer_number:02d}"
        shifts.append([f"S{index:02d}", start_text, end_text, f"LOC-{volunteer}", "medical" if index <= 18 else "logistics", 1])
        for available_id in (volunteer, *backups.get(volunteer, ())):
            availability.append([available_id, start_text, end_text])
    write(inputs / "availability.csv", ["volunteer_id", "start", "end"], availability)
    write(inputs / "shifts.csv", ["shift_id", "start", "end", "location", "required_skill", "seats"], shifts)
    travel = []
    locations = [f"LOC-V{number:02d}" for number in range(1, 25)]
    for source in locations:
        for target in locations:
            if source != target:
                travel.append([source, target, 45 + rng.randrange(6)])
    write(inputs / "travel_times.csv", ["from_location", "to_location", "minutes"], travel)


if __name__ == "__main__":
    main()
