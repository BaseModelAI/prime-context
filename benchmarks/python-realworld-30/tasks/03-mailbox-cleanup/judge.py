#!/usr/bin/env python3
"""Direct semantic main-and-edge judge for Task 03."""
from __future__ import annotations

import argparse
import csv
import json
import mailbox
import re
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timezone
from email.header import decode_header
from email.parser import BytesParser
from email.policy import default
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path

TASK_DIR = Path(__file__).resolve().parent
THREAD_FIELDS = ["thread_id", "subject", "participants", "first_date", "last_date", "message_count"]
UNSUB_FIELDS = ["sender_domain", "http_targets", "mailto_targets"]
ID_RE = re.compile(r"<[^<>\s]+>")
PREFIX_RE = re.compile(r"^\s*(?:re|fwd|fw)\s*:\s*", re.IGNORECASE)


def decode_value(value: object | None) -> str:
    if value is None:
        return ""
    pieces: list[str] = []
    try:
        decoded = decode_header(str(value))
    except (LookupError, ValueError):
        return str(value)
    for part, charset in decoded:
        if isinstance(part, str):
            pieces.append(part)
            continue
        encoding = charset or "ascii"
        try:
            pieces.append(part.decode(encoding, errors="replace"))
        except LookupError:
            pieces.append(part.decode("utf-8", errors="replace"))
    return "".join(pieces)


def message_ids(value: object | None) -> list[str]:
    return ID_RE.findall(str(value or ""))


def message_id(message) -> str | None:
    ids = message_ids(message.get("Message-ID"))
    return ids[0] if ids else None


def parsed_date(message) -> datetime | None:
    value = message.get("Date")
    if value is None:
        return None
    try:
        parsed = parsedate_to_datetime(str(value))
        if parsed is None:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None


def date_text(value: datetime | None) -> str:
    return "" if value is None else value.strftime("%Y-%m-%dT%H:%M:%SZ")


def thread_id(message, ordinal: int) -> str:
    refs = message_ids(message.get("References"))
    if refs:
        return refs[0]
    replies = message_ids(message.get("In-Reply-To"))
    if replies:
        return replies[0]
    return message_id(message) or f"missing-{ordinal:06d}"


def display_subject(message) -> str:
    value = decode_value(message.get("Subject")).strip()
    while True:
        stripped = PREFIX_RE.sub("", value, count=1)
        if stripped == value:
            return value.strip()
        value = stripped


def addresses(message) -> set[str]:
    values = [decode_value(message.get(name)) for name in ("From", "To", "Cc") if message.get(name)]
    return {address.lower() for _, address in getaddresses(values) if address}


def sender_domain(message) -> str:
    parsed = getaddresses([decode_value(message.get("From"))])
    if not parsed or "@" not in parsed[0][1]:
        return ""
    return parsed[0][1].rsplit("@", 1)[1].lower()


def body_text(message) -> str:
    parts = list(message.walk()) if message.is_multipart() else [message]
    choices = [part for part in parts if part.get_content_maintype() == "text" and
               part.get_content_disposition() != "attachment"]
    choices.sort(key=lambda part: 0 if part.get_content_type() == "text/plain" else 1)
    if not choices:
        return ""
    part = choices[0]
    payload = part.get_payload(decode=True)
    if payload is None:
        value = part.get_payload()
        return value if isinstance(value, str) else ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def read_mbox(path: Path) -> list:
    box = mailbox.mbox(path, factory=lambda handle: BytesParser(policy=default).parse(handle), create=False)
    try:
        return list(box)
    finally:
        box.close()


def retained_reference(paths: list[Path]) -> list[tuple[int, object]]:
    physical: list[tuple[int, object]] = []
    ordinal = 0
    for path in paths:
        for message in read_mbox(path):
            physical.append((ordinal, message))
            ordinal += 1

    winners: dict[str, tuple[int, object]] = {}
    no_ids: list[tuple[int, object]] = []
    for item in physical:
        current_ordinal, message = item
        mid = message_id(message)
        if mid is None:
            no_ids.append(item)
            continue
        previous = winners.get(mid)
        if previous is None:
            winners[mid] = item
            continue
        old_date = parsed_date(previous[1])
        new_date = parsed_date(message)
        if new_date is not None and (old_date is None or new_date > old_date):
            winners[mid] = item
    return sorted([*winners.values(), *no_ids], key=lambda item: item[0])


def expected_threads(retained: list[tuple[int, object]]) -> list[dict[str, str]]:
    groups: dict[str, list[tuple[int, object]]] = defaultdict(list)
    for item in retained:
        groups[thread_id(item[1], item[0])].append(item)
    rows: list[dict[str, str]] = []
    for root in sorted(groups):
        items = sorted(groups[root], key=lambda item: (
            parsed_date(item[1]) is None,
            parsed_date(item[1]) or datetime.max.replace(tzinfo=timezone.utc),
            item[0],
        ))
        known = [parsed_date(message) for _, message in items if parsed_date(message) is not None]
        subject = next((display_subject(message) for _, message in items if display_subject(message)), "")
        people: set[str] = set()
        for _, message in items:
            people.update(addresses(message))
        rows.append({
            "thread_id": root,
            "subject": subject,
            "participants": ";".join(sorted(people)),
            "first_date": date_text(min(known)) if known else "",
            "last_date": date_text(max(known)) if known else "",
            "message_count": str(len(items)),
        })
    return rows


def expected_unsubscribe(retained: list[tuple[int, object]]) -> list[dict[str, str]]:
    grouped: dict[str, dict[str, set[str]]] = defaultdict(lambda: {"http": set(), "mailto": set()})
    for _, message in retained:
        domain = sender_domain(message)
        for value in message.get_all("List-Unsubscribe", []):
            for target in re.findall(r"<\s*([^<>]+?)\s*>", str(value)):
                lowered = target.lower()
                if lowered.startswith(("http://", "https://")):
                    grouped[domain]["http"].add(target)
                elif lowered.startswith("mailto:"):
                    grouped[domain]["mailto"].add(target)
    return [{
        "sender_domain": domain,
        "http_targets": ";".join(sorted(values["http"])),
        "mailto_targets": ";".join(sorted(values["mailto"])),
    } for domain, values in sorted(grouped.items()) if values["http"] or values["mailto"]]


def read_csv(path: Path, fields: list[str]) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != fields:
            raise ValueError(f"wrong header in {path.name}")
        return list(reader)


def copy_solution(source_workspace: Path, destination: Path) -> bool:
    source = source_workspace / "solution"
    artifact = source.is_dir() and any(path.is_file() for path in source.rglob("*.py"))
    target = destination / "solution"
    shutil.rmtree(target, ignore_errors=True)
    if source.is_dir():
        shutil.copytree(source, target)
    else:
        target.mkdir()
    return artifact


def generate_payload(generator: Path, workspace: Path, fixture: str) -> None:
    subprocess.run(
        [sys.executable, str(generator), "--output", str(workspace), "--fixture", fixture],
        cwd=generator.parent, check=True, capture_output=True, text=True, timeout=30,
    )


def prepare(candidate: Path, fixture: str, include_archive: bool) -> tuple[tempfile.TemporaryDirectory, Path, bool]:
    temporary = tempfile.TemporaryDirectory(prefix=f"task03-{fixture}-")
    workspace = Path(temporary.name) / "workspace"
    subprocess.run(
        [sys.executable, str(TASK_DIR / "seed.py"), "--workspace", str(workspace), "--fixture", fixture],
        cwd=TASK_DIR, check=True, capture_output=True, text=True, timeout=30,
    )
    artifact = copy_solution(candidate, workspace)
    generate_payload(TASK_DIR / "visible" / "_generate.py", workspace, fixture)
    if include_archive:
        generate_payload(TASK_DIR / "stages" / "archive" / "_generate.py", workspace, fixture)
    return temporary, workspace, artifact


def run_candidate(workspace: Path, include_archive: bool) -> subprocess.CompletedProcess[str]:
    command = [sys.executable, "-E", "-S", "-m", "solution.mailbox_clean", "inputs/current.mbox"]
    if include_archive:
        command.append("inputs/archive.mbox")
    command += ["--output", "output"]
    return subprocess.run(command, cwd=workspace, capture_output=True, text=True, timeout=45)


def attachment_facts(message) -> list[tuple[str, str, bytes]]:
    facts: list[tuple[str, str, bytes]] = []
    for part in message.walk():
        if part.get_content_disposition() != "attachment":
            continue
        payload = part.get_payload(decode=True)
        facts.append((part.get_content_type(), part.get_filename() or "", payload or b""))
    return facts


def message_fact(message) -> tuple[object, ...]:
    return (
        message_id(message),
        tuple(message_ids(message.get("References"))),
        tuple(message_ids(message.get("In-Reply-To"))),
        date_text(parsed_date(message)),
        display_subject(message),
        tuple(sorted(addresses(message))),
        body_text(message),
        tuple(str(value) for value in message.get_all("List-Unsubscribe", [])),
        tuple(attachment_facts(message)),
    )


def cleaned_order_ok(messages: list, retained: list[tuple[int, object]]) -> bool:
    expected = sorted(retained, key=lambda item: (
        thread_id(item[1], item[0]),
        parsed_date(item[1]) is None,
        parsed_date(item[1]) or datetime.max.replace(tzinfo=timezone.utc),
        item[0],
    ))
    return len(messages) == len(expected) and all(
        message_fact(actual) == message_fact(wanted)
        for actual, (_, wanted) in zip(messages, expected)
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.workspace.resolve()

    notes: list[str] = []
    main_checks = [False] * 5
    edge_passed = False
    main_parseable = False
    artifact = (candidate / "solution").is_dir() and any((candidate / "solution").rglob("*.py"))
    runnable = False
    temporaries: list[tempfile.TemporaryDirectory] = []

    try:
        main_temp, main_workspace, copied = prepare(candidate, "main", True)
        temporaries.append(main_temp)
        artifact = artifact or copied
        result = run_candidate(main_workspace, True)
        runnable = result.returncode == 0
        if not runnable and copied:
            imported = subprocess.run(
                [sys.executable, "-E", "-S", "-c", "import solution.mailbox_clean"], cwd=main_workspace,
                capture_output=True, text=True, timeout=10,
            )
            runnable = imported.returncode == 0
        if result.returncode != 0:
            notes.append("main command failed")
        else:
            try:
                cleaned = read_mbox(main_workspace / "output" / "cleaned.mbox")
                threads = read_csv(main_workspace / "output" / "threads.csv", THREAD_FIELDS)
                unsub = read_csv(main_workspace / "output" / "unsubscribe.csv", UNSUB_FIELDS)
                main_parseable = True

                inputs = [main_workspace / "inputs" / "current.mbox", main_workspace / "inputs" / "archive.mbox"]
                retained = retained_reference(inputs)
                expected_ids = {message_id(message) for _, message in retained if message_id(message)}
                actual_ids = [message_id(message) for message in cleaned if message_id(message)]
                expected_no_id = sum(message_id(message) is None for _, message in retained)
                actual_no_id = sum(message_id(message) is None for message in cleaned)
                bodies = "\n".join(body_text(message) for message in cleaned)
                main_checks[0] = (
                    len(actual_ids) == len(set(actual_ids)) == len(expected_ids)
                    and set(actual_ids) == expected_ids
                    and actual_no_id == expected_no_id
                    and "ARCHIVE FORWARDED WINNER" in bodies
                    and "INVALID DUPLICATE MUST LOSE" not in bodies
                )

                expected_thread_rows = expected_threads(retained)
                main_checks[1] = threads == expected_thread_rows

                thread_map = {row["thread_id"]: row for row in threads}
                csv_text = (main_workspace / "output" / "threads.csv").read_text(encoding="utf-8") + (
                    main_workspace / "output" / "unsubscribe.csv").read_text(encoding="utf-8")
                main_checks[2] = (
                    thread_map.get("<t07-m0@example.test>", {}).get("subject") == "Project Café 07"
                    and thread_map.get("<t08-m0@example.test>", {}).get("subject") == "Project 08"
                    and "CURRENT_ATTACHMENT_SECRET_3F21" not in csv_text
                )

                main_checks[3] = unsub == expected_unsubscribe(retained)

                main_checks[4] = (
                    "<archive-a@example.test>" in actual_ids
                    and thread_map.get("<archive-invalid-root@example.test>", {}).get("first_date") == ""
                    and thread_map.get("<archive-invalid-root@example.test>", {}).get("last_date") == ""
                    and cleaned_order_ok(cleaned, retained)
                )
            except (OSError, UnicodeError, csv.Error, ValueError, KeyError) as exc:
                notes.append(f"main outputs not parseable: {type(exc).__name__}")

        edge_temp, edge_workspace, _ = prepare(candidate, "edge", False)
        temporaries.append(edge_temp)
        edge_result = run_candidate(edge_workspace, False)
        if edge_result.returncode != 0:
            notes.append("edge command failed")
        else:
            try:
                edge_cleaned = read_mbox(edge_workspace / "output" / "cleaned.mbox")
                edge_threads = read_csv(edge_workspace / "output" / "threads.csv", THREAD_FIELDS)
                edge_unsub = read_csv(edge_workspace / "output" / "unsubscribe.csv", UNSUB_FIELDS)
                csv_bytes = (edge_workspace / "output" / "threads.csv").read_bytes() + (
                    edge_workspace / "output" / "unsubscribe.csv").read_bytes()
                edge_passed = (
                    len(edge_cleaned) == 1
                    and message_id(edge_cleaned[0]) == "<edge-charset@example.test>"
                    and len(edge_threads) == 1
                    and "Broken" in edge_threads[0]["subject"]
                    and "\ufffd" in edge_threads[0]["subject"]
                    and edge_unsub == []
                    and any(
                        b"EDGE_ATTACHMENT_SECRET_91C7" in payload
                        for _, _, payload in attachment_facts(edge_cleaned[0])
                    )
                    and b"EDGE_ATTACHMENT_SECRET_91C7" not in csv_bytes
                )
            except (OSError, UnicodeError, csv.Error, ValueError, KeyError):
                edge_passed = False
    except (OSError, subprocess.SubprocessError) as exc:
        notes.append(f"judge execution failed: {type(exc).__name__}")
    finally:
        for temporary in temporaries:
            temporary.cleanup()

    passed = sum(main_checks)
    if not artifact or not runnable:
        level = 0
    elif not main_parseable:
        level = 1
    elif passed == len(main_checks):
        level = 5 if edge_passed else 4
    elif passed:
        level = 3
    else:
        level = 2
    print(json.dumps({
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": len(main_checks),
        "edge_check_passed": edge_passed,
        "notes": notes,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
