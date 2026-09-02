#!/usr/bin/env python3
"""Direct hermetic main-and-edge judge for Task 13."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from typing import Any

TASK_DIR = Path(__file__).resolve().parent
HEADER = [
    "timestamp_utc", "raw_timestamp", "service", "severity", "request_id",
    "release_id", "event_code", "source_file", "source_line", "message",
]
MAIN_SOURCES = {
    ("access.log", "12345"),
    ("access.log", "230001"),
    ("access.log", "449000"),
    ("application.log.gz", "20002"),
    ("application.log.gz", "210005"),
    ("application.log.gz", "399999"),
    ("deployment.log", "175000"),
    ("db-extra.log.gz", "2345"),
}
EDGE_SOURCES = {
    ("access.log", "20"),
    ("access.log", "70"),
    ("application.log.gz", "25"),
    ("application.log.gz", "75"),
    ("deployment.log", "40"),
    ("db-extra.log.gz", "10"),
}
MAIN_TIMESTAMPS = {
    ("deployment.log", "175000"): ("2025-04-17T14:08:00.000Z", "2025-04-17T14:08:02.000Z"),
    ("db-extra.log.gz", "2345"): ("2025-04-17T14:08:04.000Z", "2025-04-17T14:08:03.000Z"),
    ("application.log.gz", "20002"): ("2025-04-17T14:08:12.000Z", "2025-04-17T14:08:07.000Z"),
    ("access.log", "12345"): ("2025-04-17T14:08:10.500Z", "2025-04-17T14:08:08.000Z"),
    ("application.log.gz", "210005"): ("2025-04-17T14:08:16.000Z", "2025-04-17T14:08:11.000Z"),
    ("access.log", "230001"): ("2025-04-17T14:08:14.800Z", "2025-04-17T14:08:12.300Z"),
    ("application.log.gz", "399999"): ("2025-04-17T14:08:23.000Z", "2025-04-17T14:08:18.000Z"),
    ("access.log", "449000"): ("2025-04-17T14:08:21.400Z", "2025-04-17T14:08:18.900Z"),
}
ANCHORS = {
    "deployment.log:175000",
    "application.log.gz:20002",
    "access.log:12345",
}


def benchmark_python() -> str:
    executable = os.environ.get("PRIME_CONTEXT_BENCHMARK_PYTHON") or shutil.which("python3.12")
    if executable is None:
        raise RuntimeError("Python 3.12 is required")
    return executable


def clean_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    return environment


def run_python(arguments: list[str], *, cwd: Path, timeout: int = 180, input_text: str | None = None) -> subprocess.CompletedProcess[str] | None:
    try:
        return subprocess.run(
            [benchmark_python(), "-E", "-S", *arguments],
            cwd=cwd,
            env=clean_environment(),
            input=input_text,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return None


def copy_payload(source: Path, destination: Path) -> None:
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        if relative.name == "_generate.py":
            continue
        target = destination / relative
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif path.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)


def inject_payload(source: Path, workspace: Path, fixture: str) -> None:
    with tempfile.TemporaryDirectory(prefix="task13-payload-") as temporary:
        payload = Path(temporary)
        copy_payload(source, payload)
        generator = source / "_generate.py"
        if generator.is_file():
            completed = run_python(
                [str(generator), "--output", str(payload), "--fixture", fixture],
                cwd=source,
            )
            if completed is None or completed.returncode != 0:
                raise RuntimeError(f"fixture generator failed: {source.name}")
        copy_payload(payload, workspace)


def prepare(candidate: Path, workspace: Path, fixture: str) -> None:
    seeded = run_python(
        [str(TASK_DIR / "seed.py"), "--workspace", str(workspace), "--fixture", fixture],
        cwd=TASK_DIR,
        timeout=30,
    )
    if seeded is None or seeded.returncode != 0:
        raise RuntimeError("seed.py failed")
    inject_payload(TASK_DIR / "visible", workspace, fixture)
    for stage in ("recovered-db", "clock-offsets", "stream-monitor"):
        inject_payload(TASK_DIR / "stages" / stage, workspace, fixture)
    for artifact in ("solution", "monitor"):
        source = candidate / artifact
        destination = workspace / artifact
        if source.is_dir():
            shutil.rmtree(destination, ignore_errors=True)
            shutil.copytree(
                source,
                destination,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
            )


def parse_timeline(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != HEADER:
            raise ValueError("timeline.csv header is incorrect")
        rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError("timeline.csv has a malformed row")
    for row in rows:
        datetime.fromisoformat(row["timestamp_utc"].replace("Z", "+00:00"))
        int(row["source_line"])
    return rows


def source_set(rows: list[dict[str, str]]) -> set[tuple[str, str]]:
    return {(row["source_file"], row["source_line"]) for row in rows}


def row_map(rows: list[dict[str, str]]) -> dict[tuple[str, str], dict[str, str]]:
    return {(row["source_file"], row["source_line"]): row for row in rows}


def monitor_input() -> str:
    values = [
        "2025-04-17T14:07:59.000Z [ERROR] application request_id=old release_id=old code=UNDEFINED_COLUMN message=customer_status",
        '{"event":"SCHEMA_CHANGE","operation":"ALTER TABLE customers DROP COLUMN customer_status","release":"2025.04.17.3","service":"deployment","severity":"INFO","timestamp":"2025-04-17T14:08:02.000Z"}',
        '2025-04-17T14:08:12.000Z [ERROR] application request_id=req-1001 release_id=2025.04.17.3 code=UNDEFINED_COLUMN message="column customer_status does not exist"',
        '2025-04-17T14:09:32.000Z [ERROR] application request_id=req-1002 release_id=2025.04.17.3 code=UNDEFINED_COLUMN message="column customer_status does not exist"',
        '2025-04-17T14:09:32.001Z [ERROR] application request_id=req-1003 release_id=2025.04.17.3 code=UNDEFINED_COLUMN message="column customer_status does not exist"',
        '2025-04-17T14:08:20.000Z [ERROR] application request_id=req-1001 release_id=2025.04.17.3 code=UNDEFINED_COLUMN message="column customer_status does not exist"',
    ]
    return "\n".join(values) + "\n"


def check_monitor(workspace: Path) -> bool:
    path = workspace / "monitor" / "monitor.py"
    if not path.is_file():
        return False
    completed = run_python([str(path)], cwd=workspace, timeout=20, input_text=monitor_input())
    if completed is None or completed.returncode != 0:
        return False
    lines = completed.stdout.splitlines()
    if len(lines) != 1:
        return False
    try:
        value = json.loads(lines[0])
    except json.JSONDecodeError:
        return False
    return value == {
        "release_id": "2025.04.17.3",
        "column": "customer_status",
        "causal_timestamp": "2025-04-17T14:08:02.000Z",
        "first_application_error_timestamp": "2025-04-17T14:08:12.000Z",
        "affected_request_count": 2,
    }


def run_batch(workspace: Path, end: str) -> subprocess.CompletedProcess[str] | None:
    return run_python(
        [
            "-m", "solution.incident", "inputs/logs",
            "--window-start", "2025-04-17T14:00:00Z",
            "--window-end", end,
            "--output", "output",
        ],
        cwd=workspace,
    )


def evaluate_main(candidate: Path, workspace: Path) -> tuple[list[bool], bool, bool, list[str]]:
    notes: list[str] = []
    checks = [False] * 5
    parseable = False
    started = False
    try:
        prepare(candidate, workspace, "main")
        completed = run_batch(workspace, "2025-04-17T14:30:00Z")
        started = completed is not None
        if completed is None:
            notes.append("main command timed out")
            return checks, parseable, started, notes
        if completed.returncode != 0:
            notes.append(f"main command exited with status {completed.returncode}")
            return checks, parseable, started, notes
        rows = parse_timeline(workspace / "output" / "timeline.csv")
        report = (workspace / "output" / "incident_report.md").read_text(encoding="utf-8")
        parseable = True
        sources = source_set(rows)
        mapped = row_map(rows)

        checks[0] = (
            sources == MAIN_SOURCES
            and {row["source_file"].endswith(".gz") for row in rows} == {False, True}
            and all(row["service"] in {"access", "application", "deployment", "database"} for row in rows)
            and all(row["severity"] == row["severity"].upper() for row in rows)
        )
        checks[1] = (
            len(rows) == len(MAIN_SOURCES)
            and mapped[("access.log", "12345")]["request_id"] == "req-1001"
            and mapped[("application.log.gz", "20002")]["request_id"] == "req-1001"
            and all(mapped[key]["release_id"] == "2025.04.17.3" for key in MAIN_SOURCES)
            and [row["timestamp_utc"] for row in rows] == sorted(row["timestamp_utc"] for row in rows)
        )
        found_anchors = re.findall(
            r"(?:access\.log|application\.log\.gz|deployment\.log|db-extra\.log\.gz):\d+",
            report,
        )
        checks[2] = (
            len(found_anchors) == 3
            and set(found_anchors) == ANCHORS
            and rows.index(mapped[("deployment.log", "175000")])
            < rows.index(mapped[("application.log.gz", "20002")])
            < rows.index(mapped[("access.log", "12345")])
        )
        checks[3] = (
            all(
                mapped[key]["raw_timestamp"] == raw
                and mapped[key]["timestamp_utc"] == corrected
                for key, (raw, corrected) in MAIN_TIMESTAMPS.items()
            )
            and mapped[("deployment.log", "175000")]["event_code"] == "SCHEMA_CHANGE"
            and mapped[("db-extra.log.gz", "2345")]["event_code"] == "SCHEMA_APPLIED"
            and "2025.04.17.3" in report
            and "drop column customer_status" in report.casefold()
        )
        checks[4] = check_monitor(workspace)
    except (OSError, ValueError, csv.Error, UnicodeError, KeyError) as exc:
        notes.append(f"main outputs invalid: {type(exc).__name__}")
    except Exception as exc:
        notes.append(f"main evaluation failed: {type(exc).__name__}")
    return checks, parseable, started, notes


def evaluate_edge(candidate: Path, workspace: Path) -> tuple[bool, list[str]]:
    notes: list[str] = []
    try:
        prepare(candidate, workspace, "edge")
        completed = run_batch(workspace, "2025-04-18T14:30:00Z")
        if completed is None or completed.returncode != 0:
            notes.append("edge command failed or timed out")
            return False, notes
        rows = parse_timeline(workspace / "output" / "timeline.csv")
        sources = source_set(rows)
        return (
            sources == EDGE_SOURCES
            and ("access.log", "110") not in sources
            and all(not row["raw_timestamp"].startswith("2025-04-18") for row in rows)
        ), notes
    except Exception as exc:
        notes.append(f"edge evaluation failed: {type(exc).__name__}")
        return False, notes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    arguments = parser.parse_args()
    candidate = arguments.workspace.resolve()
    artifact = candidate / "solution" / "incident.py"
    if not artifact.is_file():
        print(json.dumps({
            "status": "fail",
            "progress_level": 0,
            "main_checks_passed": 0,
            "main_checks_total": 5,
            "edge_check_passed": False,
            "notes": ["solution/incident.py is missing"],
        }, sort_keys=True))
        return

    with tempfile.TemporaryDirectory(prefix="task13-judge-") as temporary:
        base = Path(temporary)
        checks, parseable, started, notes = evaluate_main(candidate, base / "main")
        edge_passed, edge_notes = evaluate_edge(candidate, base / "edge")
    notes.extend(edge_notes)
    for number, passed_check in enumerate(checks, 1):
        if not passed_check:
            notes.append(f"main semantic check {number} failed")

    passed = sum(checks)
    if not started:
        level = 1
    elif not parseable:
        level = 1
    elif passed == len(checks):
        level = 5 if edge_passed else 4
    elif passed:
        level = 3
    else:
        level = 2
    print(json.dumps({
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": len(checks),
        "edge_check_passed": edge_passed,
        "notes": notes,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
