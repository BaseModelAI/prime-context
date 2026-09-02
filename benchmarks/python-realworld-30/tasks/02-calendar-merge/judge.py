#!/usr/bin/env python3
"""Direct clean-fixture judge for Task 02."""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

TASK_DIR = Path(__file__).resolve().parent
SEED = 20260831 + 2
COMMAND = [sys.executable, "-E", "-S", "-m", "solution.calendar_merge", "inputs/calendars", "output/merged.ics", "output/conflicts.csv"]
STAMP = re.compile(r"^[0-9]{8}T[0-9]{6}Z$")


class ParseError(ValueError):
    pass


@dataclass(frozen=True)
class Event:
    uid: str
    sequence: int
    start: str
    end: str
    summary: str
    location: str | None
    start_head: str
    end_head: str


@dataclass
class Snapshot:
    returncode: int | None
    events: list[Event] | None
    pairs: list[tuple[str, str]] | None
    crlf: bool
    error: str | None

    @property
    def structured(self) -> bool:
        return self.events is not None and self.pairs is not None

    @property
    def ok(self) -> bool:
        return self.returncode == 0 and self.structured


def unfold(data: bytes) -> list[str]:
    try:
        physical = data.decode("utf-8").splitlines()
    except UnicodeDecodeError as exc:
        raise ParseError("merged.ics is not UTF-8") from exc
    logical: list[str] = []
    for line in physical:
        if line.startswith((" ", "\t")):
            if not logical:
                raise ParseError("orphan folded line")
            logical[-1] += line[1:]
        else:
            logical.append(line)
    return logical


def one(properties: dict[str, list[tuple[str, str]]], name: str, *, optional: bool = False) -> tuple[str, str] | None:
    values = properties.get(name, [])
    if optional and not values:
        return None
    if len(values) != 1:
        raise ParseError(f"VEVENT must contain exactly one {name}")
    return values[0]


def parse_calendar(path: Path) -> tuple[list[Event], bool]:
    data = path.read_bytes()
    stripped = data.replace(b"\r\n", b"")
    crlf = bool(data) and data.endswith(b"\r\n") and b"\r" not in stripped and b"\n" not in stripped
    lines = unfold(data)
    if not lines or lines[0].upper() != "BEGIN:VCALENDAR" or lines[-1].upper() != "END:VCALENDAR":
        raise ParseError("merged.ics is not a VCALENDAR")
    if not any(line.upper() == "VERSION:2.0" for line in lines[1:-1]):
        raise ParseError("VCALENDAR lacks VERSION:2.0")

    events: list[Event] = []
    current: dict[str, list[tuple[str, str]]] | None = None
    for line in lines[1:-1]:
        upper = line.upper()
        if upper == "BEGIN:VEVENT":
            if current is not None:
                raise ParseError("nested VEVENT")
            current = {}
            continue
        if upper == "END:VEVENT":
            if current is None:
                raise ParseError("unmatched END:VEVENT")
            uid = one(current, "UID")
            sequence = one(current, "SEQUENCE")
            start = one(current, "DTSTART")
            end = one(current, "DTEND")
            summary = one(current, "SUMMARY")
            location = one(current, "LOCATION", optional=True)
            assert uid and sequence and start and end and summary
            try:
                sequence_number = int(sequence[1])
            except ValueError as exc:
                raise ParseError("SEQUENCE is not decimal") from exc
            events.append(
                Event(
                    uid=uid[1],
                    sequence=sequence_number,
                    start=start[1],
                    end=end[1],
                    summary=summary[1],
                    location=None if location is None else location[1],
                    start_head=start[0],
                    end_head=end[0],
                )
            )
            current = None
            continue
        if current is not None:
            if ":" not in line:
                raise ParseError("malformed VEVENT property")
            head, value = line.split(":", 1)
            name = head.split(";", 1)[0].upper()
            current.setdefault(name, []).append((head, value))
    if current is not None:
        raise ParseError("unterminated VEVENT")
    return events, crlf


def parse_conflicts(path: Path) -> list[tuple[str, str]]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise ParseError("conflicts.csv is not UTF-8") from exc
    rows = list(csv.reader(io.StringIO(text, newline="")))
    if not rows or rows[0] != ["uid_a", "uid_b"]:
        raise ParseError("conflicts.csv has the wrong header")
    if any(len(row) != 2 for row in rows[1:]):
        raise ParseError("conflicts.csv has a malformed row")
    return [(row[0], row[1]) for row in rows[1:]]


def run_script(path: Path, *arguments: str) -> None:
    completed = subprocess.run(
        [sys.executable, str(path), *arguments],
        cwd=TASK_DIR,
        text=True,
        capture_output=True,
        timeout=30,
    )
    if completed.returncode:
        detail = completed.stderr.strip().splitlines()
        raise RuntimeError(f"{path.name} failed" + (f": {detail[-1][:200]}" if detail else ""))


def seed_case(case: Path, fixture: str, source_solution: Path) -> None:
    run_script(TASK_DIR / "seed.py", "--workspace", str(case), "--fixture", fixture)
    run_script(TASK_DIR / "visible" / "_generate.py", "--output", str(case), "--fixture", fixture)
    if source_solution.is_dir():
        shutil.copytree(source_solution, case / "solution", dirs_exist_ok=True)


def inject_late(case: Path) -> None:
    run_script(TASK_DIR / "stages" / "late-changes" / "_generate.py", "--output", str(case), "--fixture", "main")


def candidate_imports(case: Path) -> bool:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(case)
    try:
        completed = subprocess.run(
            [sys.executable, "-E", "-S", "-c", "import solution.calendar_merge"],
            cwd=case,
            env=env,
            text=True,
            capture_output=True,
            timeout=10,
        )
    except subprocess.TimeoutExpired:
        return False
    return completed.returncode == 0


def run_candidate(case: Path) -> Snapshot:
    shutil.rmtree(case / "output", ignore_errors=True)
    env = os.environ.copy()
    env["PYTHONPATH"] = str(case)
    try:
        completed = subprocess.run(
            COMMAND,
            cwd=case,
            env=env,
            text=True,
            capture_output=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        return Snapshot(None, None, None, False, "candidate command timed out")

    events: list[Event] | None = None
    pairs: list[tuple[str, str]] | None = None
    crlf = False
    error: str | None = None
    try:
        events, crlf = parse_calendar(case / "output" / "merged.ics")
        pairs = parse_conflicts(case / "output" / "conflicts.csv")
    except (OSError, ParseError, csv.Error) as exc:
        error = str(exc)
    if completed.returncode and error is None:
        stderr = completed.stderr.strip().splitlines()
        error = f"candidate exited {completed.returncode}" + (f": {stderr[-1][:200]}" if stderr else "")
    return Snapshot(completed.returncode, events, pairs, crlf, error)


def record(uid: str, sequence: int, start: str, end: str, summary: str, location: str | None) -> Event:
    return Event(uid, sequence, start, end, summary, location, "DTSTART", "DTEND")


def expected_main() -> tuple[dict[str, Event], dict[str, Event]]:
    rng = random.Random(SEED)
    summaries = ("Desk review", "Project update", "Supplier call", "Weekly notes")
    locations = ("Room 1", "Room 2", "North desk", "Video")
    first = datetime(2025, 6, 1, 18, 0)
    initial: dict[str, Event] = {}
    for number in range(1, 81):
        start_time = first + timedelta(days=number - 1)
        end_time = start_time + timedelta(minutes=30 + 15 * rng.randrange(3))
        sequence = rng.randrange(3)
        summary = f"{rng.choice(summaries)} {number:03d}"
        location = rng.choice(locations)
        uid = f"filler-{number:03d}"
        initial[uid] = record(
            uid,
            sequence,
            start_time.strftime("%Y%m%dT%H%M%SZ"),
            end_time.strftime("%Y%m%dT%H%M%SZ"),
            summary,
            location,
        )
    anchors = [
        record("all-day", 0, "20250310T040000Z", "20250311T040000Z", "Office open day", "Main campus"),
        record("event-alpha", 1, "20250310T140000Z", "20250310T150000Z", "Alpha review", "Room A"),
        record("event-bravo", 0, "20250310T143000Z", "20250310T153000Z", "Bravo review", "Room B"),
        record("event-charlie", 0, "20250310T130000Z", "20250310T140000Z", "New York check-in", "Video"),
        record("event-local", 0, "20250310T160000Z", "20250310T163000Z", "Local default event with a deliberately folded continuation", "London desk"),
        record("room-change", 3, "20250401T150000Z", "20250401T160000Z", "Planning room assignment", "Room B"),
        record("night-watch", 0, "20251102T060000Z", "20251102T070000Z", "Overnight coverage", "Operations"),
    ]
    initial.update((item.uid, item) for item in anchors)

    late = dict(initial)
    del late["event-alpha"]
    del late["filler-005"]
    late["room-change"] = record("room-change", 4, "20250401T150000Z", "20250401T160000Z", "Planning room assignment", "Room C")
    late["dst-span"] = record("dst-span", 0, "20251102T043000Z", "20251102T083000Z", "Daylight-saving coverage", "Operations")
    return initial, late


def event_map(snapshot: Snapshot) -> dict[str, Event]:
    if snapshot.events is None:
        return {}
    return {item.uid: item for item in snapshot.events}


def fields_match(actual: dict[str, Event], expected: dict[str, Event], fields: tuple[str, ...]) -> bool:
    if set(actual) != set(expected):
        return False
    return all(all(getattr(actual[uid], field) == getattr(wanted, field) for field in fields) for uid, wanted in expected.items())


def canonical_and_ordered(snapshot: Snapshot, expected: dict[str, Event]) -> bool:
    if not snapshot.ok or snapshot.events is None or not snapshot.crlf:
        return False
    actual = event_map(snapshot)
    if len(snapshot.events) != len(expected) or not fields_match(actual, expected, ("start", "end")):
        return False
    if any(
        item.start_head.upper() != "DTSTART"
        or item.end_head.upper() != "DTEND"
        or not STAMP.fullmatch(item.start)
        or not STAMP.fullmatch(item.end)
        for item in snapshot.events
    ):
        return False
    keys = [(item.start, item.uid) for item in snapshot.events]
    return keys == sorted(keys)


def expected_conflicts(events: dict[str, Event]) -> list[tuple[str, str]]:
    uids = sorted(events)
    return [
        (uid_a, uid_b)
        for index, uid_a in enumerate(uids)
        for uid_b in uids[index + 1 :]
        if events[uid_a].start < events[uid_b].end and events[uid_b].start < events[uid_a].end
    ]


def evaluate(workspace: Path) -> dict[str, object]:
    source_solution = workspace / "solution"
    expected_initial, expected_late = expected_main()
    notes: list[str] = []

    with tempfile.TemporaryDirectory(prefix="calendar-main-") as directory:
        case = Path(directory)
        seed_case(case, "main", source_solution)
        importable = candidate_imports(case)
        initial = run_candidate(case)
        inject_late(case)
        late = run_candidate(case)

    initial_map = event_map(initial)
    late_map = event_map(late)
    check_properties = (
        initial.ok
        and late.ok
        and fields_match(initial_map, expected_initial, ("summary", "location"))
        and fields_match(late_map, expected_late, ("summary", "location"))
        and initial_map.get("event-charlie", record("", 0, "", "", "", None)).start == "20250310T130000Z"
        and initial_map.get("event-local", record("", 0, "", "", "", None)).summary == "Local default event with a deliberately folded continuation"
        and late_map.get("dst-span", record("", 0, "", "", "", None)).end == "20251102T083000Z"
    )
    check_winners = (
        initial.ok
        and late.ok
        and fields_match(initial_map, expected_initial, ("sequence",))
        and fields_match(late_map, expected_late, ("sequence",))
        and initial_map.get("room-change", record("", 0, "", "", "", None)).location == "Room B"
        and late_map.get("room-change", record("", 0, "", "", "", None)).location == "Room C"
        and "remove-me" not in initial_map
        and "event-alpha" not in late_map
        and "filler-005" not in late_map
    )
    check_canonical = canonical_and_ordered(initial, expected_initial) and canonical_and_ordered(late, expected_late)
    check_conflicts = (
        initial.ok
        and late.ok
        and initial.pairs == expected_conflicts(expected_initial)
        and late.pairs == expected_conflicts(expected_late)
    )
    all_day_initial = initial_map.get("all-day")
    all_day_late = late_map.get("all-day")
    check_all_day = (
        initial.ok
        and late.ok
        and all_day_initial is not None
        and all_day_late is not None
        and (all_day_initial.start, all_day_initial.end) == ("20250310T040000Z", "20250311T040000Z")
        and (all_day_late.start, all_day_late.end) == ("20250310T040000Z", "20250311T040000Z")
    )

    checks = [check_properties, check_winners, check_canonical, check_conflicts, check_all_day]
    labels = [
        "unfolding/property parsing",
        "highest sequence/cancellations",
        "UTC ordering/CRLF",
        "exact conflict pairs",
        "all-day boundaries",
    ]
    for passed, label in zip(checks, labels):
        if not passed:
            notes.append(f"main check failed: {label}")
    for label, snapshot in (("initial", initial), ("late", late)):
        if snapshot.error:
            notes.append(f"{label} run: {snapshot.error[:240]}")

    edge_check = False
    with tempfile.TemporaryDirectory(prefix="calendar-edge-") as directory:
        edge_case = Path(directory)
        seed_case(edge_case, "edge", source_solution)
        edge = run_candidate(edge_case)
    edge_map = event_map(edge)
    edge_expected = {
        "edge-folded": record("edge-folded", 0, "20300115T100000Z", "20300115T110000Z", "Quarterly planning details continue here", "Edge room"),
        "edge-touching": record("edge-touching", 0, "20300115T110000Z", "20300115T120000Z", "Starts at the prior endpoint", "Edge room"),
    }
    edge_check = (
        edge.ok
        and edge.crlf
        and fields_match(edge_map, edge_expected, ("sequence", "start", "end", "summary", "location"))
        and edge.pairs == []
        and edge.events is not None
        and len(edge.events) == len(edge_expected)
        and [(item.start, item.uid) for item in edge.events] == sorted((item.start, item.uid) for item in edge.events)
    )
    if not edge_check:
        notes.append("edge check failed: folded summary or touching-endpoint behavior")
        if edge.error:
            notes.append(f"edge run: {edge.error[:240]}")

    main_passed = sum(checks)
    initial_core = (
        initial.ok
        and canonical_and_ordered(initial, expected_initial)
        and fields_match(
            initial_map,
            expected_initial,
            ("sequence", "start", "end", "summary", "location"),
        )
        and initial.pairs == expected_conflicts(expected_initial)
    )
    if main_passed == 5:
        progress = 5 if edge_check else 4
    elif initial_core or main_passed >= 2:
        progress = 3
    elif initial.ok or late.ok:
        progress = 2
    elif importable or initial.returncode == 0:
        progress = 1
    else:
        progress = 0
    return {
        "status": "pass" if progress == 5 else "fail",
        "progress_level": progress,
        "main_checks_passed": main_passed,
        "main_checks_total": 5,
        "edge_check_passed": edge_check,
        "notes": notes,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = evaluate(args.workspace.resolve())
    except Exception as exc:  # Keep the judge contract even for fixture/setup errors.
        result = {
            "status": "fail",
            "progress_level": 0,
            "main_checks_passed": 0,
            "main_checks_total": 5,
            "edge_check_passed": False,
            "notes": [f"judge error: {type(exc).__name__}: {str(exc)[:300]}"],
        }
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
