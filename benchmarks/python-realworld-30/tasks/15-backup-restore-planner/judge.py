#!/usr/bin/env python3
"""Direct main-and-edge judge for Task 15."""
from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

TASK_DIR = Path(__file__).resolve().parent
PLAN_HEADER = ["path", "archive", "member", "member_timestamp", "size"]
WARNING_HEADER = ["path", "reason"]


def benchmark_python() -> str:
    executable = os.environ.get("PRIME_CONTEXT_BENCHMARK_PYTHON") or shutil.which("python3.12")
    if executable is None:
        raise RuntimeError("Python 3.12 is required")
    return executable

EXPECTED_PLAN = [
    {
        "path": "config/app.ini",
        "archive": "snapshot-03.tar",
        "member": "config/app.ini",
        "member_timestamp": "2025-05-01T11:00:00Z",
        "size": str(len(b"[service]\nworkers=5\n")),
    },
    {
        "path": "data/table.csv",
        "archive": "snapshot-02.zip",
        "member": "data/table.csv",
        "member_timestamp": "2025-04-29T19:20:00Z",
        "size": str(len(b"item,value\nA,2\nB,4\n")),
    },
    {
        "path": "docs/report.txt",
        "archive": "snapshot-02.zip",
        "member": "docs/report.txt",
        "member_timestamp": "2025-04-20T16:45:00Z",
        "size": str(len(b"quarterly report: approved\n")),
    },
    {
        "path": "images/logo.bin",
        "archive": "snapshot-03.tar",
        "member": "images/logo.bin",
        "member_timestamp": "2025-04-30T23:59:58Z",
        "size": str(len(b"\x89RESTORE\x00LOGO\xff\n")),
    },
]
EXPECTED_BYTES = {
    "config/app.ini": b"[service]\nworkers=5\n",
    "data/table.csv": b"item,value\nA,2\nB,4\n",
    "docs/report.txt": b"quarterly report: approved\n",
    "images/logo.bin": b"\x89RESTORE\x00LOGO\xff\n",
}
EXPECTED_WARNINGS = [
    {"path": "missing/not-there.txt", "reason": "no_eligible_version"},
    {"path": "old/expired.txt", "reason": "no_eligible_version"},
]


def read_csv(path: Path, header: list[str]) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != header:
            raise ValueError(f"unexpected header in {path.name}")
        rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError(f"malformed row in {path.name}")
    return rows


def prepare(candidate: Path, fixture: str):
    temporary = tempfile.TemporaryDirectory(prefix=f"task15-{fixture}-")
    base = Path(temporary.name)
    workspace = base / "workspace"
    subprocess.run(
        [benchmark_python(), "-E", "-S", str(TASK_DIR / "seed.py"), "--workspace", str(workspace), "--fixture", fixture],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=10,
    )
    source = candidate / "solution"
    if source.is_dir():
        shutil.copytree(source, workspace / "solution")
    try:
        completed = subprocess.run(
            [benchmark_python(), "-E", "-S", "-m", "solution.restore_plan", "inputs", "--output", "output"],
            cwd=workspace,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            text=True,
            timeout=20,
        )
    except subprocess.TimeoutExpired:
        completed = None
    return temporary, base, workspace, completed


def main_checks(candidate: Path, notes: list[str]):
    checks = [False] * 5
    parseable = False
    temporary = None
    try:
        temporary, _base, workspace, completed = prepare(candidate, "main")
        checks[0] = completed is not None and completed.returncode == 0
        if not checks[0]:
            notes.append("main command failed or timed out")
            return checks, parseable
        try:
            plan = read_csv(workspace / "output" / "restore_plan.csv", PLAN_HEADER)
            warnings = read_csv(workspace / "output" / "warnings.csv", WARNING_HEADER)
            restored = workspace / "output" / "restored"
            if not restored.is_dir():
                raise ValueError("restored directory is absent")
            parseable = True
        except (OSError, UnicodeError, csv.Error, ValueError) as exc:
            notes.append(f"main outputs invalid: {type(exc).__name__}")
            return checks, parseable

        checks[1] = [
            (row["path"], row["archive"], row["member"]) for row in plan
        ] == [
            (row["path"], row["archive"], row["member"]) for row in EXPECTED_PLAN
        ]
        checks[2] = plan == EXPECTED_PLAN
        actual_files = {
            path.relative_to(restored).as_posix(): path.read_bytes()
            for path in restored.rglob("*") if path.is_file()
        }
        checks[3] = actual_files == EXPECTED_BYTES
        checks[4] = warnings == EXPECTED_WARNINGS
        return checks, parseable
    finally:
        if temporary is not None:
            temporary.cleanup()


def edge_check(candidate: Path, notes: list[str]) -> bool:
    temporary = None
    try:
        temporary, base, workspace, completed = prepare(candidate, "edge")
        if completed is None or completed.returncode != 0:
            notes.append("edge command failed or timed out")
            return False
        try:
            plan = read_csv(workspace / "output" / "restore_plan.csv", PLAN_HEADER)
            warnings = read_csv(workspace / "output" / "warnings.csv", WARNING_HEADER)
        except (OSError, UnicodeError, csv.Error, ValueError):
            return False
        escaped = []
        inputs = workspace / "inputs"
        for path in base.rglob("requested.txt"):
            if path.is_file() and inputs not in path.parents:
                escaped.append(path)
        restored = workspace / "output" / "restored"
        restored_files = list(restored.rglob("*")) if restored.exists() else []
        return (
            plan == []
            and warnings == [{"path": "requested.txt", "reason": "unsafe_member"}]
            and not escaped
            and not any(path.is_file() for path in restored_files)
        )
    finally:
        if temporary is not None:
            temporary.cleanup()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "solution" / "restore_plan.py").is_file()
    notes: list[str] = []
    if artifact:
        checks, parseable = main_checks(candidate, notes)
        edge = edge_check(candidate, notes)
    else:
        checks, parseable, edge = [False] * 5, False, False
        notes.append("solution/restore_plan.py is absent")

    passed = sum(checks)
    if not artifact:
        level = 0
    elif not checks[0]:
        level = 1
    elif not parseable:
        level = 1
    elif passed == len(checks):
        level = 5 if edge else 4
    elif passed:
        level = 3
    else:
        level = 2
    result = {
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": len(checks),
        "edge_check_passed": edge,
        "notes": notes,
    }
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
