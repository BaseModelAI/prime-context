#!/usr/bin/env python3.12
"""Create the deterministic initial version-1 workspace for Task 30."""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path
import random
import shutil
import sqlite3

SEED = 20260831 + 30

SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE schema_version(version INTEGER NOT NULL);
INSERT INTO schema_version(version) VALUES (1);
CREATE TABLE agents(
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
);
CREATE TABLE tickets(
    id INTEGER PRIMARY KEY,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    assignee_id INTEGER REFERENCES agents(id),
    requester_email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE comments(
    id INTEGER PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    author_email TEXT NOT NULL,
    author_type TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def seed(workspace: Path, fixture: str) -> None:
    rng = random.Random(SEED)
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "inputs").mkdir(parents=True, exist_ok=True)
    (workspace / "output").mkdir(parents=True, exist_ok=True)
    state = workspace / "workspace"
    state.mkdir(parents=True, exist_ok=True)
    db_path = state / "helpdesk.db"
    if db_path.exists():
        db_path.unlink()
    connection = sqlite3.connect(db_path)
    connection.executescript(SCHEMA)
    connection.execute(
        "INSERT INTO agents(id,email,created_at) VALUES(1,?,?)",
        ("legacy@example.test", "2025-01-02T09:00:00Z"),
    )
    if fixture == "edge":
        rows = [
            (1, "Edge printer", "Paper tray sticks", "open", "normal", 1,
             "edge.customer@example.test", "2025-05-22T10:00:00Z", "2025-05-22T10:00:00Z"),
        ]
    else:
        rows = [
            (1, "Printer paper jam", "North office printer makes a grinding sound", "open", "urgent", None,
             "pat@example.test", "2025-05-22T16:30:00Z", "2025-05-22T16:30:00Z"),
            (2, "Cannot sign in to payroll", "Password reset loop returns to login", "resolved", "normal", 1,
             "alice@example.test", "2025-05-21T10:00:00Z", "2025-05-22T12:00:00Z"),
            (3, "Laptop battery replacement", "Awaiting serial number from customer", "pending_customer", "low", 1,
             "sam@example.test", "2025-05-19T09:00:00Z", "2025-05-22T16:00:00Z"),
        ]
        base = datetime(2025, 4, 1, 9, 0, tzinfo=timezone.utc)
        nouns = ("keyboard", "monitor", "account", "dock", "headset", "network")
        for ticket_id in range(4, 44):
            created = base + timedelta(hours=ticket_id * 7)
            stamp = created.isoformat().replace("+00:00", "Z")
            noun = nouns[rng.randrange(len(nouns))]
            rows.append((ticket_id, f"Archived {noun} request {ticket_id:03d}",
                         f"Completed service record {rng.randrange(10000, 99999)}", "resolved",
                         ("normal", "low")[rng.randrange(2)], 1,
                         f"customer{ticket_id:03d}@example.test", stamp, stamp))
    connection.executemany(
        "INSERT INTO tickets(id,subject,body,status,priority,assignee_id,requester_email,created_at,updated_at) "
        "VALUES(?,?,?,?,?,?,?,?,?)", rows,
    )
    connection.execute(
        "INSERT INTO comments(id,ticket_id,author_email,author_type,body,created_at) VALUES(100,1,?,?,?,?)",
        ("legacy@example.test", "agent", "Initial diagnostic recorded.", "2025-05-22T16:40:00Z"),
    )
    connection.commit()
    connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), required=True)
    args = parser.parse_args()
    seed(args.workspace.resolve(), args.fixture)


if __name__ == "__main__":
    main()
