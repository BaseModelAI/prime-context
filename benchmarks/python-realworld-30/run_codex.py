#!/usr/bin/env python3
"""Run the Python Real-World 30 corpus with isolated vanilla Codex CLI."""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import shutil
import signal
import socket
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from benchlib import (
    inject_stage,
    load_scenarios,
    make_read_only,
    make_writable_tree,
    parse_task_ids,
    prepare_workspace,
    require_python312,
    run_judge,
)
from run import Service, json_dump, start_service, stop_attempt_processes

ROOT = Path(__file__).resolve().parent
RUN_SCHEMA = "prime-context.python-realworld-codex-run/v1"
INVOCATION_SCHEMA = "prime-context.python-realworld-codex-invocation/v1"
RESULTS_SCHEMA = "prime-context.python-realworld-codex-results/v1"
SUMMARY_SCHEMA = "prime-context.python-realworld-codex-summary/v1"
MODEL = "gpt-5.6-sol"
REASONING_EFFORT = "medium"
CONTEXT_FILES = ("AGENTS.md", "AGENTS.override.md", ".codex/config.toml")
SYSTEM_CONFIG_FILES = (
    Path("/etc/codex/config.toml"),
    Path("/etc/codex/managed_config.toml"),
    Path("/etc/codex/requirements.toml"),
)
DEFAULT_RATES = {"input": 5.0, "cached_input": 0.5, "output": 30.0}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def strict_pass(item: dict[str, Any]) -> bool:
    judge = item.get("judge") or {}
    return judge.get("status") == "pass" and judge.get("progress_level") == 5


def clean_codex_environment(codex_home: Path) -> dict[str, str]:
    empty_home = codex_home.parent / "empty-home"
    empty_home.mkdir(exist_ok=True)
    node = shutil.which("node")
    if node is None:
        raise RuntimeError("node is required to launch the installed Codex CLI")
    return {
        "PATH": f"{Path(node).resolve().parent}:/usr/local/bin:/usr/bin:/bin",
        "HOME": str(empty_home),
        "CODEX_HOME": str(codex_home),
        "TERM": "dumb",
        "LANG": "C.UTF-8",
        "LC_ALL": "C.UTF-8",
        "TZ": "UTC",
        "PIP_NO_INDEX": "1",
        "PIP_DISABLE_PIP_VERSION_CHECK": "1",
        "UV_OFFLINE": "1",
        "npm_config_offline": "true",
        "npm_config_audit": "false",
        "npm_config_fund": "false",
        "PYTHONUTF8": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
    }


def agent_files_on_path(path: Path) -> list[str]:
    found: list[str] = []
    current = path.resolve()
    while True:
        for name in CONTEXT_FILES:
            candidate = current / name
            if candidate.exists():
                found.append(str(candidate))
        if current.parent == current:
            return found
        current = current.parent


def verify_clean_context(workspace: Path, codex_home: Path, *, initial: bool = True) -> None:
    empty_home = codex_home.parent / "empty-home"
    found = sorted(set(
        agent_files_on_path(workspace)
        + agent_files_on_path(codex_home)
        + agent_files_on_path(empty_home)
    ))
    if found:
        raise RuntimeError(f"Codex isolation path contains custom context files: {found}")
    system_configs = [str(path) for path in SYSTEM_CONFIG_FILES if path.exists()]
    if system_configs:
        raise RuntimeError(f"Codex system configuration is present: {system_configs}")
    unexpected = [path.name for path in codex_home.iterdir() if path.name not in {"auth.json"}]
    if initial and unexpected:
        raise RuntimeError(f"initial CODEX_HOME contains unexpected files: {sorted(unexpected)}")
    if initial and empty_home.exists() and any(empty_home.iterdir()):
        raise RuntimeError("isolated HOME is not empty")


def initial_command(codex: str, workspace: Path, last_message_path: Path) -> list[str]:
    return [
        codex,
        "exec",
        "--sandbox", "workspace-write",
        "--cd", str(workspace),
        "--config", "sandbox_workspace_write.network_access=true",
        "--config", "features.network_proxy.enabled=true",
        "--config", 'features.network_proxy.domains={ "127.0.0.1" = "allow" }',
        "--ignore-user-config",
        "--ignore-rules",
        "--skip-git-repo-check",
        "--model", MODEL,
        "--config", f'model_reasoning_effort="{REASONING_EFFORT}"',
        "--json",
        "--color", "never",
        "--output-last-message", str(last_message_path),
        "-",
    ]


def resume_command(codex: str, workspace: Path, thread_id: str, last_message_path: Path) -> list[str]:
    return [
        codex,
        "exec",
        "--sandbox", "workspace-write",
        "--cd", str(workspace),
        "--config", "sandbox_workspace_write.network_access=true",
        "--config", "features.network_proxy.enabled=true",
        "--config", 'features.network_proxy.domains={ "127.0.0.1" = "allow" }',
        "resume",
        "--ignore-user-config",
        "--ignore-rules",
        "--skip-git-repo-check",
        "--model", MODEL,
        "--config", f'model_reasoning_effort="{REASONING_EFFORT}"',
        "--json",
        "--output-last-message", str(last_message_path),
        thread_id,
        "-",
    ]


def stop_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=5)


def execute_turn(
    command: list[str],
    prompt: str,
    workspace: Path,
    environment: dict[str, str],
    event_path: Path,
    stderr_path: Path,
    last_message_path: Path,
    timeout_seconds: float,
) -> dict[str, Any]:
    started_at = utc_now()
    started = time.monotonic()
    with event_path.open("w") as stdout, stderr_path.open("w") as stderr:
        process = subprocess.Popen(
            command,
            cwd=workspace,
            env=environment,
            stdin=subprocess.PIPE,
            stdout=stdout,
            stderr=stderr,
            text=True,
            start_new_session=True,
        )
        try:
            process.communicate(input=prompt, timeout=max(1.0, timeout_seconds))
            returncode = process.returncode if process.returncode is not None else 0
        except subprocess.TimeoutExpired:
            stop_process(process)
            returncode = process.returncode if process.returncode is not None else -signal.SIGKILL
            timed_out = True
        else:
            timed_out = False
    elapsed = time.monotonic() - started
    events: list[dict[str, Any]] = []
    malformed: list[str] = []
    for line in event_path.read_text(errors="replace").splitlines():
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            if line.strip():
                malformed.append(line[:500])
            continue
        if isinstance(value, dict):
            events.append(value)
    thread_id = next((str(event.get("thread_id")) for event in events if event.get("type") == "thread.started" and event.get("thread_id")), None)
    completed = [event for event in events if event.get("type") == "turn.completed"]
    usage: dict[str, int] = {}
    for event in completed:
        raw = event.get("usage")
        if isinstance(raw, dict):
            for key, value in raw.items():
                if isinstance(value, (int, float)) and not isinstance(value, bool):
                    usage[key] = usage.get(key, 0) + int(value)
    errors: list[str] = []
    for event in events:
        if event.get("type") in {"error", "turn.failed"}:
            detail = event.get("message") or event.get("error") or event
            errors.append(str(detail))
    if timed_out:
        errors.append(f"Codex turn exceeded {timeout_seconds:.1f} seconds")
    if returncode != 0:
        errors.append(f"codex exited with code {returncode}")
    if not completed and not errors:
        errors.append("Codex emitted no turn.completed event")
    stderr_text = stderr_path.read_text(errors="replace").strip()
    if stderr_text and returncode != 0:
        errors.append(stderr_text[-2000:])
    return {
        "started_at": started_at,
        "completed_at": utc_now(),
        "elapsed_seconds": elapsed,
        "command": command,
        "prompt": prompt,
        "returncode": returncode,
        "timed_out": timed_out,
        "thread_id": thread_id,
        "usage": usage,
        "event_count": len(events),
        "malformed_output": malformed,
        "last_message": last_message_path.read_text(errors="replace") if last_message_path.is_file() else "",
        "errors": errors,
    }


def sum_usage(turns: list[dict[str, Any]]) -> dict[str, int]:
    result: dict[str, int] = {}
    for turn in turns:
        for key, value in turn.get("usage", {}).items():
            result[key] = result.get(key, 0) + int(value)
    return result


def equivalent_cost(usage: dict[str, int], rates: dict[str, float]) -> dict[str, float]:
    input_tokens = int(usage.get("input_tokens", 0))
    cached_tokens = int(usage.get("cached_input_tokens", 0))
    output_tokens = int(usage.get("output_tokens", 0))
    uncached_tokens = max(0, input_tokens - cached_tokens)
    uncached_cost = uncached_tokens * rates["input"] / 1_000_000
    cached_cost = cached_tokens * rates["cached_input"] / 1_000_000
    output_cost = output_tokens * rates["output"] / 1_000_000
    return {
        "uncached_input": uncached_cost,
        "cached_input": cached_cost,
        "output": output_cost,
        "total": uncached_cost + cached_cost + output_cost,
    }


def run_codex_session(
    codex: str,
    codex_home: Path,
    task_dir: Path,
    scenario: dict[str, Any],
    workspace: Path,
    attempt_dir: Path,
    timeout_seconds: int,
    rates: dict[str, float],
) -> dict[str, Any]:
    environment = clean_codex_environment(codex_home)
    services: list[Service] = []
    service_events: list[dict[str, Any]] = []
    fixture = scenario.get("fixture_service")
    if isinstance(fixture, dict):
        service = start_service("fixture-service", fixture, task_dir, workspace, attempt_dir)
        services.append(service)
        service_events.append({"kind": "fixture_service", "event": "started", "url": service.url, "at": utc_now()})

    def start_candidate_service(stage_id: str) -> None:
        spec = scenario.get("candidate_service")
        if not isinstance(spec, dict):
            return
        start_at = str(spec.get("start_at_stage", "initial"))
        restart = bool(spec.get("restart_each_stage", False))
        stage_ids = [str(stage["id"]) for stage in scenario["stages"]]
        if start_at not in stage_ids:
            raise ValueError(f"candidate_service.start_at_stage is unknown: {start_at}")
        if stage_ids.index(stage_id) < stage_ids.index(start_at):
            return
        existing = next((item for item in services if item.name == "candidate-service"), None)
        if existing and not restart:
            return
        if existing:
            existing.stop()
            services.remove(existing)
            service_events.append({"kind": "candidate_service", "event": "stopped", "stage": stage_id, "at": utc_now()})
        service_spec = dict(spec)
        url_file = service_spec.get("url_file")
        if url_file:
            target = workspace / str(url_file)
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.is_file():
                target.parent.chmod(target.parent.stat().st_mode | 0o700)
                with socket.socket() as reservation:
                    reservation.bind(("127.0.0.1", 0))
                    port = int(reservation.getsockname()[1])
                target.write_text(str(service_spec.get("url_template", "http://127.0.0.1:{port}")).format(port=port) + "\n")
                make_read_only(target)
                make_read_only(target.parent)
            from urllib.parse import urlsplit
            port = urlsplit(target.read_text().strip()).port
            if port:
                service_spec["_port_override"] = port
        try:
            service = start_service("candidate-service", service_spec, task_dir, workspace, attempt_dir)
        except Exception as exc:
            service_events.append({"kind": "candidate_service", "event": "start_failed", "stage": stage_id, "error": f"{type(exc).__name__}: {exc}", "at": utc_now()})
            return
        services.append(service)
        service_events.append({"kind": "candidate_service", "event": "started", "stage": stage_id, "url": service.url, "at": utc_now()})

    started = time.monotonic()
    deadline = started + min(timeout_seconds, int(scenario["timeout_seconds"]))
    turns: list[dict[str, Any]] = []
    stage_events: list[dict[str, Any]] = []
    thread_id: str | None = None
    error: str | None = None
    try:
        for index, stage in enumerate(scenario["stages"]):
            if index:
                inject_stage(task_dir, workspace, stage, "main")
                for editable in scenario["editable_paths"]:
                    make_writable_tree(workspace / str(editable))
            stage_id = str(stage["id"])
            start_candidate_service(stage_id)
            prompt = str(scenario["initial_prompt"] if index == 0 else stage["message"])
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                error = f"TimeoutError: Codex attempt exceeded {min(timeout_seconds, int(scenario['timeout_seconds']))} seconds"
                break
            event_path = attempt_dir / f"codex-events-{index + 1}-{stage_id}.jsonl"
            stderr_path = attempt_dir / f"codex-stderr-{index + 1}-{stage_id}.txt"
            last_message_path = attempt_dir / f"codex-last-message-{index + 1}-{stage_id}.txt"
            command = initial_command(codex, workspace, last_message_path) if index == 0 else resume_command(codex, workspace, thread_id or "", last_message_path)
            turn = execute_turn(command, prompt, workspace, environment, event_path, stderr_path, last_message_path, remaining)
            turn["stage"] = stage_id
            turns.append(turn)
            stage_events.append({"stage": stage_id, "started_at": turn["started_at"], "completed_at": turn["completed_at"], "elapsed_seconds": turn["elapsed_seconds"]})
            if index == 0:
                thread_id = turn.get("thread_id")
                if not thread_id and not turn["errors"]:
                    turn["errors"].append("initial Codex turn emitted no thread id")
            if turn["errors"]:
                error = "; ".join(str(item) for item in turn["errors"])
                break
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
    finally:
        for service in reversed(services):
            service.stop()
        stop_attempt_processes(workspace, attempt_dir)
    usage = sum_usage(turns)
    costs = equivalent_cost(usage, rates)
    input_tokens = int(usage.get("input_tokens", 0))
    cached_tokens = int(usage.get("cached_input_tokens", 0))
    cache_write_tokens = int(usage.get("cache_write_input_tokens", 0))
    output_tokens = int(usage.get("output_tokens", 0))
    reasoning_tokens = int(usage.get("reasoning_output_tokens", 0))
    return {
        "agent_wall_seconds": sum(float(turn["elapsed_seconds"]) for turn in turns),
        "thread_id": thread_id,
        "turns": turns,
        "stage_events": stage_events,
        "service_events": service_events,
        "error": error,
        "metrics": {
            "subscription_billed_cost": None,
            "api_equivalent_cost": costs,
            "api_equivalent_cost_kind": "cost using matched rates",
            "model_api_calls": None,
            "model_api_calls_note": "Codex exec JSONL does not expose underlying model request count.",
            "codex_turns": len(turns),
            "provider_usage": {
                "input": input_tokens,
                "cachedInput": cached_tokens,
                "cacheWriteInput": cache_write_tokens,
                "uncachedInput": max(0, input_tokens - cached_tokens),
                "output": output_tokens,
                "reasoningOutput": reasoning_tokens,
                "totalTokens": input_tokens + output_tokens,
            },
            "raw_usage": usage,
        },
    }


def copy_session_records(codex_home: Path, destination: Path) -> None:
    sessions = codex_home / "sessions"
    if not sessions.is_dir():
        return
    for source in sessions.rglob("*.jsonl"):
        target = destination / source.relative_to(sessions)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def run_attempt(
    codex: str,
    auth_file: Path,
    shared_codex_home: Path,
    task_dir: Path,
    scenario: dict[str, Any],
    output: Path,
    attempt: int,
    timeout_seconds: int,
    bwrap: str | None,
    rates: dict[str, float],
) -> dict[str, Any]:
    label = "attempt-1" if attempt == 1 else f"attempt-{attempt}-diagnostic"
    attempt_dir = output / f"task-{scenario['id']:02d}-{scenario['slug']}" / "codex" / label
    attempt_dir.mkdir(parents=True, exist_ok=False)
    temporary = Path(tempfile.mkdtemp(prefix=f"prime-context-codex-t{scenario['id']:02d}-a{attempt}-", dir="/tmp"))
    workspace = temporary / "workspace"
    started_at = utc_now()
    lifecycle_started = time.monotonic()
    setup_started = time.monotonic()
    try:
        prepare_workspace(task_dir, scenario, workspace)
        verify_clean_context(workspace, shared_codex_home, initial=False)
        setup_seconds = time.monotonic() - setup_started
        session = run_codex_session(
            codex, shared_codex_home, task_dir, scenario, workspace, attempt_dir,
            timeout_seconds, rates,
        )
        judge, judge_seconds, judge_log = run_judge(task_dir, scenario, workspace, bwrap)
        result = {
            "schema": RUN_SCHEMA,
            "variant": "codex",
            "task_id": scenario["id"],
            "task_slug": scenario["slug"],
            "pressure": scenario["pressure"],
            "started_at": started_at,
            "completed_at": utc_now(),
            "setup_seconds": setup_seconds,
            "agent_wall_seconds": session["agent_wall_seconds"],
            "judge_seconds": judge_seconds,
            "lifecycle_wall_seconds": time.monotonic() - lifecycle_started,
            "judge": judge,
            "metrics": session["metrics"],
            "thread_id": session["thread_id"],
            "turns": session["turns"],
            "stage_events": session["stage_events"],
            "service_events": session["service_events"],
            "error": session["error"],
            "isolation": {
                "codex_home": "isolated shared run home; auth.json only at startup",
                "workspace_root": "/tmp outside every repository and AGENTS.md/.codex search path",
                "agent_instruction_files": [],
                "user_config": "ignored",
                "exec_rules": "ignored",
                "custom_system_prompt": None,
                "custom_developer_prompt": None,
                "builtin_context": "stock Codex CLI context only",
                "api_key_environment": [],
                "auth_mode": "ChatGPT subscription",
                "sandbox": "workspace-write with exact 127.0.0.1 command-proxy allow rule",
            },
        }
        (attempt_dir / "judge.log").write_text(judge_log)
        shutil.copytree(workspace, attempt_dir / "workspace", dirs_exist_ok=True)
        json_dump(attempt_dir / "result.json", result)
        return result
    except Exception as exc:
        result = {
            "schema": RUN_SCHEMA,
            "variant": "codex",
            "task_id": scenario["id"],
            "task_slug": scenario["slug"],
            "pressure": scenario["pressure"],
            "started_at": started_at,
            "completed_at": utc_now(),
            "setup_seconds": max(0.0, time.monotonic() - setup_started),
            "agent_wall_seconds": 0.0,
            "judge_seconds": 0.0,
            "lifecycle_wall_seconds": time.monotonic() - lifecycle_started,
            "judge": {"status": "error", "progress_level": 0, "main_checks_passed": 0, "main_checks_total": 5, "edge_check_passed": False, "notes": [f"runner failure: {type(exc).__name__}: {exc}"]},
            "metrics": {"subscription_billed_cost": None, "api_equivalent_cost": {"total": 0.0}, "api_equivalent_cost_kind": "cost using matched rates", "model_api_calls": None, "model_api_calls_note": "Codex exec JSONL does not expose underlying model request count.", "codex_turns": 0, "provider_usage": {"input": 0, "cachedInput": 0, "cacheWriteInput": 0, "uncachedInput": 0, "output": 0, "reasoningOutput": 0, "totalTokens": 0}, "raw_usage": {}},
            "error": f"{type(exc).__name__}: {exc}",
        }
        json_dump(attempt_dir / "result.json", result)
        return result
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def attempt_key(item: dict[str, Any]) -> tuple[int, int, int, int, float, float]:
    judge = item.get("judge") or {}
    strict = int(strict_pass(item))
    progress = int(judge.get("progress_level") or 0)
    checks = int(judge.get("main_checks_passed") or 0)
    edge = int(judge.get("edge_check_passed") is True)
    wall = float(item.get("agent_wall_seconds") or 0)
    equivalent = float(((item.get("metrics") or {}).get("api_equivalent_cost") or {}).get("total") or 0)
    return strict, progress, checks, edge, -wall, -equivalent


def build_summary(tasks: list[dict[str, Any]], invocation: dict[str, Any]) -> dict[str, Any]:
    selected = [item["attempts"][item["selected_attempt"]] for item in tasks]
    all_attempts = [attempt for item in tasks for attempt in item["attempts"]]

    def aggregate(items: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "runs": len(items),
            "strict_passes": sum(strict_pass(item) for item in items),
            "main_checks_passed": sum(int((item.get("judge") or {}).get("main_checks_passed") or 0) for item in items),
            "main_checks_total": sum(int((item.get("judge") or {}).get("main_checks_total") or 0) for item in items),
            "edge_checks_passed": sum((item.get("judge") or {}).get("edge_check_passed") is True for item in items),
            "agent_wall_seconds": sum(float(item.get("agent_wall_seconds") or 0) for item in items),
            "subscription_billed_cost": None,
            "api_equivalent_cost": sum(float(((item.get("metrics") or {}).get("api_equivalent_cost") or {}).get("total") or 0) for item in items),
            "model_api_calls": None,
            "codex_turns": sum(int((item.get("metrics") or {}).get("codex_turns") or 0) for item in items),
            "input_tokens": sum(int((((item.get("metrics") or {}).get("provider_usage") or {}).get("input")) or 0) for item in items),
            "cached_input_tokens": sum(int((((item.get("metrics") or {}).get("provider_usage") or {}).get("cachedInput")) or 0) for item in items),
            "cache_write_input_tokens": sum(int((((item.get("metrics") or {}).get("provider_usage") or {}).get("cacheWriteInput")) or 0) for item in items),
            "output_tokens": sum(int((((item.get("metrics") or {}).get("provider_usage") or {}).get("output")) or 0) for item in items),
            "reasoning_output_tokens": sum(int((((item.get("metrics") or {}).get("provider_usage") or {}).get("reasoningOutput")) or 0) for item in items),
            "provider_tokens": sum(int((((item.get("metrics") or {}).get("provider_usage") or {}).get("totalTokens")) or 0) for item in items),
        }

    return {
        "schema": SUMMARY_SCHEMA,
        "generated_at": utc_now(),
        "invocation": invocation,
        "selected": aggregate(selected),
        "retry_inclusive": aggregate(all_attempts),
        "failed_selected_tasks": [item["task_id"] for item in selected if not strict_pass(item)],
        "selected_tasks": [
            {
                "task_id": item["task_id"],
                "task_slug": item["task_slug"],
                "selected_attempt": task["selected_attempt"] + 1,
                "judge": item["judge"],
                "agent_wall_seconds": item["agent_wall_seconds"],
                "subscription_billed_cost": None,
                "api_equivalent_cost": item["metrics"]["api_equivalent_cost"]["total"],
                "codex_turns": item["metrics"]["codex_turns"],
                "provider_usage": item["metrics"]["provider_usage"],
                "error": item.get("error"),
            }
            for task, item in zip(tasks, selected)
        ],
    }


def write_summary_markdown(path: Path, summary: dict[str, Any]) -> None:
    selected = summary["selected"]
    lines = [
        "# Vanilla Codex benchmark summary",
        "",
        f"- Strict passes: **{selected['strict_passes']}/{selected['runs']}**",
        f"- Agent wall time: **{selected['agent_wall_seconds']:.3f} s**",
        f"- Cost: **${selected['api_equivalent_cost']:.6f}**",
        "- Underlying model API calls: **N/A** (not exposed by Codex CLI JSONL)",
        f"- Codex staged turns: **{selected['codex_turns']}**",
        f"- Provider tokens: **{selected['provider_tokens']:,}**",
        f"- Input / cached input / output: **{selected['input_tokens']:,} / {selected['cached_input_tokens']:,} / {selected['output_tokens']:,}**",
        f"- Cache-write input / reasoning output (subsets): **{selected['cache_write_input_tokens']:,} / {selected['reasoning_output_tokens']:,}**",
        f"- Selected failures: **{summary['failed_selected_tasks']}**",
        "",
        "| Task | Result | Agent seconds | Cost | Turns | Provider tokens | Attempt |",
        "|---:|---|---:|---:|---:|---:|---:|",
    ]
    for item in summary["selected_tasks"]:
        judge = item["judge"]
        result = f"{str(judge.get('status', 'error')).upper()} {judge.get('main_checks_passed', 0)}/{judge.get('main_checks_total', 0)} + {'edge' if judge.get('edge_check_passed') else 'no edge'} (P{judge.get('progress_level', 0)})"
        lines.append(
            f"| {item['task_id']} | {result} | {item['agent_wall_seconds']:.3f} | ${item['api_equivalent_cost']:.6f} | {item['codex_turns']} | {item['provider_usage']['totalTokens']:,} | A{item['selected_attempt']} |"
        )
    path.write_text("\n".join(lines) + "\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", default="1-30")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--codex", default=shutil.which("codex") or "codex")
    parser.add_argument("--auth-file", type=Path, default=Path.home() / ".codex" / "auth.json")
    parser.add_argument("--max-workers", type=int, default=6)
    parser.add_argument("--retry-failed", type=int, choices=(0, 1), default=1)
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    parser.add_argument("--bwrap", default=shutil.which("bwrap"))
    parser.add_argument("--input-rate", type=float, default=DEFAULT_RATES["input"])
    parser.add_argument("--cached-input-rate", type=float, default=DEFAULT_RATES["cached_input"])
    parser.add_argument("--output-rate", type=float, default=DEFAULT_RATES["output"])
    return parser


def main() -> int:
    args = build_parser().parse_args()
    require_python312()
    output = args.output.resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError(f"output directory must be fresh and empty: {output}")
    output.mkdir(parents=True, exist_ok=True)
    codex = str(Path(args.codex).expanduser().resolve())
    auth_file = args.auth_file.expanduser().resolve()
    if not Path(codex).is_file():
        raise FileNotFoundError(f"codex executable not found: {codex}")
    if not auth_file.is_file():
        raise FileNotFoundError(f"ChatGPT subscription auth file not found: {auth_file}")
    completed = subprocess.run([codex, "--version"], text=True, capture_output=True, timeout=20)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr or completed.stdout)
    version_text = completed.stdout.strip()
    login = subprocess.run([codex, "login", "status"], text=True, capture_output=True, timeout=20)
    login_text = login.stdout + login.stderr
    if login.returncode != 0 or "ChatGPT" not in login_text:
        raise RuntimeError("Codex must be logged in with the ChatGPT subscription")
    scenarios = load_scenarios(ROOT)
    task_ids = parse_task_ids(args.tasks, scenarios)
    publication_protocol = task_ids == list(range(1, 31)) and args.max_workers == 6 and args.retry_failed == 1
    rates = {"input": args.input_rate, "cached_input": args.cached_input_rate, "output": args.output_rate}
    run_root = Path(tempfile.mkdtemp(prefix="prime-context-codex-realworld30-", dir="/tmp"))
    codex_home = run_root / "codex-home"
    codex_home.mkdir()
    (run_root / "empty-home").mkdir()
    shutil.copy2(auth_file, codex_home / "auth.json")
    (codex_home / "auth.json").chmod(0o600)
    verify_clean_context(run_root / "workspace-probe", codex_home)
    isolated_environment = clean_codex_environment(codex_home)
    isolated_login = subprocess.run(
        [codex, "login", "status"],
        env=isolated_environment,
        text=True,
        capture_output=True,
        timeout=20,
    )
    isolated_login_text = isolated_login.stdout + isolated_login.stderr
    if isolated_login.returncode != 0 or "ChatGPT" not in isolated_login_text:
        raise RuntimeError("isolated CODEX_HOME is not logged in with the ChatGPT subscription")
    invocation = {
        "schema": INVOCATION_SCHEMA,
        "started_at": utc_now(),
        "tasks": task_ids,
        "variant": "vanilla-codex",
        "codex_executable": codex,
        "codex_version": version_text,
        "auth_mode": "ChatGPT subscription",
        "api_key_environment": [],
        "model": MODEL,
        "reasoning_effort": REASONING_EFFORT,
        "max_workers": args.max_workers,
        "retry_failed": args.retry_failed,
        "timeout_seconds": args.timeout_seconds,
        "sandbox": "workspace-write",
        "sandbox_network": "stock command network proxy; exact 127.0.0.1 allow rule only; other command destinations blocked",
        "approval_policy": "never (Codex exec default observed by CLI audit)",
        "environment": "explicit allowlist equivalent to env -i; no API-key variables",
        "environment_keys": ["CODEX_HOME", "HOME", "LANG", "LC_ALL", "PATH", "PIP_DISABLE_PIP_VERSION_CHECK", "PIP_NO_INDEX", "PYTHONDONTWRITEBYTECODE", "PYTHONUTF8", "TERM", "TZ", "UV_OFFLINE", "npm_config_audit", "npm_config_fund", "npm_config_offline"],
        "home_isolation": "empty HOME plus fresh run-scoped CODEX_HOME shared by concurrent attempts; only auth.json at startup",
        "prompt_delivery": "benchmark user message on stdin only",
        "user_config": "ignored (--ignore-user-config)",
        "exec_rules": "ignored (--ignore-rules)",
        "custom_system_prompt": None,
        "custom_developer_prompt": None,
        "builtin_system_prompt": "stock Codex CLI base, developer, skill, collaboration, and recommended-plugin context only",
        "enterprise_policy_visibility": "server-side policy, if any, is not observable locally",
        "system_config_files": [],
        "agent_instruction_files": [],
        "workspace_root": "/tmp outside every repository and AGENTS.md/.codex search path",
        "subscription_billed_cost": None,
        "api_equivalent_rates_per_million": rates,
        "publication_protocol": publication_protocol,
    }
    json_dump(output / "invocation.json", invocation)
    attempts: dict[int, list[dict[str, Any]]] = {task_id: [] for task_id in task_ids}

    def submit_attempt(task_id: int, attempt: int) -> dict[str, Any]:
        task_dir, scenario = scenarios[task_id]
        result = run_attempt(codex, auth_file, codex_home, task_dir, scenario, output, attempt, args.timeout_seconds, args.bwrap, rates)
        status = "PASS" if strict_pass(result) else "FAIL"
        usage = result["metrics"]["provider_usage"]
        print(
            f"task {task_id:02d} codex A{attempt}: {status} "
            f"P{result['judge'].get('progress_level', 0)} {result['agent_wall_seconds']:.3f}s "
            f"{usage['totalTokens']} tokens ${result['metrics']['api_equivalent_cost']['total']:.6f} cost",
            flush=True,
        )
        return result

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.max_workers) as pool:
            futures = {pool.submit(submit_attempt, task_id, 1): task_id for task_id in task_ids}
            for future in concurrent.futures.as_completed(futures):
                attempts[futures[future]].append(future.result())
        retry_ids = [task_id for task_id in task_ids if args.retry_failed and not strict_pass(attempts[task_id][0])]
        if retry_ids:
            print(f"retrying failed Codex tasks once: {retry_ids}", flush=True)
            with concurrent.futures.ThreadPoolExecutor(max_workers=args.max_workers) as pool:
                futures = {pool.submit(submit_attempt, task_id, 2): task_id for task_id in retry_ids}
                for future in concurrent.futures.as_completed(futures):
                    attempts[futures[future]].append(future.result())
        tasks: list[dict[str, Any]] = []
        for task_id in task_ids:
            values = attempts[task_id]
            selected_index = max(range(len(values)), key=lambda index: attempt_key(values[index]))
            task = {
                "task_id": task_id,
                "task_slug": scenarios[task_id][1]["slug"],
                "variant": "codex",
                "attempts": values,
                "selected_attempt": selected_index,
                "retry_triggers": [] if len(values) == 1 else [{"attempt": 2, "reasons": ["strict_failure"]}],
            }
            tasks.append(task)
            json_dump(output / f"task-{task_id:02d}-{task['task_slug']}" / "codex" / "attempts.json", task)
        invocation["completed_at"] = utc_now()
        json_dump(output / "invocation.json", invocation)
        results = {"schema": RESULTS_SCHEMA, "invocation": invocation, "tasks": tasks}
        json_dump(output / "results.json", results)
        summary = build_summary(tasks, invocation)
        json_dump(output / "summary.json", summary)
        write_summary_markdown(output / "SUMMARY.md", summary)
        (codex_home / "auth.json").unlink(missing_ok=True)
        copy_session_records(codex_home, output / "codex-sessions")
        print(json.dumps(summary["selected"], sort_keys=True), flush=True)
        return 0
    finally:
        (codex_home / "auth.json").unlink(missing_ok=True)
        shutil.rmtree(run_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
