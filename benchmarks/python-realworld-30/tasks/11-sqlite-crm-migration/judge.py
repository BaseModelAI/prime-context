#!/usr/bin/env python3
"""Direct main-and-edge semantic judge for Task 11."""

from __future__ import annotations

import argparse
import csv
import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
from pathlib import Path
from typing import Any

TASK_DIR = Path(__file__).resolve().parent


def benchmark_python() -> str:
    executable = os.environ.get("PRIME_CONTEXT_BENCHMARK_PYTHON") or shutil.which("python3.12")
    if executable is None:
        raise RuntimeError("Python 3.12 is required")
    return executable


def normalize_email(value: str | None) -> tuple[str, str] | None:
    trimmed = (value or "").strip()
    if not trimmed:
        return None
    return trimmed, trimmed.casefold()


def normalize_phone(value: str | None) -> tuple[str, str] | None:
    trimmed = (value or "").strip()
    digits = "".join(character for character in trimmed if character.isdigit())
    if not digits:
        return None
    normalized = ("+" if trimmed.startswith("+") else "") + digits
    return trimmed, normalized


def reference_migration(
    legacy_rows: list[tuple[int, str, str | None, str | None, str | None]],
) -> tuple[list[tuple[int, str, str]], list[tuple[int, str, str, str, int]]]:
    """Calculate the specified version-2 records without using candidate code."""
    duplicate_groups: dict[str, list[int]] = {}
    rows_by_id = {row[0]: row for row in legacy_rows}
    for contact_id, _name, email, _phone, _notes in legacy_rows:
        method = normalize_email(email)
        if method is not None:
            duplicate_groups.setdefault(method[1], []).append(contact_id)

    survivor_for = {contact_id: contact_id for contact_id in rows_by_id}
    for ids in duplicate_groups.values():
        survivor = min(ids)
        for contact_id in ids:
            survivor_for[contact_id] = survivor

    source_groups: dict[int, list[int]] = {}
    for contact_id in sorted(rows_by_id):
        source_groups.setdefault(survivor_for[contact_id], []).append(contact_id)

    contacts: list[tuple[int, str, str]] = []
    methods: list[tuple[int, str, str, str, int]] = []
    for survivor in sorted(source_groups):
        source_ids = source_groups[survivor]
        notes: list[str] = []
        seen_notes: set[str] = set()
        for source_id in source_ids:
            note = (rows_by_id[source_id][4] or "").strip()
            if note and note not in seen_notes:
                seen_notes.add(note)
                notes.append(note)
        contacts.append((survivor, rows_by_id[survivor][1], "\n".join(notes)))

        seen_methods: set[tuple[str, str]] = set()
        has_primary: set[str] = set()
        for source_id in source_ids:
            row = rows_by_id[source_id]
            for kind, method in (
                ("email", normalize_email(row[2])),
                ("phone", normalize_phone(row[3])),
            ):
                if method is None or (kind, method[1]) in seen_methods:
                    continue
                seen_methods.add((kind, method[1]))
                is_primary = int(kind not in has_primary)
                has_primary.add(kind)
                methods.append((survivor, kind, method[0], method[1], is_primary))
    return contacts, methods


def reference_import(
    contacts: list[tuple[int, str, str]],
    methods: list[tuple[int, str, str, str, int]],
    csv_path: Path,
) -> tuple[
    list[tuple[int, str, str]],
    list[tuple[int, str, str, str, int]],
    dict[str, list[int]],
]:
    """Apply one import pass to reference records."""
    contact_map = {
        contact_id: {"display_name": display_name, "notes": notes}
        for contact_id, display_name, notes in contacts
    }
    method_rows = list(methods)
    email_index = {
        normalized_value: contact_id
        for contact_id, kind, _value, normalized_value, _primary in method_rows
        if kind == "email"
    }
    next_id = max(contact_map, default=0) + 1
    report: dict[str, list[int]] = {
        "inserted_ids": [],
        "updated_ids": [],
        "skipped_rows": [],
    }

    with csv_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, 1):
            email = normalize_email(row.get("email"))
            phone = normalize_phone(row.get("phone"))
            if email is None and phone is None:
                report["skipped_rows"].append(row_number)
                continue

            if email is not None and email[1] in email_index:
                contact_id = email_index[email[1]]
                report["updated_ids"].append(contact_id)
            else:
                contact_id = next_id
                next_id += 1
                contact_map[contact_id] = {"display_name": "", "notes": ""}
                report["inserted_ids"].append(contact_id)

            display_name = (row.get("display_name") or "").strip()
            if display_name:
                contact_map[contact_id]["display_name"] = display_name
            note = (row.get("notes") or "").strip()
            existing_notes = contact_map[contact_id]["notes"].splitlines()
            if note and note not in existing_notes:
                contact_map[contact_id]["notes"] = "\n".join(existing_notes + [note])

            for kind, method in (("email", email), ("phone", phone)):
                if method is None:
                    continue
                if any(
                    existing_contact == contact_id
                    and existing_kind == kind
                    and existing_normalized == method[1]
                    for (
                        existing_contact,
                        existing_kind,
                        _existing_value,
                        existing_normalized,
                        _existing_primary,
                    ) in method_rows
                ):
                    continue
                has_primary = any(
                    existing_contact == contact_id
                    and existing_kind == kind
                    and existing_primary == 1
                    for (
                        existing_contact,
                        existing_kind,
                        _existing_value,
                        _existing_normalized,
                        existing_primary,
                    ) in method_rows
                )
                method_rows.append((contact_id, kind, method[0], method[1], int(not has_primary)))
                if kind == "email":
                    email_index[method[1]] = contact_id

    contact_rows = [
        (contact_id, values["display_name"], values["notes"])
        for contact_id, values in sorted(contact_map.items())
    ]
    return contact_rows, method_rows, report


def logical_snapshot(database: Path) -> dict[str, Any]:
    with sqlite3.connect(database) as db:
        user_version = db.execute("PRAGMA user_version").fetchone()[0]
        tables = [
            row[0]
            for row in db.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
        contact_info = list(db.execute("PRAGMA table_info(contacts)"))
        method_info = list(db.execute("PRAGMA table_info(contact_methods)"))
        contacts = []
        methods = []
        if [row[1] for row in contact_info] == ["id", "display_name", "notes"]:
            contacts = list(
                db.execute("SELECT id, display_name, notes FROM contacts ORDER BY id")
            )
        if [row[1] for row in method_info] == [
            "contact_id", "kind", "value", "normalized_value", "is_primary"
        ]:
            methods = list(
                db.execute(
                    "SELECT contact_id, kind, value, normalized_value, is_primary "
                    "FROM contact_methods "
                    "ORDER BY contact_id, kind, normalized_value, value, is_primary"
                )
            )
    return {
        "user_version": user_version,
        "tables": tables,
        "contact_info": contact_info,
        "method_info": method_info,
        "contacts": contacts,
        "methods": methods,
    }


def schema_is_v2(snapshot: dict[str, Any]) -> bool:
    contact_info = snapshot["contact_info"]
    method_info = snapshot["method_info"]
    return (
        snapshot["user_version"] == 2
        and snapshot["tables"] == ["contact_methods", "contacts"]
        and [row[1] for row in contact_info] == ["id", "display_name", "notes"]
        and [row[1] for row in method_info]
        == ["contact_id", "kind", "value", "normalized_value", "is_primary"]
        and len(contact_info) == 3
        and len(method_info) == 5
        and contact_info[0][2].upper() == "INTEGER"
        and bool(contact_info[0][5])
    )


def sorted_methods(
    rows: list[tuple[int, str, str, str, int]],
) -> list[tuple[int, str, str, str, int]]:
    return sorted(rows, key=lambda row: (row[0], row[1], row[3], row[2], row[4]))


def run_command(workspace: Path, arguments: list[str], timeout: int = 20) -> tuple[int | None, bool]:
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    try:
        completed = subprocess.run(
            [benchmark_python(), "-E", "-S", *arguments],
            cwd=workspace,
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout,
        )
        return completed.returncode, False
    except subprocess.TimeoutExpired:
        return None, True


def seed_candidate_workspace(candidate: Path, fixture: str, destination: Path) -> list[tuple]:
    subprocess.run(
        [
            benchmark_python(),
            "-E",
            "-S",
            str(TASK_DIR / "seed.py"),
            "--workspace",
            str(destination),
            "--fixture",
            fixture,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=15,
    )
    candidate_package = candidate / "crm"
    destination_package = destination / "crm"
    if candidate_package.is_dir():
        shutil.rmtree(destination_package, ignore_errors=True)
        shutil.copytree(candidate_package, destination_package)
    database = destination / "workspace" / "crm.db"
    with sqlite3.connect(database) as db:
        return list(db.execute("SELECT id, name, email, phone, notes FROM contacts ORDER BY id"))


def inject_import_input(workspace: Path) -> Path:
    source = TASK_DIR / "stages" / "import-contacts" / "inputs" / "new_contacts.csv"
    target = workspace / "inputs" / "new_contacts.csv"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return target


def parse_report(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(value, dict) or set(value) != {
        "inserted_ids", "updated_ids", "skipped_rows"
    }:
        return None
    if not all(
        isinstance(value[key], list)
        and all(isinstance(item, int) and not isinstance(item, bool) for item in value[key])
        for key in value
    ):
        return None
    return value


def run_main_fixture(candidate: Path) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="task11-main-") as temporary:
        workspace = Path(temporary) / "candidate"
        legacy = seed_candidate_workspace(candidate, "main", workspace)
        database = workspace / "workspace" / "crm.db"
        csv_path = inject_import_input(workspace)
        expected_migration = reference_migration(legacy)

        migrate_one, timeout_one = run_command(
            workspace, ["-m", "crm.migrate", "workspace/crm.db"]
        )
        try:
            migrated = logical_snapshot(database)
        except (OSError, sqlite3.Error):
            migrated = None

        migrate_two, timeout_two = run_command(
            workspace, ["-m", "crm.migrate", "workspace/crm.db"]
        )
        try:
            migrated_twice = logical_snapshot(database)
        except (OSError, sqlite3.Error):
            migrated_twice = None

        import_one, timeout_three = run_command(
            workspace,
            [
                "-m", "crm.import_contacts", "workspace/crm.db",
                "inputs/new_contacts.csv", "output/import_report.json",
            ],
        )
        first_report = parse_report(workspace / "output" / "import_report.json")
        try:
            imported = logical_snapshot(database)
        except (OSError, sqlite3.Error):
            imported = None

        if migrated is not None:
            expected_contacts, expected_methods, expected_report = reference_import(
                expected_migration[0], expected_migration[1], csv_path
            )
            expected_second_contacts, expected_second_methods, expected_second_report = reference_import(
                expected_contacts, expected_methods, csv_path
            )
        else:
            expected_contacts, expected_methods, expected_report = [], [], {}
            expected_second_contacts, expected_second_methods, expected_second_report = [], [], {}

        import_two, timeout_four = run_command(
            workspace,
            [
                "-m", "crm.import_contacts", "workspace/crm.db",
                "inputs/new_contacts.csv", "output/import_report.json",
            ],
        )
        second_report = parse_report(workspace / "output" / "import_report.json")
        try:
            imported_twice = logical_snapshot(database)
        except (OSError, sqlite3.Error):
            imported_twice = None

        return {
            "returncodes": (migrate_one, migrate_two, import_one, import_two),
            "timed_out": any((timeout_one, timeout_two, timeout_three, timeout_four)),
            "migrated": migrated,
            "migrated_twice": migrated_twice,
            "imported": imported,
            "imported_twice": imported_twice,
            "first_report": first_report,
            "second_report": second_report,
            "expected_migration": expected_migration,
            "expected_import": (expected_contacts, expected_methods),
            "expected_second_import": (expected_second_contacts, expected_second_methods),
            "expected_report": expected_report,
            "expected_second_report": expected_second_report,
        }


def run_edge_fixture(candidate: Path) -> tuple[bool, bool]:
    with tempfile.TemporaryDirectory(prefix="task11-edge-") as temporary:
        workspace = Path(temporary) / "candidate"
        seed_candidate_workspace(candidate, "edge", workspace)
        returncode, timed_out = run_command(
            workspace, ["-m", "crm.migrate", "workspace/crm.db"]
        )
        if returncode != 0:
            return False, timed_out
        try:
            snapshot = logical_snapshot(workspace / "workspace" / "crm.db")
        except (OSError, sqlite3.Error):
            return False, timed_out
        # The single edge check is the stated three-way duplicate merge and note de-duplication.
        edge_passed = snapshot["contacts"] == [
            (4, "Terry Low", "Shared note\nFinal note")
        ]
        return edge_passed, timed_out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "crm" / "migrate.py").is_file()
    notes: list[str] = []

    try:
        result = run_main_fixture(candidate)
        edge_passed, edge_timed_out = run_edge_fixture(candidate)
    except Exception as exc:
        output = {
            "status": "fail",
            "progress_level": 1 if artifact else 0,
            "main_checks_passed": 0,
            "main_checks_total": 5,
            "edge_check_passed": False,
            "notes": [f"judge setup failed: {type(exc).__name__}"],
        }
        print(json.dumps(output, sort_keys=True))
        return

    migrated = result["migrated"]
    migrated_twice = result["migrated_twice"]
    imported = result["imported"]
    imported_twice = result["imported_twice"]
    expected_migration_contacts, expected_migration_methods = result["expected_migration"]
    expected_import_contacts, expected_import_methods = result["expected_import"]
    expected_second_contacts, expected_second_methods = result["expected_second_import"]
    returncodes = result["returncodes"]

    main_checks = [
        returncodes[0] == 0 and migrated is not None and schema_is_v2(migrated),
        migrated is not None
        and migrated["contacts"] == expected_migration_contacts
        and migrated["methods"] == sorted_methods(expected_migration_methods),
        returncodes[1] == 0 and migrated_twice == migrated,
        returncodes[2] == 0 and result["first_report"] == result["expected_report"],
        returncodes[3] == 0
        and imported is not None
        and imported["contacts"] == expected_import_contacts
        and imported["methods"] == sorted_methods(expected_import_methods)
        and imported_twice is not None
        and imported_twice["contacts"] == expected_second_contacts
        and imported_twice["methods"] == sorted_methods(expected_second_methods)
        and imported_twice == imported
        and result["second_report"] == result["expected_second_report"],
    ]

    for number, passed in enumerate(main_checks, 1):
        if not passed:
            notes.append(f"main semantic check {number} failed")
    if result["timed_out"] or edge_timed_out:
        notes.append("candidate command timed out")

    passed = sum(main_checks)
    structurally_complete = (
        returncodes[0] == 0
        and migrated is not None
        and "contacts" in migrated["tables"]
        and "contact_methods" in migrated["tables"]
    )
    if not artifact:
        level = 0
    elif not structurally_complete:
        level = 1
    elif all(main_checks):
        level = 5 if edge_passed else 4
    elif passed >= 2:
        level = 3
    else:
        level = 2

    output = {
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": 5,
        "edge_check_passed": edge_passed,
        "notes": notes,
    }
    print(json.dumps(output, sort_keys=True))


if __name__ == "__main__":
    main()
