#!/usr/bin/env python3
"""Direct main-and-edge judge for Task 09."""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path

TASK_DIR = Path(__file__).resolve().parent
FIELDS = ["ticket_id", "priority", "created_at", "first_response_minutes", "resolution_minutes", "first_response_breached", "resolution_breached", "status"]


def moment(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def calculate(inputs: Path) -> tuple[list[dict[str, str]], dict[str, object]]:
    targets = json.loads((inputs / "sla.json").read_text(encoding="utf-8"))
    seen: set[str] = set()
    tickets: dict[str, list[dict[str, object]]] = defaultdict(list)
    with (inputs / "events.jsonl").open(encoding="utf-8") as handle:
        for line in handle:
            item = json.loads(line)
            event_id = item["event_id"]
            if event_id in seen:
                continue
            seen.add(event_id)
            tickets[item["ticket_id"]].append(item)
    rows: list[dict[str, str]] = []
    counts = {priority: {"tickets": 0, "first_response_breaches": 0, "resolution_breaches": 0} for priority in sorted(targets)}
    for ticket_id, events in tickets.items():
        events.sort(key=lambda item: (moment(str(item["timestamp"])), str(item["event_id"])))
        created_event = next(item for item in events if item["type"] == "created")
        created = moment(str(created_event["timestamp"]))
        priority = str(created_event["priority"])
        first_reply = next((moment(str(item["timestamp"])) for item in events if item["type"] == "agent_reply" and moment(str(item["timestamp"])) > created), None)
        resolves = [moment(str(item["timestamp"])) for item in events if item["type"] == "resolved"]
        reopens = [moment(str(item["timestamp"])) for item in events if item["type"] == "reopened"]
        final = max(resolves) if resolves and (not reopens or max(resolves) > max(reopens)) else None
        waiting = None
        excluded = 0
        if final is not None:
            for item in events:
                when = moment(str(item["timestamp"]))
                if item["type"] == "waiting_customer" and waiting is None:
                    waiting = when
                elif item["type"] == "customer_reply" and waiting is not None:
                    start, end = max(waiting, created), min(when, final)
                    if end > start:
                        excluded += int((end - start).total_seconds() // 60)
                    waiting = None
        first_minutes = None if first_reply is None else int((first_reply - created).total_seconds() // 60)
        resolution_minutes = None if final is None else int((final - created).total_seconds() // 60) - excluded
        first_breach = first_minutes is None or first_minutes > int(targets[priority]["first_response_minutes"])
        resolution_breach = resolution_minutes is None or resolution_minutes > int(targets[priority]["resolution_minutes"])
        rows.append({
            "ticket_id": ticket_id,
            "priority": priority,
            "created_at": str(created_event["timestamp"]),
            "first_response_minutes": "" if first_minutes is None else str(first_minutes),
            "resolution_minutes": "" if resolution_minutes is None else str(resolution_minutes),
            "first_response_breached": str(first_breach).lower(),
            "resolution_breached": str(resolution_breach).lower(),
            "status": "resolved" if final is not None else "open",
        })
        counts[priority]["tickets"] += 1
        counts[priority]["first_response_breaches"] += int(first_breach)
        counts[priority]["resolution_breaches"] += int(resolution_breach)
    rows.sort(key=lambda row: row["ticket_id"])
    return rows, {"total_tickets": len(rows), "by_priority": counts}


def generate(root: Path, fixture: str) -> None:
    subprocess.run([sys.executable, str(TASK_DIR / "seed.py"), "--workspace", str(root), "--fixture", fixture], check=True, capture_output=True, timeout=20)
    subprocess.run([sys.executable, str(TASK_DIR / "visible/_generate.py"), "--output", str(root), "--fixture", fixture], check=True, capture_output=True, timeout=90)


def execute(candidate: Path, fixture: str):
    temporary = tempfile.TemporaryDirectory(prefix=f"pcbench-09-{fixture}-")
    root = Path(temporary.name)
    generate(root, fixture)
    if (candidate / "solution").is_dir():
        shutil.rmtree(root / "solution")
        shutil.copytree(candidate / "solution", root / "solution")
    completed = subprocess.run([sys.executable, "-E", "-S", "-m", "solution.sla_report", "inputs/events.jsonl", "inputs/sla.json", "--output", "output"], cwd=root, text=True, capture_output=True, timeout=90)
    return root, completed, temporary


def outputs(root: Path):
    raw_csv = (root / "output/tickets.csv").read_bytes()
    if b"\r" in raw_csv or not raw_csv.endswith(b"\n"):
        raise ValueError("CSV line endings")
    with (root / "output/tickets.csv").open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != FIELDS:
            raise ValueError("CSV header")
        rows = list(reader)
    raw_summary = (root / "output/summary.json").read_bytes()
    if b"\r" in raw_summary or not raw_summary.endswith(b"\n"):
        raise ValueError("JSON line endings")
    summary = json.loads(raw_summary)
    return rows, summary, raw_summary


def module_imports(root):
    result=subprocess.run([sys.executable,"-E","-S","-c","import solution.sla_report"],cwd=root,text=True,capture_output=True,timeout=10)
    return result.returncode==0

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "solution/sla_report.py").is_file()
    main_checks = [False] * 5
    runnable = parseable = False
    notes: list[str] = []
    main_tmp = edge_tmp = None
    try:
        if artifact:
            root, run, main_tmp = execute(candidate, "main")
            runnable = run.returncode == 0 or module_imports(root)
            if not runnable:
                notes.append("main command failed")
            else:
                try:
                    actual, summary, summary_raw = outputs(root)
                    wanted, wanted_summary = calculate(root / "inputs")
                    parseable = True
                    main_checks[0] = actual == wanted and len(actual) == 25000
                    actual_map = {row["ticket_id"]: row for row in actual}
                    main_checks[1] = all(actual_map[key]["first_response_minutes"] == wanted[int(key[-5:]) - 1]["first_response_minutes"] for key in ("T-00001", "T-00011", "T-00121"))
                    main_checks[2] = all(actual_map[key]["resolution_minutes"] == {row["ticket_id"]: row for row in wanted}[key]["resolution_minutes"] for key in ("T-00007", "T-00013", "T-00182"))
                    main_checks[3] = summary == wanted_summary
                    keys_sorted = list(summary) == sorted(summary) and list(summary["by_priority"]) == sorted(summary["by_priority"]) and all(list(item) == sorted(item) for item in summary["by_priority"].values())
                    main_checks[4] = summary_raw.endswith(b"\n") and keys_sorted and [row["ticket_id"] for row in actual] == sorted(row["ticket_id"] for row in actual) and all(row["first_response_breached"] in ("true", "false") and row["resolution_breached"] in ("true", "false") for row in actual)
                except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError, KeyError, StopIteration) as exc:
                    notes.append(f"main outputs invalid: {type(exc).__name__}")
        edge_ok = False
        if artifact:
            edge_root, edge_run, edge_tmp = execute(candidate, "edge")
            if edge_run.returncode == 0:
                try:
                    rows, summary, _ = outputs(edge_root)
                    wanted, wanted_summary = calculate(edge_root / "inputs")
                    edge_ok = rows == wanted and summary == wanted_summary and len(rows) == 1 and rows[0]["first_response_minutes"] == "10" and rows[0]["resolution_minutes"] == "90"
                except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError, KeyError, StopIteration):
                    pass
            else:
                notes.append("edge command failed")
    except (OSError, subprocess.SubprocessError) as exc:
        edge_ok = False
        notes.append(f"judge execution failed: {type(exc).__name__}")
    finally:
        if main_tmp is not None: main_tmp.cleanup()
        if edge_tmp is not None: edge_tmp.cleanup()
    passed = sum(main_checks)
    if not artifact or not runnable: level = 0
    elif not parseable: level = 1
    elif passed == len(main_checks): level = 5 if edge_ok else 4
    elif passed: level = 3
    else: level = 2
    print(json.dumps({"status": "pass" if level == 5 else "fail", "progress_level": level, "main_checks_passed": passed, "main_checks_total": len(main_checks), "edge_check_passed": edge_ok, "notes": notes}, sort_keys=True))


if __name__ == "__main__":
    main()
