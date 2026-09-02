#!/usr/bin/env python3
"""Generate the deterministic current mailbox for Task 03."""
from __future__ import annotations

import argparse
import random
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.policy import default
from email.utils import format_datetime
from pathlib import Path

SEED = 20260831 + 3
ATTACHMENT_SENTINEL = "CURRENT_ATTACHMENT_SECRET_3F21"


def message_bytes(*, thread: int, index: int, when: datetime, message_id: str | None,
                  subject: str, body: str, invalid_date: bool = False,
                  attachment: bool = False, list_mail: bool = False) -> bytes:
    msg = EmailMessage(policy=default)
    msg["From"] = f"Person {thread} <person{thread}@sender{thread % 6}.example>"
    msg["To"] = f"Team {thread % 5} <team{thread % 5}@example.test>"
    if index % 3 == 0:
        msg["Cc"] = "Observer <observer@example.test>"
    if message_id is not None:
        msg["Message-ID"] = message_id
    if index:
        root = f"<t{thread:02d}-m0@example.test>"
        msg["References"] = root
        msg["In-Reply-To"] = root
    msg["Date"] = "not a date" if invalid_date else format_datetime(when)
    msg["Subject"] = subject
    if list_mail:
        msg["List-Unsubscribe"] = (
            f"<https://lists.sender{thread % 6}.example/unsubscribe/{thread}>, "
            f"<mailto:leave@sender{thread % 6}.example?subject=unsubscribe>"
        )
    msg.set_content(body)
    if attachment:
        msg.add_attachment(
            (ATTACHMENT_SENTINEL.encode("ascii") + b"\x00\xff") * 80,
            maintype="application", subtype="octet-stream", filename="payload.bin"
        )
        msg.set_boundary(f"BOUNDARY-T{thread:02d}-M{index}")
    return msg.as_bytes(policy=default.clone(linesep="\n", max_line_length=78))


def append_record(handle, raw: bytes, ordinal: int) -> None:
    # A fixed envelope line avoids mailbox implementations adding wall-clock time.
    handle.write(f"From fixture{ordinal}@example.test Mon Jan 01 00:00:00 2024\n".encode())
    # Escape body lines which could otherwise look like mbox separators.
    lines = raw.splitlines(keepends=True)
    for line in lines:
        if line.startswith(b"From "):
            handle.write(b">" + line)
        else:
            handle.write(line)
    if not raw.endswith(b"\n"):
        handle.write(b"\n")
    handle.write(b"\n")


def generate_main(path: Path) -> None:
    rng = random.Random(SEED)
    start = datetime(2025, 1, 6, 9, 0, tzinfo=timezone.utc)
    records: list[bytes] = []

    # 42 threads with four ordinary messages each: 168 logical messages.
    for thread in range(42):
        for index in range(4):
            when = start + timedelta(days=thread, hours=index * 3, minutes=thread % 7)
            mid = f"<t{thread:02d}-m{index}@example.test>"
            # Two messages deliberately lack IDs but remain in their referenced thread.
            if (thread, index) in {(40, 2), (41, 3)}:
                mid = None
            base_subject = f"Project {thread:02d}"
            if thread == 7:
                base_subject = "Project Café 07"
            subject = base_subject if index == 0 else ("Re: " * (1 + index % 2) + base_subject)
            if thread == 8 and index == 0:
                subject = "Fwd: Fw: Re: Project 08"
            body = f"Thread {thread}, message {index}. Marker {rng.randrange(10_000):04d}."
            records.append(message_bytes(
                thread=thread,
                index=index,
                when=when,
                message_id=mid,
                subject=subject,
                body=body,
                attachment=(thread, index) == (2, 2),
                list_mail=(thread, index) in {(3, 0), (9, 1)},
            ))

    # Twelve later physical duplicates bring current.mbox to exactly 180 entries.
    # Their IDs already occur above; the newest valid copy must be retained.
    for duplicate in range(12):
        thread = duplicate
        index = 1
        when = start + timedelta(days=thread + 60, hours=duplicate)
        body = "CURRENT NEWEST DUPLICATE" if duplicate == 0 else f"new duplicate {duplicate}"
        records.append(message_bytes(
            thread=thread,
            index=index,
            when=when,
            message_id=f"<t{thread:02d}-m1@example.test>",
            subject=f"Fwd: Re: Project {thread:02d}",
            body=body,
            list_mail=duplicate == 3,
        ))

    assert len(records) == 180
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        for ordinal, raw in enumerate(records):
            append_record(handle, raw, ordinal)


def generate_edge(path: Path) -> None:
    # The unknown encoded-word charset exercises replacement header decoding.
    attachment = (b"EDGE_ATTACHMENT_SECRET_91C7" + b"\x00\xff") * 2048
    import base64
    encoded = base64.encodebytes(attachment).replace(b"\n", b"\n")
    raw = b"\n".join([
        b"From: Edge Sender <edge@edge.example>",
        b"To: Reader <reader@example.test>",
        b"Message-ID: <edge-charset@example.test>",
        b"Date: Tue, 01 Jul 2025 12:00:00 +0000",
        b"Subject: =?x-fixture-unknown?Q?Broken_=FF_header?=",
        b"MIME-Version: 1.0",
        b"Content-Type: multipart/mixed; boundary=EDGE-BOUNDARY",
        b"",
        b"--EDGE-BOUNDARY",
        b"Content-Type: text/plain; charset=x-fixture-unknown",
        b"Content-Transfer-Encoding: 8bit",
        b"",
        b"Readable text followed by an invalid byte: \xff",
        b"--EDGE-BOUNDARY",
        b"Content-Type: application/octet-stream",
        b"Content-Disposition: attachment; filename=large.bin",
        b"Content-Transfer-Encoding: base64",
        b"",
        encoded.rstrip(b"\n"),
        b"--EDGE-BOUNDARY--",
        b"",
    ])
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        append_record(handle, raw, 0)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    target = args.output / "inputs" / "current.mbox"
    if args.fixture == "main":
        generate_main(target)
    else:
        generate_edge(target)


if __name__ == "__main__":
    main()
