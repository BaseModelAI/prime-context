#!/usr/bin/env python3
"""Generate the deterministic Task 09 JSONL fixture."""
from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

SEED = 20260831 + 9
TARGETS = {
    "P1": {"first_response_minutes": 15, "resolution_minutes": 240},
    "P2": {"first_response_minutes": 60, "resolution_minutes": 480},
    "P3": {"first_response_minutes": 240, "resolution_minutes": 1440},
}


def stamp(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def event(event_id: str, ticket_id: str, when: datetime, kind: str, priority: str | None = None) -> dict[str, object]:
    value: dict[str, object] = {"event_id": event_id, "ticket_id": ticket_id, "timestamp": stamp(when), "type": kind, "source": "support-export-primary"}
    if priority is not None:
        value["priority"] = priority
    return value


def edge_rows() -> list[dict[str, object]]:
    base = datetime(2025, 1, 1, tzinfo=timezone.utc)
    ticket = "EDGE-OOO"
    return [
        event("E5", ticket, base + timedelta(minutes=120), "resolved"),
        event("E3", ticket, base + timedelta(minutes=20), "waiting_customer"),
        event("E1", ticket, base, "created", "P1"),
        event("E4", ticket, base + timedelta(minutes=50), "customer_reply"),
        event("E2", ticket, base + timedelta(minutes=10), "agent_reply"),
        event("E2", ticket, base + timedelta(minutes=90), "agent_reply"),
        event("E0", ticket, base + timedelta(minutes=5), "bot_reply"),
    ]


def main_rows():
    rng = random.Random(SEED)
    origin = datetime(2024, 1, 1, tzinfo=timezone.utc)
    for batch in range(2500):
        events: list[dict[str, object]] = []
        batch_base = origin + timedelta(minutes=batch * 300)
        for slot in range(10):
            number = batch * 10 + slot + 1
            ticket = f"T-{number:05d}"
            priority = ("P1", "P2", "P3")[(number - 1) % 3]
            created = batch_base + timedelta(seconds=slot)
            response = {"P1": 10, "P2": 45, "P3": 180}[priority] + (80 if number % 11 == 0 else 0)
            resolution = {"P1": 220, "P2": 430, "P3": 1300}[priority] + (300 if number % 13 == 0 else 0)
            waiting_start = 60
            waiting_end = 90
            kinds = [
                ("01", 0, "created", priority),
                ("02", 5, "bot_reply", None),
                ("03", response, "agent_reply", None),
                ("04", waiting_start, "waiting_customer", None),
                ("05", waiting_end, "customer_reply", None),
                ("06", resolution - 50, "resolved", None),
            ]
            if number % 7 == 0:
                kinds.extend([("07", resolution - 25, "reopened", None), ("08", resolution, "resolved", None)])
            else:
                kinds.extend([("07", 120, "waiting_customer", None), ("08", 140, "customer_reply", None)])
            for suffix, minute, kind, item_priority in kinds:
                events.append(event(f"EV-{number:05d}-{suffix}", ticket, created + timedelta(minutes=minute), kind, item_priority))
        for item in events:
            item["source"] = ("support-export-primary", "support-export-backfill")[rng.randrange(2)]
        events.sort(key=lambda item: (item["timestamp"], str(item["event_id"])))
        yield from events


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    inputs = args.output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    (inputs / "sla.json").write_text(json.dumps(TARGETS, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    rows = edge_rows() if args.fixture == "edge" else main_rows()
    with (inputs / "events.jsonl").open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
