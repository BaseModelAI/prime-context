#!/usr/bin/env python3
"""Run the persisted 30-task Prime Agent / Prime Context benchmark."""

from __future__ import annotations

import argparse
import concurrent.futures
import ipaddress
import json
import os
from pathlib import Path
import queue
import re
import select
import shutil
import socket
import socketserver
import subprocess
import sys
import tarfile
import threading
import time
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TASK_SET = Path(__file__).resolve().parent / "realistic-30"
DEFAULT_CLI = PROJECT_ROOT / "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js"
_NETWORK_LOCK = threading.Lock()
_NETWORK_INDEX = (os.getpid() * 97) % 262144
_PROXY_ALLOWED_HOST_SUFFIXES = (
    "openai.com",
    "chatgpt.com",
    "github.com",
    "githubusercontent.com",
    "pypi.org",
    "pythonhosted.org",
)
_MAX_MANUAL_COMPACTION_ATTEMPTS = 2


def retryable_compaction_error(error: object) -> bool:
    text = str(error).lower()
    return any(marker in text for marker in (
        "server_error",
        "temporarily unavailable",
        "overloaded",
        "timed out after 30000ms",
    ))


def compaction_end_succeeded(event: dict[str, Any]) -> bool:
    return not bool(event.get("aborted")) and not bool(event.get("errorMessage"))


def parse_task_ids(value: str, available: set[int]) -> list[int]:
    if value == "all":
        return sorted(available)
    selected: set[int] = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start_text, end_text = part.split("-", 1)
            start, end = int(start_text), int(end_text)
            if start > end:
                raise ValueError(f"invalid descending task range: {part}")
            selected.update(range(start, end + 1))
        else:
            selected.add(int(part))
    missing = sorted(selected - available)
    if missing:
        raise ValueError(f"unknown task ids: {missing}")
    return sorted(selected)


def load_task_index() -> dict[int, Path]:
    payload = json.loads((TASK_SET / "tasks.json").read_text())
    return {int(item["id"]): TASK_SET / item["path"] for item in payload["tasks"]}


def package_root(start: Path) -> tuple[Path, dict[str, Any]]:
    current = start.parent if start.is_file() else start
    for directory in [current, *current.parents]:
        package_json = directory / "package.json"
        if package_json.exists():
            try:
                return directory, json.loads(package_json.read_text())
            except (json.JSONDecodeError, OSError) as exc:
                raise RuntimeError(f"cannot read package metadata at {package_json}") from exc
    raise RuntimeError(f"no package.json found above {start}")


def read_package_version(start: Path) -> str | None:
    try:
        return str(package_root(start)[1].get("version"))
    except RuntimeError:
        return None


def unpack_package(tarball: Path, destination: Path) -> Path:
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(tarball, "r:gz") as archive:
        for member in archive.getmembers():
            parts = Path(member.name).parts
            if not parts or parts[0] != "package" or ".." in parts:
                continue
            member.name = str(Path(*parts[1:]))
            if member.name != ".":
                archive.extract(member, destination)
    if not (destination / "package.json").exists():
        raise RuntimeError(f"{tarball} did not contain an npm package")
    return destination


def freeze_prime_agent(cli: Path, output_root: Path) -> Path:
    source_root, metadata = package_root(cli)
    package_name = metadata.get("name")
    if not package_name:
        raise RuntimeError(f"Prime Agent package has no name: {source_root / 'package.json'}")
    relative_cli = cli.relative_to(source_root)
    downloads = output_root / "_frozen" / "downloads"
    install_root = output_root / "_frozen" / "prime-agent-host"
    downloads.mkdir(parents=True, exist_ok=True)
    install_root.mkdir(parents=True, exist_ok=True)
    completed = subprocess.run(
        ["npm", "pack", str(source_root), "--json", "--pack-destination", str(downloads)],
        text=True,
        capture_output=True,
        check=True,
        timeout=180,
    )
    packed = json.loads(completed.stdout)
    tarball = downloads / packed[0]["filename"]
    (install_root / "package.json").write_text(json.dumps({"private": True}) + "\n")
    subprocess.run(
        ["npm", "install", "--no-audit", "--no-fund", "--prefix", str(install_root), str(tarball)],
        text=True,
        capture_output=True,
        check=True,
        timeout=300,
    )
    frozen_cli = install_root / "node_modules" / package_name / relative_cli
    if not frozen_cli.exists():
        raise RuntimeError(f"frozen Prime Agent CLI not found: {frozen_cli}")
    return frozen_cli


def freeze_prime_context(source: str, output_root: Path) -> Path:
    frozen = output_root / "_frozen" / "prime-agent-context"
    downloads = output_root / "_frozen" / "downloads"
    downloads.mkdir(parents=True, exist_ok=True)
    source_path = Path(source).expanduser()
    if source_path.is_file() and source_path.suffix == ".tgz":
        tarball = source_path.resolve()
    else:
        npm_source = str(source_path.resolve()) if source_path.exists() else source.removeprefix("npm:")
        completed = subprocess.run(
            ["npm", "pack", npm_source, "--json", "--pack-destination", str(downloads)],
            text=True,
            capture_output=True,
            check=True,
            timeout=180,
        )
        packed = json.loads(completed.stdout)
        tarball = downloads / packed[0]["filename"]
    return unpack_package(tarball, frozen)


def text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            str(block.get("text", ""))
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        )
    return ""


_TEST_RESULT_LINE = re.compile(r"^TEST_RESULT (PASS|FAIL) (\d+)/(\d+)\r?$", re.MULTILINE)


def test_result_summary(body: str) -> dict[str, Any] | None:
    matches = list(_TEST_RESULT_LINE.finditer(body))
    if not matches:
        return None
    status, passing, total = matches[-1].groups()
    return {"status": status, "passing": int(passing), "total": int(total)}


def rpc_tool_results(event: dict[str, Any]) -> list[dict[str, Any]]:
    if event.get("type") in {"tool_execution_end", "tool_execution_update"}:
        result = event.get("result") if event.get("type") == "tool_execution_end" else event.get("partialResult")
        result = result if isinstance(result, dict) else {}
        return [{
            "tool_call_id": str(event.get("toolCallId")),
            "tool_name": event.get("toolName"),
            "is_error": bool(event.get("isError")),
            "body": text_content(result.get("content")),
        }]
    if event.get("type") != "turn_end":
        return []
    results: list[dict[str, Any]] = []
    for item in event.get("toolResults") or []:
        if not isinstance(item, dict):
            continue
        results.append({
            "tool_call_id": str(item.get("toolCallId")),
            "tool_name": item.get("toolName"),
            "is_error": bool(item.get("isError")),
            "body": text_content(item.get("content")),
        })
    return results


def copy_stage(source: Path, work: Path) -> None:
    for path in source.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(source)
        target = work / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(path.read_bytes())


def clean_environment(config: Path, pc_home: Path, home: Path) -> dict[str, str]:
    environment = dict(os.environ)
    for key in list(environment):
        if key.startswith("PRIME_AGENT_INTERNAL_"):
            environment.pop(key, None)
    for key in ["PI_OFFLINE", "DO_NOT_TRACK", "FORCE_COLOR"]:
        environment.pop(key, None)
    environment.update(
        {
            "PRIME_AGENT_CODING_AGENT_DIR": str(config),
            "PRIME_CONTEXT_HOME": str(pc_home),
            "PRIME_AGENT_TELEMETRY": "0",
            "HOME": str(home),
            "NO_COLOR": "1",
        }
    )
    return environment


def run_rpc(
    command: list[str],
    work: Path,
    environment: dict[str, str],
    run_root: Path,
    task_dir: Path,
    scenario: dict[str, Any],
    timeout_seconds: int,
) -> dict[str, Any]:
    event_queue: queue.Queue[str | None] = queue.Queue()
    assistant_outputs: list[str] = []
    interventions: list[dict[str, Any]] = []
    responses: dict[str, bool] = {}
    test_runs: list[dict[str, Any]] = []
    goal_updates: list[dict[str, Any]] = []
    compactions: list[dict[str, Any]] = []
    compaction_requests: list[dict[str, Any]] = []
    compaction_waits: list[dict[str, Any]] = []
    test_calls: dict[str, str] = {}
    processed_tool_results: set[str] = set()
    pending_tool_results: dict[str, dict[str, Any]] = {}
    prompts = {item["stage"]: item for item in scenario["prompts"]}
    event_number = 0
    stderr_path = run_root / "rpc-stderr.txt"
    events_path = run_root / "rpc-events.jsonl"

    with stderr_path.open("w") as stderr_handle, events_path.open("w") as event_log:
        process = subprocess.Popen(
            command,
            cwd=work,
            env=environment,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=stderr_handle,
            text=True,
            bufsize=1,
        )
        assert process.stdin is not None and process.stdout is not None

        def reader() -> None:
            for line in process.stdout:
                event_queue.put(line)
            event_queue.put(None)

        threading.Thread(target=reader, daemon=True).start()
        command_counter = 0
        stage = "initial"
        baseline_steer_sent = False
        pivot_sent = False
        followup_sent = False
        lock_sent = False
        early_complete = False
        goal_complete = False
        baseline_ready = False
        followup_ready = False
        compaction_active = False
        compaction_request_pending = False
        pending_manual_compaction: dict[str, Any] | None = None
        compaction_attempts: dict[str, int] = {}

        def send(kind: str, text: str, label: str) -> None:
            nonlocal command_counter
            command_counter += 1
            request_id = f"cmd-{command_counter}-{label}"
            process.stdin.write(json.dumps({"id": request_id, "type": kind, "message": text}) + "\n")
            process.stdin.flush()
            interventions.append(
                {
                    "label": label,
                    "kind": kind,
                    "id": request_id,
                    "event_number": event_number,
                    "compactions_before": len(compactions),
                }
            )

        def request_compaction(label: str) -> None:
            nonlocal command_counter, compaction_request_pending, pending_manual_compaction
            command_counter += 1
            request_id = f"cmd-{command_counter}-{label}"
            attempt = compaction_attempts.get(label, 0) + 1
            compaction_attempts[label] = attempt
            process.stdin.write(json.dumps({"id": request_id, "type": "compact"}) + "\n")
            process.stdin.flush()
            compaction_requests.append({
                "label": label,
                "id": request_id,
                "attempt": attempt,
                "event_number": event_number,
                "compactions_before": len(compactions),
                "lifecycle_resolved": False,
            })
            pending_manual_compaction = None
            compaction_request_pending = True

        def request_compaction_wait(label: str) -> None:
            nonlocal command_counter
            # A short session did not attempt provider summarization, so it
            # must not consume the one bounded transient retry.
            compaction_attempts[label] = max(0, compaction_attempts.get(label, 1) - 1)
            command_counter += 1
            request_id = f"cmd-{command_counter}-wait-after-{label}"
            message = (
                "The required compaction checkpoint is not available because the session is still too short. "
                "Without changing files, running tools, or inferring future requirements, briefly recap the "
                "completed current stage and its test result. Keep the goal active and wait for the next requirement."
            )
            process.stdin.write(json.dumps({"id": request_id, "type": "steer", "message": message}) + "\n")
            process.stdin.flush()
            compaction_waits.append({
                "label": label,
                "id": request_id,
                "event_number": event_number,
            })

        def complete_compaction(item: dict[str, Any]) -> None:
            nonlocal stage, pivot_sent, lock_sent
            compactions.append(item)
            if baseline_ready and not pivot_sent:
                copy_stage(task_dir / "pivot", work)
                stage = "pivot"
                send("steer", prompts["pivot"]["text"], "steer-pivot")
                pivot_sent = True
            elif followup_ready and not lock_sent:
                stage = "lock"
                send("steer", prompts["lock"]["text"], "steer-final-lock")
                lock_sent = True

        def active_compaction_request() -> dict[str, Any] | None:
            return next(
                (item for item in reversed(compaction_requests) if not item.get("lifecycle_resolved")),
                None,
            )

        def retry_failed_compaction(item: dict[str, Any], error: object) -> None:
            nonlocal compaction_request_pending, pending_manual_compaction
            item["lifecycle_resolved"] = True
            compaction_request_pending = False
            pending_manual_compaction = None
            if item["attempt"] >= _MAX_MANUAL_COMPACTION_ATTEMPTS:
                raise RuntimeError(
                    f"manual compaction failed after {item['attempt']} attempts: {error}"
                )
            request_compaction(item["label"])

        def record_test_result(result: dict[str, Any]) -> None:
            nonlocal baseline_steer_sent, baseline_ready, followup_sent, followup_ready, stage
            tool_call_id = result["tool_call_id"]
            if tool_call_id in processed_tool_results:
                return
            summary = test_result_summary(result["body"])
            if result["tool_name"] != "ipython" or summary is None:
                return
            processed_tool_results.add(tool_call_id)
            run_stage = test_calls.pop(tool_call_id, stage)
            test_runs.append({
                "stage": run_stage,
                "event_number": event_number,
                "is_error": result["is_error"],
                "result_head": result["body"][:1500],
                "pass": summary["status"] == "PASS",
                "passing": summary["passing"],
                "total": summary["total"],
            })
            if run_stage == "initial" and not baseline_steer_sent:
                send("steer", prompts["steering"]["text"], "steer-baseline")
                baseline_steer_sent = True
            elif run_stage == "initial" and summary["status"] == "PASS" and not pivot_sent:
                baseline_ready = True
            elif run_stage == "pivot" and not followup_sent:
                copy_stage(task_dir / "followup", work)
                stage = "followup"
                send("steer", prompts["followup"]["text"], "steer-followup")
                followup_sent = True
            elif run_stage == "followup" and not lock_sent:
                followup_ready = True

        def remember_partial_test_result(event: dict[str, Any]) -> None:
            for result in rpc_tool_results(event):
                if result["tool_name"] == "ipython" and test_result_summary(result["body"]) is not None:
                    pending_tool_results[result["tool_call_id"]] = result

        def flush_pending_test_results() -> None:
            results = list(pending_tool_results.values())
            pending_tool_results.clear()
            for result in results:
                record_test_result(result)

        instruction_started = time.monotonic()
        send("prompt", prompts["initial"]["text"], "initial")
        deadline = instruction_started + timeout_seconds
        rpc_error: str | None = None
        try:
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f"condition timed out after {timeout_seconds} seconds")
                try:
                    line = event_queue.get(timeout=remaining)
                except queue.Empty as exc:
                    raise TimeoutError(f"condition timed out after {timeout_seconds} seconds") from exc
                if line is None:
                    raise RuntimeError("RPC process exited before goal completion")
                event_log.write(line)
                event_log.flush()
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                event_number += 1
                kind = event.get("type")
                if kind == "response":
                    request_id = str(event.get("id"))
                    success = bool(event.get("success"))
                    responses[request_id] = success
                    compaction_request = next(
                        (item for item in compaction_requests if item["id"] == request_id),
                        None,
                    )
                    if compaction_request is not None:
                        response_error = event.get("error")
                        compaction_request["success"] = success
                        compaction_request["error"] = response_error
                        if not compaction_request.get("lifecycle_resolved"):
                            if pending_manual_compaction is not None:
                                lifecycle = pending_manual_compaction
                                lifecycle_error = lifecycle.get("errorMessage")
                                if compaction_end_succeeded(lifecycle):
                                    compaction_request["lifecycle_resolved"] = True
                                    compaction_request_pending = False
                                    pending_manual_compaction = None
                                    complete_compaction(lifecycle)
                                elif lifecycle.get("willRetry"):
                                    pass
                                elif "Session is too short to compact" in str(response_error or lifecycle_error):
                                    compaction_request["lifecycle_resolved"] = True
                                    compaction_request_pending = False
                                    pending_manual_compaction = None
                                    request_compaction_wait(compaction_request["label"])
                                elif retryable_compaction_error(response_error or lifecycle_error):
                                    retry_failed_compaction(
                                        compaction_request,
                                        response_error or lifecycle_error,
                                    )
                                else:
                                    raise RuntimeError(
                                        f"manual compaction failed: {response_error or lifecycle_error}"
                                    )
                            elif not success and "Session is too short to compact" in str(response_error):
                                compaction_request["lifecycle_resolved"] = True
                                compaction_request_pending = False
                                request_compaction_wait(compaction_request["label"])
                            # Other responses can precede compaction_end. Keep the
                            # request pending until that authoritative lifecycle event.
                    compaction_wait = next(
                        (item for item in compaction_waits if item["id"] == request_id),
                        None,
                    )
                    if compaction_wait is not None:
                        compaction_wait["success"] = success
                        compaction_wait["error"] = event.get("error")
                        if not success:
                            raise RuntimeError(f"compaction waiting turn rejected: {event.get('error')}")
                elif kind == "tool_execution_start":
                    if event.get("toolName") == "ipython":
                        test_calls[str(event.get("toolCallId"))] = stage
                elif kind == "tool_execution_update":
                    remember_partial_test_result(event)
                elif kind in {"tool_execution_end", "turn_end"}:
                    for result in rpc_tool_results(event):
                        pending_tool_results.pop(result["tool_call_id"], None)
                        record_test_result(result)
                    if kind == "turn_end" and not compaction_active and not compaction_request_pending:
                        if baseline_ready and not pivot_sent:
                            request_compaction("compact-before-pivot")
                        elif followup_ready and not lock_sent:
                            request_compaction("compact-before-lock")
                elif kind == "compaction_start":
                    compaction_active = True
                elif kind == "compaction_end":
                    compaction_active = False
                    flush_pending_test_results()
                    completed = {
                        "event_number": event_number,
                        "reason": event.get("reason"),
                        "aborted": bool(event.get("aborted")),
                        "errorMessage": event.get("errorMessage"),
                        "willRetry": bool(event.get("willRetry")),
                    }
                    if event.get("reason") == "manual" and compaction_request_pending:
                        compaction_request = active_compaction_request()
                        if compaction_request is None:
                            raise RuntimeError("manual compaction ended without a pending request")
                        lifecycle_error = completed["errorMessage"]
                        if compaction_end_succeeded(completed):
                            compaction_request["lifecycle_resolved"] = True
                            compaction_request_pending = False
                            pending_manual_compaction = None
                            complete_compaction(completed)
                        elif "success" not in compaction_request or completed["willRetry"]:
                            pending_manual_compaction = completed
                        elif "Session is too short to compact" in str(
                            compaction_request.get("error") or lifecycle_error
                        ):
                            compaction_request["lifecycle_resolved"] = True
                            compaction_request_pending = False
                            pending_manual_compaction = None
                            request_compaction_wait(compaction_request["label"])
                        elif retryable_compaction_error(
                            compaction_request.get("error") or lifecycle_error
                        ):
                            retry_failed_compaction(
                                compaction_request,
                                compaction_request.get("error") or lifecycle_error,
                            )
                        else:
                            raise RuntimeError(
                                "manual compaction failed: "
                                f"{compaction_request.get('error') or lifecycle_error}"
                            )
                        continue
                    if not compaction_end_succeeded(event):
                        continue
                    complete_compaction(completed)
                elif kind == "goal_update":
                    goal = event.get("goal") or {}
                    goal_updates.append(
                        {
                            "event_number": event_number,
                            "status": goal.get("status"),
                            "continuations_used": goal.get("continuationsUsed"),
                            "tokens_used": goal.get("tokensUsed"),
                        }
                    )
                    if goal.get("status") == "complete":
                        early_complete = not lock_sent
                        goal_complete = True
                elif kind == "message_end":
                    message = event.get("message") or {}
                    if message.get("role") == "assistant":
                        assistant_outputs.append(text_content(message.get("content")))
                elif kind == "agent_end":
                    if goal_complete:
                        final_text = next((text.strip() for text in reversed(assistant_outputs) if text.strip()), "")
                        if final_text == scenario["expected"]["final_response_exact"]:
                            break
        except Exception as exc:
            rpc_error = f"{type(exc).__name__}: {exc}"
        finally:
            instruction_wall_seconds = time.monotonic() - instruction_started
            try:
                process.stdin.close()
            except OSError:
                pass
            process.terminate()
            try:
                process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)

    return {
        "outputs": assistant_outputs,
        "interventions": interventions,
        "responses": responses,
        "test_runs": test_runs,
        "goal_updates": goal_updates,
        "rpc_compactions": compactions,
        "compaction_requests": compaction_requests,
        "compaction_waits": compaction_waits,
        "early_complete": early_complete,
        "goal_complete_event": goal_complete,
        "instruction_wall_seconds": instruction_wall_seconds,
        "error": rpc_error,
        "stderr": stderr_path.read_text(),
    }


def parse_session_file(path: Path) -> dict[str, Any] | None:
    header: dict[str, Any] | None = None
    usage = {key: 0 for key in ["input", "output", "cacheRead", "cacheWrite", "totalTokens"]}
    cost = {key: 0.0 for key in ["input", "output", "cacheRead", "cacheWrite", "total"]}
    model_calls = tool_calls = tool_results = visible_tool_bytes = compactions = goal_contexts = 0
    goal_states: list[dict[str, Any]] = []
    with path.open(errors="ignore") as handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            if entry.get("type") == "session":
                header = entry
            elif entry.get("type") == "compaction":
                compactions += 1
            elif entry.get("type") == "custom" and entry.get("customType") == "thread_goal_state":
                goal_states.append(entry.get("data") or {})
            elif entry.get("type") == "custom_message" and entry.get("customType") == "goal_context":
                goal_contexts += 1
            if entry.get("type") != "message":
                continue
            message = entry.get("message") or {}
            role = message.get("role")
            if role == "assistant":
                model_calls += 1
                item = message.get("usage") or {}
                for key in usage:
                    usage[key] += item.get(key, 0) or 0
                item_cost = item.get("cost") or {}
                for key in cost:
                    cost[key] += item_cost.get(key, 0) or 0
                tool_calls += sum(
                    1
                    for block in message.get("content") or []
                    if isinstance(block, dict) and block.get("type") == "toolCall"
                )
            elif role == "toolResult":
                tool_results += 1
                visible_tool_bytes += len(text_content(message.get("content")).encode())
    if not header:
        return None
    return {
        "path": str(path),
        "session_id": header.get("id"),
        "rlm_depth": header.get("rlmDepth", 0),
        "model_calls": model_calls,
        "tool_calls": tool_calls,
        "tool_results": tool_results,
        "visible_tool_bytes": visible_tool_bytes,
        "compactions": compactions,
        "goal_contexts": goal_contexts,
        "usage": usage,
        "cost": cost,
        "goal_states": goal_states,
        "final_goal": goal_states[-1] if goal_states else None,
    }


def collect_sessions(run_root: Path) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for path in run_root.rglob("*.jsonl"):
        parsed = parse_session_file(path)
        if parsed and parsed["session_id"] not in by_id:
            by_id[str(parsed["session_id"])] = parsed
    return list(by_id.values())


def aggregate_sessions(sessions: list[dict[str, Any]]) -> dict[str, Any]:
    usage_keys = ["input", "output", "cacheRead", "cacheWrite", "totalTokens"]
    cost_keys = ["input", "output", "cacheRead", "cacheWrite", "total"]
    usage = {key: sum(item["usage"][key] for item in sessions) for key in usage_keys}
    cost = {key: sum(item["cost"][key] for item in sessions) for key in cost_keys}
    prompt_tokens = usage["input"] + usage["cacheRead"] + usage["cacheWrite"]
    return {
        "session_count": len(sessions),
        "child_sessions": sum(1 for item in sessions if item["rlm_depth"] > 0),
        "model_calls": sum(item["model_calls"] for item in sessions),
        "tool_calls": sum(item["tool_calls"] for item in sessions),
        "tool_results": sum(item["tool_results"] for item in sessions),
        "visible_tool_bytes": sum(item["visible_tool_bytes"] for item in sessions),
        "compactions": sum(item["compactions"] for item in sessions),
        "goal_contexts": sum(item["goal_contexts"] for item in sessions),
        "usage": usage,
        "cost": cost,
        "prompt_cache_reuse": usage["cacheRead"] / prompt_tokens if prompt_tokens else 0.0,
    }


def parse_test_result(stdout: str) -> tuple[int, int]:
    matches = re.findall(r"TEST_RESULT PASS (\d+)/(\d+)", stdout)
    return tuple(map(int, matches[-1])) if matches else (0, 0)


def prime_context_archives(pc_home: Path) -> dict[str, int]:
    totals = {
        "count": 0,
        "source_bytes": 0,
        "compressed_bytes": 0,
        "chunk_count": 0,
        "max_chunk_bytes": 0,
        "source_bytes_archived": 0,
        "call_argument_bytes_projected_out": 0,
        "result_bytes_projected_out": 0,
        "typed_media_bytes_projected_out": 0,
        "recovery_bytes_exposed": 0,
        "current_projected_model_view_bytes": 0,
        "streaming_bytes_processed": 0,
        "inspect_recall_hits": 0,
        "fold_generation_count": 0,
        "branch_runtime_reload_count": 0,
        "cache_read_tokens": 0,
        "cache_write_tokens": 0,
        "uncached_input_tokens": 0,
        "stable_projection_extension_turns": 0,
    }
    sessions = pc_home / "sessions"
    if not sessions.exists():
        return totals

    metric_fields = {
        "sourceBytesArchived": "source_bytes_archived",
        "callArgumentBytesProjectedOut": "call_argument_bytes_projected_out",
        "resultBytesProjectedOut": "result_bytes_projected_out",
        "typedMediaBytesProjectedOut": "typed_media_bytes_projected_out",
        "recoveryBytesExposed": "recovery_bytes_exposed",
        "currentProjectedModelViewBytes": "current_projected_model_view_bytes",
        "streamingBytesProcessed": "streaming_bytes_processed",
        "inspectRecallHits": "inspect_recall_hits",
        "foldGenerationCount": "fold_generation_count",
        "branchRuntimeReloadCount": "branch_runtime_reload_count",
        "cacheReadTokens": "cache_read_tokens",
        "cacheWriteTokens": "cache_write_tokens",
        "uncachedInputTokens": "uncached_input_tokens",
        "stableProjectionExtensionTurns": "stable_projection_extension_turns",
    }
    for session in (path for path in sessions.iterdir() if path.is_dir()):
        try:
            aggregate = json.loads((session / "session.json").read_text()).get("metrics", {})
        except (json.JSONDecodeError, OSError):
            aggregate = {}
        for stored, reported in metric_fields.items():
            value = aggregate.get(stored, 0) if isinstance(aggregate, dict) else 0
            totals[reported] += int(value) if isinstance(value, (int, float)) and value >= 0 else 0

        records: dict[str, dict] = {}
        index = session / "index.json"
        if index.exists():
            try:
                indexed = json.loads(index.read_text()).get("observations", [])
            except (json.JSONDecodeError, OSError):
                indexed = []
            for position, item in enumerate(indexed):
                if not isinstance(item, dict):
                    continue
                key = str(item.get("id", f"legacy:{position}"))
                if item.get("schema") == "prime-context.exchange/v2":
                    sidecar = session / str(item.get("relativeFile", ""))
                    try:
                        records[key] = json.loads(sidecar.read_text())
                    except (json.JSONDecodeError, OSError):
                        continue
                else:
                    records[key] = item

        observations = session / "observations"
        if observations.exists():
            for sidecar in observations.glob("*.meta.json"):
                try:
                    envelope = json.loads(sidecar.read_text())
                except (json.JSONDecodeError, OSError):
                    continue
                if isinstance(envelope, dict):
                    records[str(envelope.get("id", sidecar.name.removesuffix(".meta.json")))] = envelope

        seen_files: set[str] = set()
        for record in records.values():
            totals["count"] += 1
            if record.get("schema") != "prime-context.exchange/v2":
                text_bytes = int(record.get("textBytes", 0) or 0)
                totals["source_bytes"] += text_bytes
                relative = record.get("relativeFile")
                archive = session / relative if isinstance(relative, str) else None
                if archive and archive.exists():
                    totals["compressed_bytes"] += archive.stat().st_size
                    totals["chunk_count"] += 1
                    totals["max_chunk_bytes"] = max(totals["max_chunk_bytes"], text_bytes)
                continue

            parts = record.get("parts", [])
            result = next((part for part in parts if isinstance(part, dict) and
                           part.get("name") == "result" and part.get("kind") == "result"), None)
            if result:
                totals["source_bytes"] += int(result.get("textBytes", 0) or 0)
            for part in parts:
                if not isinstance(part, dict):
                    continue
                for chunk in part.get("chunks", []):
                    if not isinstance(chunk, dict):
                        continue
                    relative = chunk.get("relativeFile")
                    if not isinstance(relative, str) or relative in seen_files:
                        continue
                    seen_files.add(relative)
                    archive = session / relative
                    if archive.exists():
                        totals["compressed_bytes"] += archive.stat().st_size
                        totals["chunk_count"] += 1
                        totals["max_chunk_bytes"] = max(
                            totals["max_chunk_bytes"], int(chunk.get("textBytes", 0) or 0),
                        )
    return totals


def freeze_runtime_executable(name: str, output_root: Path) -> Path:
    source = shutil.which(name)
    if not source:
        raise RuntimeError(f"required executable not found: {name}")
    destination = output_root / "_frozen" / "runtime" / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    destination.chmod(0o755)
    return destination


def prime_agent_install_root(cli: Path) -> tuple[Path, Path]:
    resolved = cli.resolve()
    parts = resolved.parts
    indices = [index for index, part in enumerate(parts) if part == "node_modules"]
    if not indices:
        raise RuntimeError(f"Prime Agent CLI is not below node_modules: {cli}")
    index = indices[-1]
    install_root = Path(*parts[:index])
    return install_root, resolved.relative_to(install_root)


def allocate_private_network() -> tuple[str, str]:
    global _NETWORK_INDEX
    with _NETWORK_LOCK:
        index = _NETWORK_INDEX
        _NETWORK_INDEX = (_NETWORK_INDEX + 1) % 262144
    base = int(ipaddress.ip_network("100.64.0.0/10").network_address)
    network = ipaddress.ip_network((base + index * 16, 28))
    gateway = str(network.network_address + 1)
    return str(network), gateway


class _ConnectProxyHandler(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        self.request.settimeout(30)
        header = bytearray()
        while b"\r\n\r\n" not in header and len(header) < 65536:
            chunk = self.request.recv(4096)
            if not chunk:
                return
            header.extend(chunk)
        head, separator, remainder = bytes(header).partition(b"\r\n\r\n")
        if not separator:
            return
        first_line = head.split(b"\r\n", 1)[0].decode("ascii", "replace")
        parts = first_line.split()
        if len(parts) != 3 or parts[0].upper() != "CONNECT":
            self.request.sendall(b"HTTP/1.1 405 Method Not Allowed\r\nContent-Length: 0\r\n\r\n")
            return
        authority = parts[1]
        host, colon, port_text = authority.rpartition(":")
        if not colon or not host or port_text != "443":
            self.request.sendall(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")
            return
        host = host.strip("[]").lower().rstrip(".")
        if not any(
            host == suffix or host.endswith(f".{suffix}")
            for suffix in _PROXY_ALLOWED_HOST_SUFFIXES
        ):
            self.request.sendall(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n")
            return
        upstream: socket.socket | None = None
        try:
            for family, socktype, protocol, _, address in socket.getaddrinfo(
                host, 443, type=socket.SOCK_STREAM
            ):
                try:
                    address_value = ipaddress.ip_address(address[0])
                except ValueError:
                    continue
                if not address_value.is_global:
                    continue
                candidate = socket.socket(family, socktype, protocol)
                candidate.settimeout(30)
                try:
                    candidate.connect(address)
                except OSError:
                    candidate.close()
                    continue
                upstream = candidate
                break
            if upstream is None:
                raise OSError("no reachable public address")
            self.request.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            if remainder:
                upstream.sendall(remainder)
            self.request.settimeout(None)
            upstream.settimeout(None)
            peers = [self.request, upstream]
            while True:
                readable, _, _ = select.select(peers, [], [], 300)
                if not readable:
                    return
                for source in readable:
                    data = source.recv(65536)
                    if not data:
                        return
                    destination = upstream if source is self.request else self.request
                    destination.sendall(data)
        except OSError:
            try:
                self.request.sendall(b"HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n")
            except OSError:
                pass
        finally:
            if upstream is not None:
                upstream.close()


class _ConnectProxyServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


class ConnectProxy:
    def __init__(self, bind_host: str):
        self.server = _ConnectProxyServer((bind_host, 0), _ConnectProxyHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        host, port = self.server.server_address
        return f"http://{host}:{port}"

    def start(self) -> None:
        self.thread.start()

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)




def cleanup_docker_artifacts(active_images: set[str] | None = None) -> None:
    docker = shutil.which("docker")
    if not docker:
        return
    containers = subprocess.run(
        [docker, "ps", "--all", "--quiet", "--filter", "label=prime-context-benchmark=true"],
        text=True,
        capture_output=True,
        timeout=60,
    ).stdout.split()
    if containers:
        subprocess.run(
            [docker, "rm", "--force", *containers],
            text=True,
            capture_output=True,
            timeout=120,
        )
    networks = subprocess.run(
        [docker, "network", "ls", "--quiet", "--filter", "label=prime-context-benchmark=true"],
        text=True,
        capture_output=True,
        timeout=60,
    ).stdout.split()
    if networks:
        subprocess.run(
            [docker, "network", "rm", *networks],
            text=True,
            capture_output=True,
            timeout=120,
        )
    if active_images is not None:
        tagged = subprocess.run(
            [
                docker,
                "image",
                "ls",
                "--filter",
                "label=org.prime-context.benchmark=true",
                "--format",
                "{{.Repository}}:{{.Tag}}",
            ],
            text=True,
            capture_output=True,
            timeout=60,
        ).stdout.splitlines()
        stale = [tag for tag in tagged if "<none>" not in tag and tag not in active_images]
        if stale:
            subprocess.run(
                [docker, "image", "rm", *stale],
                text=True,
                capture_output=True,
                timeout=300,
            )
    subprocess.run(
        [
            docker,
            "image",
            "prune",
            "--force",
            "--filter",
            "label=org.prime-context.benchmark=true",
        ],
        text=True,
        capture_output=True,
        timeout=300,
    )


def docker_base_command(
    run_root: Path,
    uv_binary: Path | None,
    image: str,
    container_name: str,
    network: str,
    cli: Path | None = None,
    extension: Path | None = None,
    proxy_url: str | None = None,
    global_agents_file: Path | None = None,
    remove_container: bool = True,
) -> list[str]:
    docker = shutil.which("docker")
    if not docker:
        raise RuntimeError("docker is required for container-isolated benchmark runs")
    command = [docker, "run"]
    if remove_container:
        command.append("--rm")
    command.extend([
        "--interactive",
        "--init",
        "--name",
        container_name,
        "--label",
        "prime-context-benchmark=true",
        "--network",
        network,
        "--user",
        f"{os.getuid()}:{os.getgid()}",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--pids-limit",
        "1024",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,size=2g",
        "--mount",
        f"type=bind,src={run_root},dst=/sandbox",
        "--workdir",
        "/sandbox/work",
    ])
    if uv_binary is not None:
        command.extend(["--mount", f"type=bind,src={uv_binary},dst=/opt/uv,readonly"])
    if cli is not None:
        install_root, _ = prime_agent_install_root(cli)
        command.extend(["--mount", f"type=bind,src={install_root},dst=/opt/prime-agent-host,readonly"])
    if extension is not None:
        command.extend(["--mount", f"type=bind,src={extension},dst=/opt/prime-context,readonly"])
    if global_agents_file is not None:
        command.extend(
            [
                "--mount",
                f"type=bind,src={global_agents_file},dst=/sandbox/config/AGENTS.md,readonly",
            ]
        )
    environment = {
        "HOME": "/sandbox/home",
        "PATH": "/opt:/usr/local/bin:/usr/bin:/bin",
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "NO_COLOR": "1",
        "PRIME_AGENT_CODING_AGENT_DIR": "/sandbox/config",
        "PRIME_AGENT_KERNEL_VENV": "/sandbox/home/kernel-venv",
        "PRIME_AGENT_TELEMETRY": "0",
        "PRIME_CONTEXT_HOME": "/sandbox/pc-home",
        "UV_CACHE_DIR": "/sandbox/home/.cache/uv",
        "UV_PYTHON_INSTALL_DIR": "/sandbox/home/.local/share/uv/python",
        "XDG_CACHE_HOME": "/sandbox/home/.cache",
        "XDG_CONFIG_HOME": "/sandbox/home/.config",
        "XDG_DATA_HOME": "/sandbox/home/.local/share",
        "XDG_STATE_HOME": "/sandbox/home/.local/state",
    }
    if cli is None:
        environment["PRIME_AGENT_KERNEL_PYTHON"] = "/opt/prime-agent-kernel/bin/python"
    if proxy_url is not None:
        environment.update(
            {
                "HTTP_PROXY": proxy_url,
                "HTTPS_PROXY": proxy_url,
                "http_proxy": proxy_url,
                "https_proxy": proxy_url,
                "NO_PROXY": "127.0.0.1,localhost",
                "no_proxy": "127.0.0.1,localhost",
            }
        )
    for key, value in environment.items():
        command.extend(["--env", f"{key}={value}"])
    command.append(image)
    return command


def docker_agent_command(
    run_root: Path,
    cli: Path | None,
    uv_binary: Path | None,
    extension: Path | None,
    image: str,
    container_name: str,
    network: str,
    proxy_url: str,
    global_agents_file: Path | None,
    arguments: list[str],
    remove_container: bool = True,
) -> list[str]:
    command = docker_base_command(
        run_root,
        uv_binary,
        image,
        container_name,
        network,
        cli,
        extension,
        proxy_url,
        global_agents_file,
        remove_container=remove_container,
    )
    if cli is None:
        return command + ["prime-agent", *arguments]
    _, relative_cli = prime_agent_install_root(cli)
    return command + ["node", str(Path("/opt/prime-agent-host") / relative_cli), *arguments]


def run_condition(
    condition: str,
    task_dir: Path,
    scenario: dict[str, Any],
    output_root: Path,
    cli: Path | None,
    extension: Path | None,
    auth_file: Path,
    timeout_seconds: int,
    reserve_tokens: int,
    uv_binary: Path | None = None,
    docker_image: str | None = None,
    global_agents_file: Path | None = None,
    container_package: str | None = None,
    retain_docker_artifacts: bool = False,
) -> dict[str, Any]:
    run_root = output_root / f"task-{scenario['id']:02d}-{scenario['slug']}" / condition
    if run_root.exists():
        shutil.rmtree(run_root)
    work = run_root / "work"
    sessions_dir = run_root / "sessions"
    config = run_root / "config"
    pc_home = run_root / "pc-home"
    home = run_root / "home"
    for directory in [work, sessions_dir, config, pc_home, home]:
        directory.mkdir(parents=True, exist_ok=True)
    copy_stage(task_dir / "initial", work)
    shutil.copy2(auth_file, config / "auth.json")
    (config / "auth.json").chmod(0o600)
    if global_agents_file is not None:
        if not global_agents_file.is_file():
            raise RuntimeError(f"global AGENTS.md not found: {global_agents_file}")
        shutil.copy2(global_agents_file, config / "AGENTS.md")
        (config / "AGENTS.md").chmod(0o444)
    network_name: str | None = None
    container_name: str | None = None
    proxy: ConnectProxy | None = None
    if docker_image:
        safe_condition = re.sub(r"[^a-z0-9-]+", "-", condition.lower()).strip("-")
        suffix = int(time.time_ns() % 1_000_000_000)
        network_name = f"pcbench-{os.getpid()}-{scenario['id']}-{safe_condition}-{suffix}"
        container_name = f"{network_name}-agent"
        subnet, gateway = allocate_private_network()
        subprocess.run(
            [
                "docker",
                "network",
                "create",
                "--driver",
                "bridge",
                "--internal",
                "--label",
                "prime-context-benchmark=true",
                "--subnet",
                subnet,
                "--gateway",
                gateway,
                network_name,
            ],
            text=True,
            capture_output=True,
            check=True,
            timeout=60,
        )
        proxy = ConnectProxy(gateway)
        proxy.start()
    package_path = (
        container_package
        if docker_image and container_package
        else "/opt/prime-context"
        if docker_image and extension
        else str(extension)
        if extension
        else None
    )
    settings = {
        "defaultProvider": scenario["benchmark"]["provider"],
        "defaultModel": scenario["benchmark"]["model"],
        "defaultThinkingLevel": scenario["benchmark"]["thinking"],
        "telemetry": {"enabled": False, "noticeShown": True},
        "compaction": {"enabled": True, "reserveTokens": reserve_tokens, "keepRecentTokens": 4000},
        "packages": [package_path] if package_path else [],
    }
    (config / "settings.json").write_text(json.dumps(settings, indent=2) + "\n")
    environment = clean_environment(config, pc_home, home)
    socket = run_root / "daemon.sock"
    agent_arguments = [
        "--daemon-socket",
        "/sandbox/daemon.sock" if docker_image else str(socket),
        "--mode",
        "rpc",
        "--cwd",
        "/sandbox/work" if docker_image else str(work),
        "--session-dir",
        "/sandbox/sessions" if docker_image else str(sessions_dir),
        "--provider",
        scenario["benchmark"]["provider"],
        "--model",
        scenario["benchmark"]["model"],
        "--thinking",
        scenario["benchmark"]["thinking"],
        "--goal",
        scenario["goal"],
        "--no-prompt-templates",
        "--no-themes",
    ]
    if global_agents_file is None:
        agent_arguments.append("--no-context-files")
    if extension is None and container_package is None:
        agent_arguments.append("--no-extensions")
    if docker_image:
        assert container_name is not None and network_name is not None and proxy is not None
        command = docker_agent_command(
            run_root,
            cli,
            uv_binary,
            extension,
            docker_image,
            container_name,
            network_name,
            proxy.url,
            global_agents_file,
            agent_arguments,
            remove_container=not retain_docker_artifacts,
        )
    else:
        command = [shutil.which("node") or "node", str(cli), *agent_arguments]
    lifecycle_started = time.monotonic()
    error = None
    try:
        try:
            interaction = run_rpc(command, work, environment, run_root, task_dir, scenario, timeout_seconds)
            error = interaction.get("error")
        except Exception as exc:  # result captures condition failures without stopping the cohort
            interaction = {
                "outputs": [],
                "interventions": [],
                "responses": {},
                "test_runs": [],
                "goal_updates": [],
                "rpc_compactions": [],
                "early_complete": False,
                "goal_complete_event": False,
                "stderr": "",
            }
            error = f"{type(exc).__name__}: {exc}"
    finally:
        if docker_image:
            assert container_name is not None
            if retain_docker_artifacts:
                subprocess.run(
                    ["docker", "stop", "--time", "1", container_name],
                    text=True,
                    capture_output=True,
                    timeout=60,
                )
            else:
                subprocess.run(
                    ["docker", "rm", "--force", container_name],
                    text=True,
                    capture_output=True,
                    timeout=60,
                )
            if proxy is not None:
                proxy.close()
            if network_name is not None and not retain_docker_artifacts:
                subprocess.run(
                    ["docker", "network", "rm", network_name],
                    text=True,
                    capture_output=True,
                    timeout=60,
                )
        else:
            try:
                subprocess.run(
                    [shutil.which("node") or "node", str(cli), "--daemon-socket", str(socket), "shutdown", "--force"],
                    cwd=work,
                    env=environment,
                    text=True,
                    capture_output=True,
                    timeout=60,
                )
            except subprocess.TimeoutExpired:
                pass
    lifecycle_wall_seconds = time.monotonic() - lifecycle_started
    measured_wall_seconds = interaction.get("instruction_wall_seconds")
    wall_seconds = (
        float(measured_wall_seconds)
        if isinstance(measured_wall_seconds, (int, float))
        else lifecycle_wall_seconds
    )
    if docker_image:
        assert network_name is not None
        verifier_command = docker_base_command(
            run_root,
            uv_binary,
            docker_image,
            f"{network_name}-verify",
            "none",
        ) + ["python3", "run_tests.py"]
    else:
        verifier_command = [sys.executable, "run_tests.py"]
    try:
        verifier = subprocess.run(
            verifier_command,
            cwd=work,
            env=environment,
            text=True,
            capture_output=True,
            timeout=180,
        )
    finally:
        if docker_image and network_name is not None:
            subprocess.run(
                ["docker", "rm", "--force", f"{network_name}-verify"],
                text=True,
                capture_output=True,
                timeout=60,
            )
    passing_tests, total_tests = parse_test_result(verifier.stdout)
    protected_ok = all(
        (work / relative).exists()
        and (work / relative).read_bytes()
        == next((task_dir / stage / relative).read_bytes() for stage in ["initial", "pivot", "followup"] if (task_dir / stage / relative).exists())
        for relative in scenario["expected"]["protected_files"]
    )
    sessions = collect_sessions(run_root)
    root_session = next((item for item in sessions if item["rlm_depth"] == 0), None)
    recursive = aggregate_sessions(sessions)
    final_goal = (root_session or {}).get("final_goal") or {}
    final_text = next((text.strip() for text in reversed(interaction["outputs"]) if text.strip()), "")
    labels = [item["label"] for item in interaction["interventions"]]
    interventions_accepted = bool(interaction["interventions"]) and all(
        interaction["responses"].get(item["id"]) is True for item in interaction["interventions"]
    )
    external_tests_pass = (
        verifier.returncode == 0
        and passing_tests == scenario["expected"]["passing_tests"]
        and total_tests == scenario["expected"]["total_tests"]
    )
    task_completed = all(
        [
            error is None,
            external_tests_pass,
            protected_ok,
            final_goal.get("status") == "complete",
            not interaction["early_complete"],
            labels == scenario["expected"]["intervention_order"],
            interventions_accepted,
        ]
    )
    result = {
        "task_id": scenario["id"],
        "task_slug": scenario["slug"],
        "condition": condition,
        "task_completed": task_completed,
        "error": error,
        "wall_seconds": wall_seconds,
        "lifecycle_wall_seconds": lifecycle_wall_seconds,
        "docker_artifacts": {
            "container": container_name,
            "network": network_name,
            "retained": bool(docker_image and retain_docker_artifacts),
        },
        "passing_tests": passing_tests,
        "total_tests": total_tests,
        "external_tests_pass": external_tests_pass,
        "protected_files_unchanged": protected_ok,
        "goal_status": final_goal.get("status"),
        "goal_completed_after_lock": final_goal.get("status") == "complete" and not interaction["early_complete"],
        "final_response_exact": final_text == scenario["expected"]["final_response_exact"],
        "final_response": final_text,
        "intervention_order_ok": labels == scenario["expected"]["intervention_order"],
        "interventions_accepted": interventions_accepted,
        "recursive_metrics": recursive,
        "prime_context_archives": prime_context_archives(pc_home),
        "interaction": interaction,
        "sessions": sessions,
        "verifier_stdout": verifier.stdout,
        "verifier_stderr": verifier.stderr,
    }
    (run_root / "result.json").write_text(json.dumps(result, indent=2) + "\n")
    return result


def aggregate_cohort(
    results: list[dict[str, Any]],
    elapsed: float,
    condition_order: list[str] | None = None,
    comparison_pairs: list[tuple[str, str]] | None = None,
) -> dict[str, Any]:
    available = list(dict.fromkeys(item["condition"] for item in results))
    conditions = condition_order or [
        condition for condition in ["vanilla", "prime-context", *available] if condition in available
    ]
    conditions = list(dict.fromkeys(conditions))
    summary: dict[str, Any] = {
        "elapsed_seconds": elapsed,
        "conditions": {},
        "comparisons_percent": {},
        "paired_deltas_percent": {},
    }
    for condition in conditions:
        items = [item for item in results if item["condition"] == condition]
        if not items:
            continue
        usage = {
            key: sum(item["recursive_metrics"]["usage"][key] for item in items)
            for key in ["input", "output", "cacheRead", "cacheWrite", "totalTokens"]
        }
        prompt_tokens = usage["input"] + usage["cacheRead"] + usage["cacheWrite"]
        summary["conditions"][condition] = {
            "tasks": len(items),
            "tasks_completed": sum(bool(item["task_completed"]) for item in items),
            "passing_tests": sum(item["passing_tests"] for item in items),
            "expected_tests": sum(item["total_tests"] for item in items),
            "wall_seconds": sum(item["wall_seconds"] for item in items),
            "model_calls": sum(item["recursive_metrics"]["model_calls"] for item in items),
            "compactions": sum(item["recursive_metrics"]["compactions"] for item in items),
            "child_sessions": sum(item["recursive_metrics"]["child_sessions"] for item in items),
            "usage": usage,
            "api_cost": sum(item["recursive_metrics"]["cost"]["total"] for item in items),
            "prompt_cache_reuse": usage["cacheRead"] / prompt_tokens if prompt_tokens else 0.0,
            "visible_tool_bytes": sum(item["recursive_metrics"]["visible_tool_bytes"] for item in items),
        }
    if comparison_pairs is None:
        comparison_pairs = []
        if "vanilla" in summary["conditions"] and "prime-context" in summary["conditions"]:
            comparison_pairs.append(("prime-context", "vanilla"))
    for target_name, baseline_name in comparison_pairs:
        target = summary["conditions"].get(target_name)
        baseline = summary["conditions"].get(baseline_name)
        if not target or not baseline:
            continue
        metrics = {
            "wall_seconds": (target["wall_seconds"], baseline["wall_seconds"]),
            "model_calls": (target["model_calls"], baseline["model_calls"]),
            "compactions": (target["compactions"], baseline["compactions"]),
            "total_tokens": (target["usage"]["totalTokens"], baseline["usage"]["totalTokens"]),
            "api_cost": (target["api_cost"], baseline["api_cost"]),
            "visible_tool_bytes": (target["visible_tool_bytes"], baseline["visible_tool_bytes"]),
        }
        deltas = {
            key: ((target_value / baseline_value) - 1.0) * 100.0 if baseline_value else None
            for key, (target_value, baseline_value) in metrics.items()
        }
        comparison_name = f"{target_name}_vs_{baseline_name}"
        summary["comparisons_percent"][comparison_name] = deltas
        if target_name == "prime-context" and baseline_name == "vanilla":
            summary["paired_deltas_percent"] = deltas
    return summary


def result_brief(item: dict[str, Any]) -> dict[str, Any]:
    metrics = item["recursive_metrics"]
    return {
        "condition": item["condition"],
        "task_completed": item["task_completed"],
        "passing_tests": item["passing_tests"],
        "expected_tests": item["total_tests"],
        "external_tests_pass": item["external_tests_pass"],
        "protected_files_unchanged": item["protected_files_unchanged"],
        "goal_completed_after_lock": item["goal_completed_after_lock"],
        "interventions_accepted": item["interventions_accepted"],
        "intervention_order_ok": item["intervention_order_ok"],
        "final_response_exact": item["final_response_exact"],
        "error": item["error"],
        "wall_seconds": item["wall_seconds"],
        "model_calls": metrics["model_calls"],
        "compactions": metrics["compactions"],
        "child_sessions": metrics["child_sessions"],
        "usage": metrics["usage"],
        "api_cost": metrics["cost"]["total"],
        "prompt_cache_reuse": metrics["prompt_cache_reuse"],
        "visible_tool_bytes": metrics["visible_tool_bytes"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", default="all", help="all, a comma list, or ranges such as 1-5,22,30")
    parser.add_argument("--condition", choices=["both", "vanilla", "prime-context"], default="both")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--prime-agent-cli", type=Path, default=DEFAULT_CLI)
    parser.add_argument("--prime-context-source", default=str(PROJECT_ROOT))
    parser.add_argument("--auth-file", type=Path, default=Path.home() / ".prime" / "agent" / "auth.json")
    parser.add_argument("--timeout", type=int, default=1200)
    parser.add_argument("--reserve-tokens", type=int, default=265000)
    args = parser.parse_args()

    task_index = load_task_index()
    try:
        task_ids = parse_task_ids(args.tasks, set(task_index))
    except (ValueError, TypeError) as exc:
        parser.error(str(exc))
    source_cli = args.prime_agent_cli.expanduser().resolve()
    auth_file = args.auth_file.expanduser().resolve()
    if not source_cli.exists():
        parser.error(f"Prime Agent CLI not found: {source_cli}")
    if not auth_file.exists():
        parser.error(f"Prime Agent auth file not found: {auth_file}")
    output = args.output.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=False)
    conditions = ["vanilla", "prime-context"] if args.condition == "both" else [args.condition]
    cli = freeze_prime_agent(source_cli, output)
    extension = freeze_prime_context(args.prime_context_source, output) if "prime-context" in conditions else None
    manifest = {
        "schema": "prime-context.benchmark-run/v1",
        "task_set": str(TASK_SET),
        "task_ids": task_ids,
        "conditions": conditions,
        "prime_agent_source_cli": str(source_cli),
        "prime_agent_cli": str(cli),
        "prime_agent_version": read_package_version(cli),
        "prime_context_source": args.prime_context_source if extension else None,
        "prime_context_version": read_package_version(extension) if extension else None,
        "timeout_seconds": args.timeout,
        "reserve_tokens": args.reserve_tokens,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    results: list[dict[str, Any]] = []
    pair_analyses: list[dict[str, Any]] = []
    started = time.monotonic()
    for task_id in task_ids:
        task_dir = task_index[task_id]
        scenario = json.loads((task_dir / "scenario.json").read_text())
        if len(conditions) == 2:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                futures = {
                    condition: executor.submit(
                        run_condition,
                        condition,
                        task_dir,
                        scenario,
                        output,
                        cli,
                        extension if condition == "prime-context" else None,
                        auth_file,
                        args.timeout,
                        args.reserve_tokens,
                    )
                    for condition in conditions
                }
                pair = [futures[condition].result() for condition in conditions]
        else:
            pair = [
                run_condition(
                    conditions[0], task_dir, scenario, output, cli, extension, auth_file, args.timeout, args.reserve_tokens
                )
            ]
        results.extend(pair)
        pair_analysis = {
            "task_id": task_id,
            "task_slug": scenario["slug"],
            "conditions": [result_brief(item) for item in pair],
            "summary": aggregate_cohort(pair, max(item["wall_seconds"] for item in pair)),
        }
        pair_root = output / f"task-{task_id:02d}-{scenario['slug']}"
        (pair_root / "pair-analysis.json").write_text(json.dumps(pair_analysis, indent=2) + "\n")
        pair_analyses.append(pair_analysis)
        summary = aggregate_cohort(results, time.monotonic() - started)
        cohort = {"manifest": manifest, "results": results, "summary": summary}
        (output / "cohort.json").write_text(json.dumps(cohort, indent=2) + "\n")
        (output / "cohort-summary.json").write_text(
            json.dumps({"manifest": manifest, "tasks": pair_analyses, "summary": summary}, indent=2) + "\n"
        )
        print(
            json.dumps(
                {
                    "task": task_id,
                    "results": [
                        {
                            "condition": item["condition"],
                            "completed": item["task_completed"],
                            "tests": f"{item['passing_tests']}/{item['total_tests']}",
                            "tokens": item["recursive_metrics"]["usage"]["totalTokens"],
                            "compactions": item["recursive_metrics"]["compactions"],
                            "wall_seconds": item["wall_seconds"],
                            "api_cost": item["recursive_metrics"]["cost"]["total"],
                            "prompt_cache_reuse": item["recursive_metrics"]["prompt_cache_reuse"],
                        }
                        for item in pair
                    ],
                }
            ),
            flush=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
