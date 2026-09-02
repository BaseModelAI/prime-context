#!/usr/bin/env python3
"""Generate the stage-two archive mailbox for Task 03."""
from __future__ import annotations

import argparse
import random
from datetime import datetime, timezone
from email.message import EmailMessage
from email.policy import default
from email.utils import format_datetime
from pathlib import Path

SEED = 20260831 + 3


def make_message(*, message_id: str | None, subject: str, body: str,
                 date_value: str | None, references: str | None = None,
                 sender: str = "Archive Bot <archive@archive.example>",
                 unsubscribe: bool = False) -> bytes:
    msg = EmailMessage(policy=default)
    msg["From"] = sender
    msg["To"] = "Archive Reader <reader@example.test>"
    if message_id is not None:
        msg["Message-ID"] = message_id
    if date_value is not None:
        msg["Date"] = date_value
    if references:
        msg["References"] = references
        msg["In-Reply-To"] = references.split()[0]
    msg["Subject"] = subject
    if unsubscribe:
        msg["List-Unsubscribe"] = (
            "<https://archive.example/unsubscribe>, "
            "<mailto:stop@archive.example>"
        )
    msg.set_content(body)
    return msg.as_bytes(policy=default.clone(linesep="\n", max_line_length=78))


def write_mbox(path: Path, records: list[bytes]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        for ordinal, raw in enumerate(records):
            handle.write(f"From archive{ordinal}@example.test Tue Jul 01 00:00:00 2025\n".encode())
            for line in raw.splitlines(keepends=True):
                handle.write((b">" if line.startswith(b"From ") else b"") + line)
            if not raw.endswith(b"\n"):
                handle.write(b"\n")
            handle.write(b"\n")


def generate_main(path: Path) -> None:
    rng = random.Random(SEED)
    valid = lambda day, hour=12: format_datetime(datetime(2025, 7, day, hour, tzinfo=timezone.utc))
    records = [
        # A forwarded duplicate newer than both copies in current.mbox.
        make_message(message_id="<t00-m1@example.test>", subject="Fwd: Re: Project 00",
                     body="ARCHIVE FORWARDED WINNER", date_value=valid(1),
                     references="<t00-m0@example.test>"),
        # Invalid duplicate: it must not displace the valid current copy.
        make_message(message_id="<t01-m2@example.test>", subject="Re: Project 01",
                     body="INVALID DUPLICATE MUST LOSE", date_value="yesterday-ish",
                     references="<t01-m0@example.test>"),
        make_message(message_id="<t03-m1@example.test>", subject="Fwd: Project 03",
                     body="archive list copy", date_value=valid(2),
                     references="<t03-m0@example.test>", unsubscribe=True),
        make_message(message_id="<t05-m1@example.test>", subject="Re: Project 05",
                     body="archive valid duplicate", date_value=valid(3),
                     references="<t05-m0@example.test>"),
        make_message(message_id="<archive-a@example.test>", subject="Fw: Re: Project 00",
                     body=f"archive new {rng.randrange(1000)}", date_value=valid(4),
                     references="<t00-m0@example.test> <t00-m1@example.test>"),
        make_message(message_id="<archive-b@example.test>", subject="Re: Project 00",
                     body="unknown date reply", date_value="invalid-date",
                     references="<t00-m0@example.test>"),
        # A standalone all-unknown thread makes blank aggregate dates observable.
        make_message(message_id="<archive-invalid-root@example.test>", subject="Archive Unknown",
                     body="standalone invalid date", date_value="not RFC 5322"),
        make_message(message_id="<archive-missing-date@example.test>", subject="Project 10",
                     body="missing date reply", date_value=None,
                     references="<t10-m0@example.test>"),
        # Both no-ID messages must survive as distinct entries.
        make_message(message_id=None, subject="Re: Project 11", body="no id one",
                     date_value=None, references="<t11-m0@example.test>"),
        make_message(message_id=None, subject="Fw: Project 11", body="no id two",
                     date_value="broken", references="<t11-m0@example.test>"),
        make_message(message_id="<archive-c@example.test>", subject="Project 20",
                     body="ordinary archive reply", date_value=valid(5),
                     references="<t20-m0@example.test>"),
        make_message(message_id="<archive-list@example.test>", subject="Archive List",
                     body="list message", date_value=valid(6),
                     sender="List Owner <owner@archive.example>", unsubscribe=True),
    ]
    write_mbox(path, records)


def generate_edge(path: Path) -> None:
    # The edge is isolated in current.mbox; keep the late payload harmless.
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    target = args.output / "inputs" / "archive.mbox"
    if args.fixture == "main":
        generate_main(target)
    else:
        generate_edge(target)


if __name__ == "__main__":
    main()
