#!/usr/bin/env python3
"""Direct hermetic judge for Task 12: Webhook Receiver and Replay."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import select
import shutil
import sqlite3
import subprocess
import tempfile
import time
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen


TASK_DIR = Path(__file__).resolve().parent
def benchmark_python() -> str:
    executable = os.environ.get("PRIME_CONTEXT_BENCHMARK_PYTHON") or shutil.which("python3.12")
    if executable is None:
        raise RuntimeError("Python 3.12 is required")
    return executable


MAIN_CHECK_NAMES = (
    "receiver HTTP behavior",
    "happy-path delivery",
    "persistent retry schedule",
    "failed-event replay",
    "external-ID idempotency",
)


class JudgeError(RuntimeError):
    """A command or fixture failed before a semantic result was available."""


def stop_process(process: subprocess.Popen[str] | None) -> None:
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=3)


def start_ready_process(
    command: list[str], cwd: Path, label: str
) -> tuple[subprocess.Popen[str], int]:
    process = subprocess.Popen(
        command,
        cwd=cwd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    assert process.stdout is not None
    ready, _, _ = select.select([process.stdout], [], [], 6)
    if not ready:
        stop_process(process)
        raise JudgeError(f"{label} did not announce readiness")
    line = process.stdout.readline().strip()
    parts = line.split()
    if len(parts) != 2 or parts[0] != "LISTENING" or not parts[1].isdigit():
        stop_process(process)
        raise JudgeError(f"{label} returned an invalid readiness line")
    return process, int(parts[1])


def prepare_workspace(candidate_workspace: Path, destination: Path, fixture: str) -> None:
    seeded = subprocess.run(
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
        cwd=TASK_DIR,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if seeded.returncode != 0:
        raise JudgeError("seed.py failed")
    starter = destination / "webhook_app"
    if starter.exists():
        shutil.rmtree(starter)
    shutil.copytree(
        candidate_workspace / "webhook_app",
        starter,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
    )


def run_command(workspace: Path, arguments: list[str]) -> None:
    completed = subprocess.run(
        [benchmark_python(), "-E", "-S", "-m", "webhook_app", *arguments],
        cwd=workspace,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if completed.returncode != 0:
        detail = completed.stderr.strip().splitlines()
        suffix = f": {detail[-1][:160]}" if detail else ""
        raise JudgeError(f"{' '.join(arguments[:1])} command failed{suffix}")


def start_receiver(workspace: Path) -> tuple[subprocess.Popen[str], str]:
    process, port = start_ready_process(
        [
            benchmark_python(),
            "-E",
            "-S",
            "-m",
            "webhook_app",
            "serve",
            "--db",
            "workspace/webhooks.db",
            "--port",
            "0",
        ],
        workspace,
        "receiver",
    )
    return process, f"http://127.0.0.1:{port}"


def start_sink(mode: str, log_path: Path) -> tuple[subprocess.Popen[str], str]:
    process, port = start_ready_process(
        [
            benchmark_python(),
            "-E",
            "-S",
            str(TASK_DIR / "sink_service.py"),
            "--port",
            "0",
            "--mode",
            mode,
            "--log",
            str(log_path),
        ],
        TASK_DIR,
        "sink",
    )
    return process, f"http://127.0.0.1:{port}/sink"


def http_request(
    url: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    request = Request(url, data=body, headers=headers or {}, method=method)
    try:
        with urlopen(request, timeout=4) as response:
            return response.status, response.read()
    except HTTPError as exc:
        return exc.code, exc.read()


def json_request(
    url: str,
    *,
    method: str = "GET",
    value: object | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, Any]:
    body = None
    actual_headers = dict(headers or {})
    if value is not None:
        body = json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")
        actual_headers["Content-Type"] = "application/json"
    status, raw = http_request(
        url, method=method, body=body, headers=actual_headers
    )
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise JudgeError("receiver returned a non-JSON response") from exc
    return status, decoded


def event_state(base_url: str, event_id: int) -> tuple[int, dict[str, Any]]:
    status, value = json_request(f"{base_url}/events/{event_id}")
    if not isinstance(value, dict):
        raise JudgeError("event status response is not an object")
    return status, value


def accepted_id(status: int, value: Any) -> int | None:
    if status not in (200, 202) or not isinstance(value, dict):
        return None
    event_id = value.get("id")
    if isinstance(event_id, int) and not isinstance(event_id, bool) and event_id > 0:
        return event_id
    return None


def state_matches(
    state: tuple[int, dict[str, Any]],
    *,
    event_id: int,
    status: str,
    attempts: int,
    next_at: str | None,
) -> bool:
    code, value = state
    return (
        code == 200
        and value.get("id") == event_id
        and value.get("status") == status
        and value.get("attempt_count") == attempts
        and value.get("next_attempt_at") == next_at
    )


def worker(workspace: Path, now: str) -> None:
    run_command(
        workspace,
        [
            "worker",
            "--db",
            "workspace/webhooks.db",
            "--sink-url-file",
            "inputs/sink_url.txt",
            "--now",
            now,
        ],
    )


def read_sink_records(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    records: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        value = json.loads(line)
        if isinstance(value, dict):
            records.append(value)
    return records


def kind_count(records: list[dict[str, Any]], kind: str) -> int:
    return sum(record.get("kind") == kind for record in records)


def database_event_count(path: Path) -> int:
    with sqlite3.connect(path) as connection:
        row = connection.execute("SELECT COUNT(*) FROM events").fetchone()
    return int(row[0])


def evaluate_main(candidate_workspace: Path, destination: Path) -> dict[str, Any]:
    checks = [False] * len(MAIN_CHECK_NAMES)
    result: dict[str, Any] = {
        "checks": checks,
        "started": False,
        "structured": False,
        "notes": [],
    }
    receiver: subprocess.Popen[str] | None = None
    sink: subprocess.Popen[str] | None = None
    try:
        prepare_workspace(candidate_workspace, destination, "main")
        sink_log = destination / "sink.jsonl"
        sink, sink_url = start_sink("judge-main", sink_log)
        (destination / "inputs" / "sink_url.txt").write_text(
            sink_url + "\n", encoding="utf-8"
        )
        receiver, base_url = start_receiver(destination)
        result["started"] = True

        happy_payload = {"kind": "happy", "reference": "main-alpha", "value": 17}
        retry_payload = {"kind": "retry", "reference": "main-retry", "value": 23}
        duplicate_payload = {
            "kind": "duplicate",
            "reference": "external-original",
            "value": 31,
        }
        changed_duplicate = {
            "kind": "duplicate",
            "reference": "must-not-replace",
            "value": 99,
        }

        happy_status, happy_body = json_request(
            f"{base_url}/events", method="POST", value=happy_payload
        )
        retry_status, retry_body = json_request(
            f"{base_url}/events", method="POST", value=retry_payload
        )
        first_dup_status, first_dup_body = json_request(
            f"{base_url}/events",
            method="POST",
            value=duplicate_payload,
            headers={"X-Event-ID": "source-event-001"},
        )
        second_dup_status, second_dup_body = json_request(
            f"{base_url}/events",
            method="POST",
            value=changed_duplicate,
            headers={"X-Event-ID": "source-event-001"},
        )
        happy_id = accepted_id(happy_status, happy_body)
        retry_id = accepted_id(retry_status, retry_body)
        duplicate_id = accepted_id(first_dup_status, first_dup_body)
        second_duplicate_id = accepted_id(second_dup_status, second_dup_body)
        if None in (happy_id, retry_id, duplicate_id, second_duplicate_id):
            raise JudgeError("event acceptance response lacks a numeric ID")
        assert happy_id is not None
        assert retry_id is not None
        assert duplicate_id is not None
        assert second_duplicate_id is not None
        result["structured"] = True

        initial_happy = event_state(base_url, happy_id)
        missing_status, _ = json_request(f"{base_url}/events/999999")
        checks[0] = (
            happy_status == 202
            and retry_status == 202
            and first_dup_status == 202
            and len({happy_id, retry_id, duplicate_id}) == 3
            and state_matches(
                initial_happy,
                event_id=happy_id,
                status="pending",
                attempts=0,
                next_at=None,
            )
            and missing_status == 404
        )

        worker(destination, "2025-07-01T12:00:00Z")
        first_records = read_sink_records(sink_log)
        happy_after = event_state(base_url, happy_id)
        retry_after_one = event_state(base_url, retry_id)
        duplicate_after = event_state(base_url, duplicate_id)
        checks[1] = (
            state_matches(
                happy_after,
                event_id=happy_id,
                status="delivered",
                attempts=1,
                next_at=None,
            )
            and [record.get("kind") for record in first_records[:3]]
            == ["happy", "retry", "duplicate"]
            and any(
                record.get("kind") == "happy"
                and record.get("path") == "/sink"
                and record.get("payload") == happy_payload
                and str(record.get("content_type", "")).lower() == "application/json"
                for record in first_records
            )
        )

        retry_conditions = [
            state_matches(
                retry_after_one,
                event_id=retry_id,
                status="pending",
                attempts=1,
                next_at="2025-07-01T12:01:00Z",
            )
        ]
        retry_count = kind_count(first_records, "retry")
        worker(destination, "2025-07-01T12:00:59Z")
        retry_conditions.append(
            kind_count(read_sink_records(sink_log), "retry") == retry_count
        )

        # A fresh receiver must see the worker's durable state.
        stop_process(receiver)
        receiver = None
        receiver, base_url = start_receiver(destination)
        retry_conditions.append(
            state_matches(
                event_state(base_url, retry_id),
                event_id=retry_id,
                status="pending",
                attempts=1,
                next_at="2025-07-01T12:01:00Z",
            )
        )

        worker(destination, "2025-07-01T12:01:00Z")
        retry_conditions.append(
            state_matches(
                event_state(base_url, retry_id),
                event_id=retry_id,
                status="pending",
                attempts=2,
                next_at="2025-07-01T12:03:00Z",
            )
        )
        retry_count = kind_count(read_sink_records(sink_log), "retry")
        worker(destination, "2025-07-01T12:02:59Z")
        retry_conditions.append(
            kind_count(read_sink_records(sink_log), "retry") == retry_count
        )
        worker(destination, "2025-07-01T12:03:00Z")
        retry_conditions.append(
            state_matches(
                event_state(base_url, retry_id),
                event_id=retry_id,
                status="pending",
                attempts=3,
                next_at="2025-07-01T12:07:00Z",
            )
        )
        worker(destination, "2025-07-01T12:07:00Z")
        retry_conditions.append(
            state_matches(
                event_state(base_url, retry_id),
                event_id=retry_id,
                status="failed",
                attempts=4,
                next_at=None,
            )
        )
        retry_conditions.append(
            kind_count(read_sink_records(sink_log), "retry") == 4
        )
        checks[2] = all(retry_conditions)

        run_command(
            destination,
            ["replay", "--db", "workspace/webhooks.db", "--failed"],
        )
        replay_conditions = [
            state_matches(
                event_state(base_url, retry_id),
                event_id=retry_id,
                status="pending",
                attempts=4,
                next_at=None,
            )
        ]
        worker(destination, "2025-07-01T12:10:00Z")
        replay_conditions.append(
            state_matches(
                event_state(base_url, retry_id),
                event_id=retry_id,
                status="pending",
                attempts=5,
                next_at="2025-07-01T12:11:00Z",
            )
        )
        replay_count = kind_count(read_sink_records(sink_log), "retry")
        worker(destination, "2025-07-01T12:10:59Z")
        replay_conditions.append(
            kind_count(read_sink_records(sink_log), "retry") == replay_count
        )
        worker(destination, "2025-07-01T12:11:00Z")
        replay_conditions.append(
            state_matches(
                event_state(base_url, retry_id),
                event_id=retry_id,
                status="delivered",
                attempts=6,
                next_at=None,
            )
        )
        replay_conditions.append(
            kind_count(read_sink_records(sink_log), "retry") == 6
        )
        checks[3] = all(replay_conditions)

        final_records = read_sink_records(sink_log)
        duplicate_records = [
            record for record in final_records if record.get("kind") == "duplicate"
        ]
        checks[4] = (
            second_dup_status == 200
            and second_duplicate_id == duplicate_id
            and state_matches(
                duplicate_after,
                event_id=duplicate_id,
                status="delivered",
                attempts=1,
                next_at=None,
            )
            and len(duplicate_records) == 1
            and duplicate_records[0].get("payload") == duplicate_payload
            and database_event_count(destination / "workspace" / "webhooks.db") == 3
        )
    except Exception as exc:
        result["notes"].append(f"main evaluation stopped: {type(exc).__name__}: {exc}")
    finally:
        stop_process(receiver)
        stop_process(sink)
    return result


def evaluate_edge(candidate_workspace: Path, destination: Path) -> tuple[bool, list[str]]:
    notes: list[str] = []
    receiver: subprocess.Popen[str] | None = None
    try:
        prepare_workspace(candidate_workspace, destination, "edge")
        receiver, base_url = start_receiver(destination)
        malformed = (destination / "inputs" / "invalid_event.txt").read_bytes()
        status, _ = http_request(
            f"{base_url}/events",
            method="POST",
            body=malformed,
            headers={"Content-Type": "application/json"},
        )
        missing_status, _ = json_request(f"{base_url}/events/1")
        count = database_event_count(destination / "workspace" / "webhooks.db")
        return status == 400 and missing_status == 404 and count == 0, notes
    except Exception as exc:
        notes.append(f"edge evaluation stopped: {type(exc).__name__}: {exc}")
        return False, notes
    finally:
        stop_process(receiver)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate_workspace = args.workspace.resolve()
    artifact = candidate_workspace / "webhook_app" / "__main__.py"

    if not artifact.is_file():
        result = {
            "status": "fail",
            "progress_level": 0,
            "main_checks_passed": 0,
            "main_checks_total": len(MAIN_CHECK_NAMES),
            "edge_check_passed": False,
            "notes": ["webhook_app/__main__.py is missing"],
        }
        print(json.dumps(result, sort_keys=True))
        return 0

    with tempfile.TemporaryDirectory(prefix="task12-judge-") as temporary:
        temporary_path = Path(temporary)
        main_result = evaluate_main(
            candidate_workspace, temporary_path / "main-workspace"
        )
        edge_passed, edge_notes = evaluate_edge(
            candidate_workspace, temporary_path / "edge-workspace"
        )

    checks = list(main_result["checks"])
    passed = sum(bool(value) for value in checks)
    if not main_result["started"]:
        level = 0
    elif passed == len(checks):
        level = 5 if edge_passed else 4
    elif passed:
        level = 3
    elif main_result["structured"]:
        level = 2
    else:
        level = 1

    notes = list(main_result["notes"]) + edge_notes
    for name, check in zip(MAIN_CHECK_NAMES, checks):
        if not check:
            notes.append(f"main check failed: {name}")
    if not edge_passed:
        notes.append("edge check failed: invalid JSON created state or did not return 400")

    result = {
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": len(checks),
        "edge_check_passed": edge_passed,
        "notes": notes,
    }
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
