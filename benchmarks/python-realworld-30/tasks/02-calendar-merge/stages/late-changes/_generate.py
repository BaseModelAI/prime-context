#!/usr/bin/env python3
"""Runner-side deterministic late-change fixture for Task 02."""
from __future__ import annotations

import argparse
import random
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
    summary: str,
    location: str,
    status: str | None = None,
) -> list[str]:
    lines = ["BEGIN:VEVENT", f"UID:{uid}", f"SEQUENCE:{sequence}"]
    if status is not None:
        lines.append(f"STATUS:{status}")
    lines.extend(
        (
            f"{start_name}:{start_value}",
            f"{end_name}:{end_value}",
            f"SUMMARY:{summary}",
            f"LOCATION:{location}",
            "END:VEVENT",
        )
    )
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), default="main")
    args = parser.parse_args()
    random.Random(SEED).getstate()
    if args.fixture == "edge":
        return

    changes = [
        event(
            "event-alpha",
            5,
            "DTSTART",
            "20250310T140000Z",
            "DTEND",
            "20250310T150000Z",
            "Alpha review cancelled",
            "Room A",
            "cancelled",
        ),
        event(
            "filler-005",
            9,
            "DTSTART",
            "20250605T180000Z",
            "DTEND",
            "20250605T190000Z",
            "Supplier call cancelled",
            "Video",
            "CANCELLED",
        ),
        event(
            "room-change",
            4,
            "DTSTART",
            "20250401T150000Z",
            "DTEND",
            "20250401T160000Z",
            "Planning room assignment",
            "Room C",
        ),
        event(
            "dst-span",
            0,
            "DTSTART;TZID=America/New_York",
            "20251102T003000",
            "DTEND;TZID=America/New_York",
            "20251102T033000",
            "Daylight-saving coverage",
            "Operations",
        ),
    ]
    path = Path(args.output) / "inputs" / "late_changes.ics"
    write_calendar(path, "America/New_York", changes)


if __name__ == "__main__":
    main()
