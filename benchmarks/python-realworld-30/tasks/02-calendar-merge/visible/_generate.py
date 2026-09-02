#!/usr/bin/env python3
"""Runner-side deterministic initial fixtures for Task 02."""
from __future__ import annotations

import argparse
import random
import shutil
from datetime import datetime, timedelta
from pathlib import Path

SEED = 20260831 + 2
CRLF = "\r\n"


def event(
    uid: str,
    sequence: int,
    start_name: str,
    start_value: str,
    end_name: str,
    end_value: str,
    summary: str | tuple[str, str],
    location: str | None = None,
    status: str | None = None,
) -> list[str]:
    lines = ["BEGIN:VEVENT", f"UID:{uid}", f"SEQUENCE:{sequence}"]
    if status is not None:
        lines.append(f"STATUS:{status}")
    lines.extend((f"{start_name}:{start_value}", f"{end_name}:{end_value}"))
    if isinstance(summary, tuple):
        lines.extend((f"SUMMARY:{summary[0]}", f" {summary[1]}"))
    else:
        lines.append(f"SUMMARY:{summary}")
    if location is not None:
        lines.append(f"LOCATION:{location}")
    lines.append("END:VEVENT")
    return lines


def write_calendar(path: Path, timezone: str, events: list[list[str]]) -> None:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Prime Context//Calendar Fixture//EN",
        f"X-WR-TIMEZONE:{timezone}",
    ]
    for item in events:
        lines.extend(item)
    lines.append("END:VCALENDAR")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((CRLF.join(lines) + CRLF).encode("utf-8"))


def filler_events(rng: random.Random) -> list[list[str]]:
    summaries = ("Desk review", "Project update", "Supplier call", "Weekly notes")
    locations = ("Room 1", "Room 2", "North desk", "Video")
    first = datetime(2025, 6, 1, 18, 0)
    rows: list[list[str]] = []
    for number in range(1, 81):
        start = first + timedelta(days=number - 1)
        end = start + timedelta(minutes=30 + 15 * rng.randrange(3))
        rows.append(
            event(
                f"filler-{number:03d}",
                rng.randrange(3),
                "DTSTART",
                start.strftime("%Y%m%dT%H%M%SZ"),
                "DTEND",
                end.strftime("%Y%m%dT%H%M%SZ"),
                f"{rng.choice(summaries)} {number:03d}",
                rng.choice(locations),
            )
        )
    return rows


def main_fixture(output: Path, rng: random.Random) -> None:
    calendars = output / "inputs" / "calendars"
    if calendars.exists():
        shutil.rmtree(calendars)
    calendars.mkdir(parents=True)
    late = output / "inputs" / "late_changes.ics"
    if late.exists():
        late.unlink()

    fillers = filler_events(rng)
    team = [
        event(
            "all-day",
            0,
            "DTSTART;VALUE=DATE",
            "20250310",
            "DTEND;VALUE=DATE",
            "20250311",
            "Office open day",
            "Main campus",
        ),
        event(
            "event-alpha",
            1,
            "DTSTART",
            "20250310T140000Z",
            "DTEND",
            "20250310T150000Z",
            "Alpha review",
            "Room A",
            "CONFIRMED",
        ),
        event(
            "room-change",
            1,
            "DTSTART",
            "20250401T150000Z",
            "DTEND",
            "20250401T160000Z",
            "Planning room assignment",
            "Room A",
        ),
        *fillers[:27],
    ]
    rooms = [
        event(
            "event-bravo",
            0,
            "DTSTART",
            "20250310T143000Z",
            "DTEND",
            "20250310T153000Z",
            "Bravo review",
            "Room B",
        ),
        event(
            "event-charlie",
            0,
            "dtstart;tzid=America/New_York",
            "20250310T090000",
            "DtEnD;TzId=America/New_York",
            "20250310T100000",
            "New York check-in",
            "Video",
        ),
        event(
            "room-change",
            3,
            "DTSTART",
            "20250401T150000Z",
            "DTEND",
            "20250401T160000Z",
            "Planning room assignment",
            "Room B",
        ),
        *fillers[27:54],
    ]
    personal = [
        event(
            "event-local",
            0,
            "DTSTART",
            "20250310T160000",
            "DTEND",
            "20250310T163000",
            ("Local default event with a deliberately folded ", "continuation"),
            "London desk",
        ),
        event(
            "remove-me",
            0,
            "DTSTART",
            "20250402T120000Z",
            "DTEND",
            "20250402T123000Z",
            "Old appointment",
            "Room X",
        ),
        event(
            "remove-me",
            2,
            "DTSTART",
            "20250402T120000Z",
            "DTEND",
            "20250402T123000Z",
            "Cancelled appointment",
            "Room X",
            "CANCELLED",
        ),
        event(
            "night-watch",
            0,
            "DTSTART",
            "20251102T060000Z",
            "DTEND",
            "20251102T070000Z",
            "Overnight coverage",
            "Operations",
        ),
        *fillers[54:],
    ]
    assert len(team) == len(rooms) == len(personal) == 30
    write_calendar(calendars / "01-team.ics", "America/New_York", team)
    write_calendar(calendars / "02-rooms.ics", "America/Los_Angeles", rooms)
    write_calendar(calendars / "03-personal.ics", "Europe/London", personal)
    assert sum(path.read_bytes().count(b"BEGIN:VEVENT") for path in calendars.glob("*.ics")) == 90


def edge_fixture(output: Path) -> None:
    calendars = output / "inputs" / "calendars"
    if calendars.exists():
        shutil.rmtree(calendars)
    calendars.mkdir(parents=True)
    late = output / "inputs" / "late_changes.ics"
    if late.exists():
        late.unlink()
    events = [
        event(
            "edge-folded",
            0,
            "DTSTART",
            "20300115T100000Z",
            "DTEND",
            "20300115T110000Z",
            ("Quarterly planning details ", "continue here"),
            "Edge room",
        ),
        event(
            "edge-touching",
            0,
            "DTSTART",
            "20300115T110000Z",
            "DTEND",
            "20300115T120000Z",
            "Starts at the prior endpoint",
            "Edge room",
        ),
    ]
    write_calendar(calendars / "edge.ics", "UTC", events)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), default="main")
    args = parser.parse_args()
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)
    if args.fixture == "main":
        main_fixture(output, rng)
    else:
        # Instantiate the required fixed RNG for every fixture path.
        rng.getstate()
        edge_fixture(output)


if __name__ == "__main__":
    main()
