#!/usr/bin/env python3
"""Create the initial, deterministic workspace for task 11."""

from __future__ import annotations

import argparse
import random
import shutil
import sqlite3
from pathlib import Path

SEED = 20260831 + 11


def _main_rows(rng: random.Random) -> list[tuple[int, str, str | None, str | None, str | None]]:
    rows: list[tuple[int, str, str | None, str | None, str | None]] = [
        (1, "Alice Moran", " Alice@Example.com ", "+1 (202) 555-0101", "Met at Expo"),
        (2, "Alicia M.", "alice@example.COM", "202.555.0199", "Requested brochure"),
        (3, "Bob Stone", "bob@example.com", "202-555-0103", "Prefers SMS"),
        (4, "Chloë Ng", " CHLOE@example.net ", "+44 20 7946 0958", "International account"),
        (5, "David Ruiz", None, "(303) 555-0110", "Phone only"),
        (6, "Erin Park", " erin@example.org ", None, ""),
        # A legacy row can remain a contact even when both raw methods are unusable.
        (7, "Nora Invalid", "   ", "call the front desk", "   "),
    ]
    first_names = ["Farah", "Gideon", "Hana", "Ivo", "June", "Kaito"]
    last_names = ["Bell", "Costa", "Diaz", "Evans", "Frost", "Green"]
    note_options = ["Newsletter", "Referral", "Trade show", "Website inquiry"]
    for contact_id, first in enumerate(first_names, start=8):
        last = last_names[contact_id - 8]
        area = rng.choice((212, 312, 404, 503, 617))
        suffix = rng.randrange(1000, 9999)
        note = rng.choice(note_options)
        rows.append(
            (
                contact_id,
                f"{first} {last}",
                f"{first.lower()}.{last.lower()}@example.test",
                f"+1 ({area}) 555-{suffix:04d}",
                note,
            )
        )
    return rows


def _edge_rows() -> list[tuple[int, str, str | None, str | None, str | None]]:
    # The edge is deliberately small: three variants of one email and one repeated note.
    return [
        (4, "Terry Low", " Triple@Example.com ", "+1 212 555 0140", "Shared note"),
        (7, "T. Middle", "triple@example.COM", "+1 212 555 0170", "Shared note"),
        (9, "Terry High", " TRIPLE@example.com", "+1 212 555 0190", "Final note"),
    ]


def _create_database(path: Path, fixture: str, rng: random.Random) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = _main_rows(rng) if fixture == "main" else _edge_rows()
    with sqlite3.connect(path) as db:
        db.execute(
            """
            CREATE TABLE contacts (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
                phone TEXT,
                notes TEXT
            )
            """
        )
        db.executemany(
            "INSERT INTO contacts(id, name, email, phone, notes) VALUES (?, ?, ?, ?, ?)",
            rows,
        )
        db.execute("PRAGMA user_version=1")


def seed_workspace(workspace: Path, fixture: str) -> None:
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)

    visible = Path(__file__).resolve().parent / "visible"
    for source in visible.iterdir():
        destination = workspace / source.name
        if source.is_dir():
            shutil.copytree(source, destination)
        else:
            shutil.copy2(source, destination)

    # Do not copy later-stage inputs here. The runner injects them after stage 1.
    (workspace / "output").mkdir()
    rng = random.Random(SEED)
    _create_database(workspace / "workspace" / "crm.db", fixture, rng)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), required=True)
    args = parser.parse_args()
    seed_workspace(args.workspace, args.fixture)


if __name__ == "__main__":
    main()
