#!/usr/bin/env python3.12
from __future__ import annotations

import argparse
import csv
import json
import random
import shutil
from datetime import datetime, timedelta
from pathlib import Path

SEED = 20260915 + 27
HEADER = ["appointment_id", "patient_id", "provider_id", "type_id", "site_id", "room_id", "start", "priority"]
TYPES = {
    "CONSULT": (30, "general", ""),
    "IMAGING": (30, "imaging", "XRAY"),
    "PROCEDURE": (60, "procedure", "ULTRASOUND"),
}


def csv_write(path: Path, header, rows) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


def iso(day: str, hm: str) -> str:
    return f"{day}T{hm}"


def add_minutes(value: str, minutes: int) -> str:
    return (datetime.fromisoformat(value) + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M")


def common_inputs(inputs: Path) -> None:
    csv_write(inputs / "appointment_types.csv", ["type_id", "duration_minutes", "room_kind", "required_equipment"],
              [[name, duration, kind, equipment] for name, (duration, kind, equipment) in TYPES.items()])
    csv_write(inputs / "providers.csv", ["provider_id", "name"],
              [[f"P{i:03d}", f"Dr. {name}"] for i, name in enumerate(
                  ["Amara Shah", "Liam Chen", "Sofia Ortiz", "Noah Williams", "Mia Brooks",
                   "Ethan Davis", "Ava Wilson", "Lucas Martin", "Isla Thompson", "Leo Garcia"], 1)])
    rooms = []
    equipment = []
    for prefix, site in (("N", "NORTH"), ("S", "SOUTH")):
        for i in range(1, 7):
            rooms.append([f"{prefix}-GEN-{i}", site, "general"])
        for i in range(1, 3):
            room = f"{prefix}-IMG-{i}"
            rooms.append([room, site, "imaging"])
            equipment.append([room, "XRAY"])
        for i in range(1, 3):
            room = f"{prefix}-PROC-{i}"
            rooms.append([room, site, "procedure"])
            equipment.append([room, "ULTRASOUND"])
    csv_write(inputs / "rooms.csv", ["room_id", "site_id", "room_kind"], rooms)
    csv_write(inputs / "room_equipment.csv", ["room_id", "equipment_id"], equipment)
    csv_write(inputs / "travel_buffers.csv", ["from_site", "to_site", "minutes"],
              [["NORTH", "NORTH", 0], ["NORTH", "SOUTH", 30],
               ["SOUTH", "NORTH", 30], ["SOUTH", "SOUTH", 0]])
    (inputs / "settings.json").write_text(json.dumps({"slot_minutes": 30}, indent=2) + "\n", encoding="utf-8")


def seed_main(inputs: Path) -> None:
    day = "2025-09-15"
    appointments = [
        ["A001", "PAT-0001", "P001", "CONSULT", "NORTH", "N-GEN-1", iso(day, "09:00"), 3],
        ["A002", "PAT-0002", "P001", "CONSULT", "NORTH", "N-GEN-1", iso(day, "09:30"), 3],
        ["A003", "PAT-0003", "P002", "CONSULT", "NORTH", "N-GEN-1", iso(day, "10:00"), 1],
        ["A004", "PAT-0004", "P003", "IMAGING", "NORTH", "N-IMG-1", iso(day, "14:00"), 4],
        ["A005", "PAT-0005", "P004", "IMAGING", "NORTH", "N-IMG-2", iso(day, "14:00"), 7],
        ["A006", "PAT-0006", "P003", "CONSULT", "SOUTH", "S-GEN-1", iso(day, "13:00"), 2],
        ["A007", "PAT-0007", "P001", "CONSULT", "NORTH", "N-GEN-2", iso(day, "10:00"), 8],
    ]
    windows = [
        ["PAT-0001", iso(day, "09:00"), iso(day, "09:30")],
        ["PAT-0002", iso(day, "09:30"), iso(day, "10:00")],
        ["PAT-0003", iso(day, "10:00"), iso(day, "11:00")],
        ["PAT-0004", iso(day, "14:00"), iso(day, "15:00")],
        ["PAT-0005", iso(day, "14:00"), iso(day, "14:30")],
        ["PAT-0006", iso(day, "13:00"), iso(day, "13:30")],
        ["PAT-0007", iso(day, "10:00"), iso(day, "10:30")],
    ]
    availability = [
        ["P001", "NORTH", iso(day, "08:00"), iso(day, "11:00")],
        ["P002", "NORTH", iso(day, "08:00"), iso(day, "12:00")],
        ["P003", "SOUTH", iso(day, "13:00"), iso(day, "13:30")],
        ["P003", "NORTH", iso(day, "14:00"), iso(day, "15:00")],
        ["P004", "NORTH", iso(day, "14:00"), iso(day, "14:30")],
    ]
    locked = {"A005", "A007"}
    rng = random.Random(SEED)
    occupancy = {}
    next_id = 8
    days = ["2025-09-16", "2025-09-17", "2025-09-18", "2025-09-19"]
    starts = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00"]
    for day_index, date in enumerate(days):
        for provider_index in range(1, 11):
            site = "NORTH" if (provider_index + day_index) % 2 == 0 else "SOUTH"
            availability.append([f"P{provider_index:03d}", site, iso(date, "08:00"), iso(date, "16:30")])
        for slot_index, hm in enumerate(starts):
            for provider_index in range(1, 11):
                if next_id > 250:
                    break
                site = "NORTH" if (provider_index + day_index) % 2 == 0 else "SOUTH"
                marker = next_id + provider_index + slot_index
                wanted = "PROCEDURE" if marker % 17 == 0 else "IMAGING" if marker % 7 == 0 else "CONSULT"
                duration, room_kind, _ = TYPES[wanted]
                prefix = "N" if site == "NORTH" else "S"
                room_ids = ([f"{prefix}-GEN-{i}" for i in range(1, 7)] if room_kind == "general" else
                            (["N-IMG-2"] if site == "NORTH" else ["S-IMG-1", "S-IMG-2"]) if room_kind == "imaging" else
                            [f"{prefix}-PROC-{i}" for i in range(1, 3)])
                start = iso(date, hm)
                end = add_minutes(start, duration)
                room = None
                for candidate in room_ids:
                    if all(end <= a or start >= b for a, b in occupancy.get(candidate, [])):
                        room = candidate
                        break
                if room is None:
                    wanted = "CONSULT"
                    duration = 30
                    room_ids = [f"{prefix}-GEN-{i}" for i in range(1, 7)]
                    end = add_minutes(start, duration)
                    room = next(candidate for candidate in room_ids
                                if all(end <= a or start >= b for a, b in occupancy.get(candidate, [])))
                occupancy.setdefault(room, []).append((start, end))
                aid = f"A{next_id:03d}"
                patient = f"PAT-{next_id:04d}"
                priority = 1 + rng.randrange(5)
                appointments.append([aid, patient, f"P{provider_index:03d}", wanted, site, room, start, priority])
                windows.append([patient, add_minutes(start, -30), add_minutes(end, 30)])
                if next_id % 29 == 0:
                    locked.add(aid)
                next_id += 1
            if next_id > 250:
                break
        if next_id > 250:
            break
    assert len(appointments) == 250
    csv_write(inputs / "appointments.csv", HEADER, appointments)
    csv_write(inputs / "patient_windows.csv", ["patient_id", "start", "end"], windows)
    csv_write(inputs / "provider_availability.csv", ["provider_id", "site_id", "start", "end"], availability)
    csv_write(inputs / "locked_appointments.csv", ["appointment_id"], [[x] for x in sorted(locked)])


def seed_edge(inputs: Path) -> None:
    day = "2025-09-15"
    csv_write(inputs / "appointments.csv", HEADER,
              [["E001", "EDGE-LOCKED", "P001", "CONSULT", "NORTH", "N-GEN-1", iso(day, "10:00"), 9]])
    csv_write(inputs / "patient_windows.csv", ["patient_id", "start", "end"],
              [["EDGE-LOCKED", iso(day, "10:00"), iso(day, "10:30")],
               ["EDGE-URG", iso(day, "10:00"), iso(day, "10:30")]])
    csv_write(inputs / "provider_availability.csv", ["provider_id", "site_id", "start", "end"],
              [["P001", "NORTH", iso(day, "10:00"), iso(day, "10:30")]])
    csv_write(inputs / "locked_appointments.csv", ["appointment_id"], [["E001"]])


def seed(root: Path, fixture: str) -> None:
    if root.exists():
        shutil.rmtree(root)
    inputs = root / "inputs"
    inputs.mkdir(parents=True)
    (root / "output").mkdir()
    common_inputs(inputs)
    if fixture == "main":
        seed_main(inputs)
    else:
        seed_edge(inputs)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--workspace", required=True, type=Path)
    p.add_argument("--fixture", required=True, choices=("main", "edge"))
    a = p.parse_args()
    seed(a.workspace, a.fixture)


if __name__ == "__main__":
    main()
