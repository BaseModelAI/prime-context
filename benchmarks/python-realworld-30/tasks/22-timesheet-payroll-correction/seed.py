#!/usr/bin/env python3
import argparse
import csv
import json
import random
import shutil
from datetime import date, datetime, timedelta
from pathlib import Path

SEED = 20260831 + 22

def write_csv(path, header, rows):
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(rows)

def seed(workspace, fixture):
    rng = random.Random(SEED)
    if workspace.exists():
        shutil.rmtree(workspace)
    inputs = workspace / "inputs"
    inputs.mkdir(parents=True)
    (workspace / "solution").mkdir()
    (workspace / "output").mkdir()
    rules = {"automatic_break_after_hours": "6", "automatic_break_minutes": 30,
             "weekly_overtime_hours": "40", "overtime_multiplier": "1.5",
             "night_start": "22:00", "night_end": "06:00",
             "night_additive_rate": "0.10", "holiday_additive_rate": "1.00"}
    (inputs / "company_rules.json").write_text(json.dumps(rules, indent=2) + "\n")
    if fixture == "edge":
        write_csv(inputs / "employees.csv",
                  ["employee_id", "name", "group", "hourly_rate", "timezone"],
                  [["E9", "Fallback Tester", "A", "60.00", "America/New_York"]])
        write_csv(inputs / "punches.csv",
                  ["record_id", "employee_id", "shift_id", "kind", "timestamp"],
                  [["D2", "E9", "DST", "OUT", "2025-11-02T02:30:00-05:00"],
                   ["D1", "E9", "DST", "IN", "2025-11-02T00:30:00-04:00"]])
        write_csv(inputs / "holidays.csv", ["date", "name"], [])
        return
    employees = [
        ["E1", "Alex North", "A", "20.00", "America/New_York"],
        ["E2", "Uma Union", "U", "30.00", "America/New_York"],
        ["E3", "Holly Day", "A", "22.00", "America/Chicago"],
        ["E4", "Exception Case", "A", "19.00", "UTC"],
    ]
    for n in range(10, 30):
        employees.append([f"E{n}", f"Filler {n}", "A", f"{rng.randrange(16, 29)}.00", "UTC"])
    punches = []
    record = 1
    def add(emp, shift, kind, stamp):
        nonlocal record
        punches.append([f"R{record:04d}", emp, shift, kind, stamp])
        record += 1
    for day in range(3, 8):
        add("E1", f"E1-{day}", "IN", f"2025-11-{day:02d}T09:00:00-05:00")
        add("E1", f"E1-{day}", "OUT", f"2025-11-{day:02d}T18:00:00-05:00")
    add("E2", "U-LONG", "IN", "2025-11-03T08:00:00-05:00")
    add("E2", "U-LONG", "OUT", "2025-11-03T21:00:00-05:00")
    add("E2", "U-NIGHT", "IN", "2025-11-04T21:00:00-05:00")
    add("E2", "U-NIGHT", "BREAK_START", "2025-11-05T01:00:00-05:00")
    add("E2", "U-NIGHT", "BREAK_END", "2025-11-05T01:30:00-05:00")
    add("E2", "U-NIGHT", "OUT", "2025-11-05T07:00:00-05:00")
    add("E3", "HOLIDAY", "IN", "2025-11-09T20:00:00-06:00")
    add("E3", "HOLIDAY", "OUT", "2025-11-09T22:00:00-06:00")
    add("E4", "BROKEN", "IN", "2025-11-06T09:00:00+00:00")
    for n in range(10, 30):
        day = rng.randrange(3, 8)
        start = rng.randrange(6, 11)
        add(f"E{n}", f"F{n}", "IN", f"2025-11-{day:02d}T{start:02d}:00:00+00:00")
        add(f"E{n}", f"F{n}", "OUT", f"2025-11-{day:02d}T{start+8:02d}:00:00+00:00")
    rng.shuffle(punches)
    write_csv(inputs / "employees.csv", ["employee_id", "name", "group", "hourly_rate", "timezone"], employees)
    write_csv(inputs / "punches.csv", ["record_id", "employee_id", "shift_id", "kind", "timestamp"], punches)
    write_csv(inputs / "holidays.csv", ["date", "name"], [["2025-11-09", "Founders Day"]])

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    seed(args.workspace.resolve(), args.fixture)
