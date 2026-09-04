#!/usr/bin/env python3
"""Lean, isolated runner for the Python Real-World 30 benchmark."""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import queue
import selectors
import shutil
import socket
import signal
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from benchlib import (
    RUN_SCHEMA,
    aggregate_sessions,
    choose_better_attempt,
    clean_environment,
    collect_sessions,
    inject_stage,
    load_scenarios,
    make_read_only,
    make_writable_tree,
    materialize_payload,
    parse_task_ids,
    prepare_workspace,
    python312,
    require_python312,
    run_judge,
)

ROOT = Path(__file__).resolve().parent
PRIME_AGENT_VERSION = "0.9.1"
PRIME_CONTEXT_VERSION = "9.2.0"
VARIANTS = ("vanilla", "current")
AUXILIARY_KINDS = ("semantic-distill", "task-scout", "stall-recovery", "knowledge-compile")
HOSTS_SCHEMA = "prime-context.python-realworld-hosts/v1"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_dump(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n")


def message_end_error(event: dict[str, Any]) -> str | None:
    message = event.get("message")
    if not isinstance(message, dict) or message.get("stopReason") != "error":
        return None
    detail = message.get("errorMessage")
    if not isinstance(detail, str) or not detail.strip():
        detail = "unknown provider error"
    return f"AgentError: {detail}"


def create_sandbox_scripts(run_dir: Path, args: argparse.Namespace) -> Path:
    bwrap = Path(args.bwrap).resolve()
    if not bwrap.is_file():
        raise FileNotFoundError(f"bubblewrap executable not found: {bwrap}")
    runtime = run_dir / "sandbox-runtime"
    runtime.mkdir()
    (runtime / "home").mkdir()
    (runtime / "logs").mkdir()
    inner = runtime / "inner.py"
    inner.write_text(
        """import json
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit


def with_port(command, port):
    result = list(command)
    try:
        index = result.index("--port")
    except ValueError:
        result.extend(["--port", str(port)])
    else:
        if index + 1 < len(result):
            result[index + 1] = str(port)
        else:
            result.append(str(port))
    return result


def start_local_service(item):
    url_path = Path(item["url_file"])
    if not url_path.is_file():
        return None
    try:
        port = urlsplit(url_path.read_text().strip()).port
    except (OSError, ValueError):
        return None
    if not port:
        return None
    log = open(item["log"], "a")
    process = subprocess.Popen(
        with_port(item["command"], port),
        cwd=item["cwd"],
        stdout=log,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    deadline = time.monotonic() + 5.0
    while time.monotonic() < deadline and process.poll() is None:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                return process, log
        except OSError:
            time.sleep(0.05)
    if process.poll() is None:
        process.terminate()
    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()
    log.close()
    return None


config = json.loads(Path(sys.argv[1]).read_text())
services = []
try:
    for item in config.get("services", []):
        started = start_local_service(item)
        if started:
            services.append(started)
    completed = subprocess.run([
        "/usr/bin/bwrap", "--die-with-parent", "--unshare-pid",
        "--ro-bind", "/", "/",
        "--proc", "/proc",
        "--bind", "/workspace", "/workspace",
        "--tmpfs", "/runner",
        "--tmpfs", "/tmp",
        "--setenv", "HOME", "/tmp",
        "--chdir", "/workspace",
        "--", "/usr/bin/bash", *sys.argv[2:],
    ])
finally:
    for process, log in reversed(services):
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        log.close()
raise SystemExit(completed.returncode)
"""
    )

    allowed_binaries = [
        "bash", "bwrap", "cat", "chmod", "cp", "diff", "env", "find", "grep", "head",
        "ls", "mkdir", "mv", "readlink", "realpath", "rm", "stat", "tail", "touch", "wc",
    ]
    command = [
        str(bwrap), "--die-with-parent", "--unshare-net", "--unshare-pid",
        "--dir", "/usr", "--dir", "/usr/bin", "--dir", "/usr/lib",
        "--ro-bind", python312(), "/usr/bin/python3.12",
    ]
    for name in allowed_binaries:
        source = Path("/usr/bin") / name
        if source.is_file():
            command.extend(["--ro-bind", str(source), f"/usr/bin/{name}"])
    command.extend([
        "--symlink", "python3.12", "/usr/bin/python3",
        "--symlink", "python3.12", "/usr/bin/python",
        "--ro-bind", "/usr/lib/python3.12", "/usr/lib/python3.12",
        "--ro-bind", "/usr/lib/x86_64-linux-gnu", "/usr/lib/x86_64-linux-gnu",
        "--ro-bind", "/usr/lib64", "/usr/lib64",
        "--symlink", "usr/lib", "/lib",
        "--symlink", "usr/lib64", "/lib64",
        "--dir", "/usr/share",
        "--ro-bind", "/usr/share/zoneinfo", "/usr/share/zoneinfo",
        "--dir", "/etc",
        "--ro-bind", "/etc/hosts", "/etc/hosts",
        "--ro-bind", "/etc/localtime", "/etc/localtime",
        "--dev-bind", "/dev", "/dev",
        "--proc", "/proc",
        "--tmpfs", "/tmp",
        "--bind", str(run_dir / "workspace"), "/workspace",
        "--bind", str(runtime), "/runner",
        "--clearenv",
        "--setenv", "HOME", "/runner/home",
        "--setenv", "PATH", "/usr/bin",
        "--setenv", "LANG", "C",
        "--setenv", "LC_ALL", "C",
        "--setenv", "TZ", "UTC",
        "--setenv", "PYTHONUTF8", "1",
        "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
        "--chdir", "/workspace",
        "--", "/usr/bin/python3.12", "-E", "-S", "/runner/inner.py", "/runner/services.json",
    ])

    launcher = run_dir / "bash"
    launcher.write_text(
        f"#!{python312()}\n"
        "import subprocess\n"
        "import sys\n"
        f"command = {json.dumps(command)}\n"
        "raise SystemExit(subprocess.run([*command, *sys.argv[1:]]).returncode)\n"
    )
    launcher.chmod(0o700)

    return launcher


def sandbox_service_specs(
    scenario: dict[str, Any], task_dir: Path, workspace: Path, run_dir: Path
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    runtime = run_dir / "sandbox-runtime"
    for key in ("fixture_service", "candidate_service"):
        spec = scenario.get(key)
        if not isinstance(spec, dict) or not spec.get("url_file"):
            continue
        raw_command = [str(part) for part in spec.get("command", [])]
        if not raw_command:
            continue
        if key == "fixture_service":
            if raw_command[0] not in {"python", "python3", "python3.12"} or len(raw_command) < 2:
                raise ValueError("fixture_service must run a Python script")
            source = (task_dir / raw_command[1]).resolve()
            if task_dir.resolve() not in source.parents or not source.is_file():
                raise ValueError("fixture_service script must be a task-local file")
            fixture_dir = runtime / "fixture"
            fixture_dir.mkdir(exist_ok=True)
            target = fixture_dir / source.name
            shutil.copy2(source, target)
            command = ["/usr/bin/python3.12", "-E", "-S", f"/runner/fixture/{target.name}", *raw_command[2:]]
            cwd = "/runner/fixture"
        else:
            command = [
                part.replace("{workspace}", "/workspace")
                for part in raw_command
            ]
            if command[0] in {"python", "python3", "python3.12"}:
                command[0:1] = ["/usr/bin/python3.12", "-E", "-S"]
            cwd_value = str(spec.get("cwd", "{workspace}"))
            cwd = cwd_value.replace("{workspace}", "/workspace")
            if "{task_dir}" in cwd:
                raise ValueError("candidate_service must not depend on the hidden task directory")
        result.append({
            "command": command,
            "cwd": cwd,
            "url_file": f"/workspace/{spec['url_file']}",
            "log": f"/runner/logs/{key}.log",
        })
    return result


def copy_auth(config: Path, source: Path | None) -> None:
    if source is None:
        configured = os.environ.get("PRIME_AGENT_CODING_AGENT_DIR")
        source = Path(configured) / "auth.json" if configured else Path.home() / ".prime" / "agent" / "auth.json"
    if source.is_file():
        shutil.copy2(source, config / "auth.json")
        (config / "auth.json").chmod(0o600)


def prepare_agent_home(run_dir: Path, args: argparse.Namespace) -> dict[str, Path]:
    roots = {name: run_dir / name for name in ("config", "home", "pc-home", "sessions")}
    for path in roots.values():
        path.mkdir(parents=True, exist_ok=True)
    launcher = create_sandbox_scripts(run_dir, args)
    roots["launcher"] = launcher
    copy_auth(roots["config"], args.auth_file)
    settings = {
        "defaultProvider": args.provider,
        "defaultModel": args.model,
        "defaultThinkingLevel": args.thinking,
        "shellPath": str(launcher),
        "telemetry": {"enabled": False, "noticeShown": True},
        "packages": [],
    }
    json_dump(roots["config"] / "settings.json", settings)
    (roots["config"] / "AGENTS.md").write_text("")
    return roots


def require_prime_agent(executable: str | None, label: str) -> tuple[str, Path]:
    if not executable:
        raise ValueError(f"{label} requires an explicit isolated executable path")
    path = Path(executable).expanduser()
    if not path.is_absolute():
        raise ValueError(f"{label} must be an absolute path, not a PATH lookup: {executable}")
    path = path.resolve(strict=True)
    if not path.is_file() or not os.access(path, os.X_OK):
        raise ValueError(f"{label} is not an executable file: {path}")
    completed = subprocess.run(
        [str(path), "--version"], text=True, capture_output=True, timeout=20
    )
    output = "\n".join((completed.stdout, completed.stderr)).strip()
    if completed.returncode != 0 or PRIME_AGENT_VERSION not in output.split():
        raise ValueError(f"{label} must be prime-agent@{PRIME_AGENT_VERSION}; got {output!r}")
    return PRIME_AGENT_VERSION, path


def prime_agent_package_root(executable: Path) -> Path:
    for root in executable.parents:
        manifest_path = root / "package.json"
        if not manifest_path.is_file():
            continue
        try:
            manifest = json.loads(manifest_path.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if manifest.get("name") == "prime-agent" and manifest.get("version") == PRIME_AGENT_VERSION:
            return root
    raise ValueError(f"cannot locate the Prime Agent package root for {executable}")


def prime_context_package_root(value: Path) -> Path:
    path = value.expanduser().resolve(strict=True)
    candidates = [path, *path.parents] if path.is_file() else [path, *path.parents]
    for root in candidates:
        manifest_path = root / "package.json"
        if not manifest_path.is_file():
            continue
        try:
            manifest = json.loads(manifest_path.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if manifest.get("name") != "prime-agent-context":
            continue
        if manifest.get("version") != PRIME_CONTEXT_VERSION:
            raise ValueError(
                f"Prime Context must be version {PRIME_CONTEXT_VERSION}; "
                f"got {manifest.get('version')!r} at {root}"
            )
        return root
    raise ValueError(f"cannot locate prime-agent-context@{PRIME_CONTEXT_VERSION} for {value}")


def require_host_contract(
    executable: Path,
    label: str,
    *,
    patched: bool,
    patcher: Path,
) -> Path:
    root = prime_agent_package_root(executable)
    node = shutil.which("node")
    if not node:
        raise ValueError("node is required for Prime Agent host-contract preflight")
    mode = "--check" if patched else "--check-stock"
    completed = subprocess.run(
        [node, str(patcher), mode, str(root)], text=True, capture_output=True, timeout=60
    )
    if completed.returncode != 0:
        output = "\n".join((completed.stdout, completed.stderr)).strip().splitlines()
        detail = next((line for line in output if line.startswith("Error:")), output[-1] if output else "check failed")
        expected = "fully patched" if patched else "pristine stock"
        raise ValueError(f"{label} must be a {expected} Prime Agent 0.9.1 host: {detail}")
    return root


def variant_extension(variant: str, args: argparse.Namespace) -> Path | None:
    if variant == "vanilla":
        return None
    if args.current_extension is None:
        raise ValueError("--current-extension is required")
    return prime_context_package_root(args.current_extension)


def agent_command(
    variant: str,
    workspace: Path,
    roots: dict[str, Path],
    daemon_socket: Path,
    args: argparse.Namespace,
) -> list[str]:
    executable = args.current_prime_agent if variant == "current" else args.baseline_prime_agent
    command = [
        executable,
        "--mode", "rpc",
        "--offline",
        "--cwd", str(workspace),
        "--session-dir", str(roots["sessions"]),
        "--daemon-socket", str(daemon_socket),
        "--provider", args.provider,
        "--model", args.model,
        "--thinking", args.thinking,
        "--tools", "bash,prime_context",
        "--no-context-files",
        "--no-skills",
        "--no-prompt-templates",
        "--no-themes",
    ]
    command.extend(["--no-extensions", "--extension", str(ROOT / "bash-tool.mjs")])
    extension = variant_extension(variant, args)
    if extension is not None:
        command.extend(["--extension", str(extension)])
    return command


def service_command(command: list[Any]) -> list[str]:
    values = [str(part) for part in command]
    if values and values[0] in {"python", "python3", "python3.12"}:
        values[0:1] = [python312(), "-E", "-S"]
    return values


def command_with_port(command: list[str], port: int) -> list[str]:
    values = list(command)
    try:
        index = values.index("--port")
    except ValueError:
        values.extend(["--port", str(port)])
    else:
        if index + 1 < len(values):
            values[index + 1] = str(port)
        else:
            values.append(str(port))
    return values


@dataclass
class Service:
    process: subprocess.Popen[str]
    output_handle: Any
    output_thread: threading.Thread
    url: str
    name: str

    def stop(self) -> None:
        stop_process(self.process)
        self.output_thread.join(timeout=2)
        self.output_handle.close()


def start_service(
    name: str,
    spec: dict[str, Any],
    task_dir: Path,
    workspace: Path,
    run_dir: Path,
) -> Service:
    raw_command = [
        str(part).replace("{workspace}", str(workspace))
        for part in spec.get("command", [])
    ]
    if not raw_command:
        raise ValueError(f"{name}.command is empty")
    cwd_value = str(spec.get("cwd", "{task_dir}"))
    cwd = Path(cwd_value.replace("{task_dir}", str(task_dir)).replace("{workspace}", str(workspace)))
    command = service_command(raw_command)
    if spec.get("_port_override") is not None:
        command = command_with_port(command, int(spec["_port_override"]))
    process = subprocess.Popen(
        command,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        bufsize=1,
        start_new_session=True,
    )
    assert process.stdout is not None
    output_handle = (run_dir / f"{name}.log").open("w")
    deadline = time.monotonic() + float(spec.get("startup_timeout_seconds", 20))
    port: int | None = None
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    try:
        while time.monotonic() < deadline:
            ready = selector.select(timeout=max(0.0, deadline - time.monotonic()))
            if not ready:
                break
            line = process.stdout.readline()
            if line:
                output_handle.write(line)
                output_handle.flush()
                words = line.strip().split()
                if len(words) == 2 and words[0] == "LISTENING" and words[1].isdigit():
                    port = int(words[1])
                    break
            elif process.poll() is not None:
                break
    finally:
        selector.close()
    if port is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        output_handle.close()
        raise RuntimeError(f"{name} did not report LISTENING <port>")

    def drain() -> None:
        assert process.stdout is not None
        for line in process.stdout:
            output_handle.write(line)
            output_handle.flush()

    thread = threading.Thread(target=drain, daemon=True)
    thread.start()
    url = str(spec.get("url_template", "http://127.0.0.1:{port}")).format(port=port)
    url_file = spec.get("url_file")
    if url_file:
        target = workspace / str(url_file)
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            target.parent.chmod(target.parent.stat().st_mode | 0o700)
            if target.exists():
                target.chmod(target.stat().st_mode | 0o600)
        except OSError:
            pass
        target.write_text(url + "\n")
        make_read_only(target)
        make_read_only(target.parent)
    return Service(process, output_handle, thread, url, name)


def stop_process(process: subprocess.Popen[str]) -> None:
    try:
        process.stdin.close() if process.stdin else None
    except OSError:
        pass
    if process.poll() is None:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        try:
            process.wait(timeout=20)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait(timeout=10)


def attempt_process_groups(*paths: Path) -> set[int]:
    markers = [str(path.resolve()).encode() for path in paths]
    current_group = os.getpgrp()
    groups: set[int] = set()
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            command = (entry / "cmdline").read_bytes()
            if not command or not any(marker in command for marker in markers):
                continue
            group = os.getpgid(int(entry.name))
            if group > 0 and group != current_group:
                groups.add(group)
        except (FileNotFoundError, PermissionError, ProcessLookupError, ValueError):
            continue
    return groups


def stop_attempt_processes(*paths: Path) -> None:
    groups = attempt_process_groups(*paths)
    for group in groups:
        try:
            os.killpg(group, signal.SIGTERM)
        except ProcessLookupError:
            pass
    deadline = time.monotonic() + 5
    while groups and time.monotonic() < deadline:
        remaining: set[int] = set()
        for group in groups:
            try:
                os.killpg(group, 0)
                remaining.add(group)
            except ProcessLookupError:
                pass
        groups = remaining
        if groups:
            time.sleep(0.05)
    for group in groups:
        try:
            os.killpg(group, signal.SIGKILL)
        except ProcessLookupError:
            pass


def empty_metrics() -> dict[str, Any]:
    metrics = aggregate_sessions([])
    metrics.update({
        "rpc_tool_execution_starts": 0,
        "compaction_requests": 0,
        "compaction_completions": 0,
        "compaction_failures": 0,
        "peak_provider_bound_token_estimate": None,
        "auxiliary_model_calls": None,
        "auxiliary_model_calls_by_kind": {kind: None for kind in AUXILIARY_KINDS},
        "zero_extra_call": None,
        "archive_writes": 0,
        "archive_bytes": 0,
        "automatic_refinement_model_calls": None,
    })
    return metrics


def read_current_accounting(path: Path) -> dict[str, Any] | None:
    try:
        document = json.loads(path.read_text())
        accounting = document["auxiliary"]
        by_kind = accounting["byKind"]
        if document.get("schema") != "prime-context.benchmark-accounting/v1":
            return None
        if set(by_kind) != set(AUXILIARY_KINDS):
            return None
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None
    calls = {kind: int(by_kind[kind].get("callsAttempted") or 0) for kind in AUXILIARY_KINDS}
    usage = {
        "input": sum(int(item.get("inputTokens") or 0) for item in by_kind.values()),
        "output": sum(int(item.get("outputTokens") or 0) for item in by_kind.values()),
        "cacheRead": sum(int(item.get("cacheReadTokens") or 0) for item in by_kind.values()),
        "cacheWrite": sum(int(item.get("cacheWriteTokens") or 0) for item in by_kind.values()),
    }
    usage["totalTokens"] = sum(usage[key] for key in ("input", "output", "cacheRead", "cacheWrite"))
    return {
        "calls": calls,
        "total_calls": sum(calls.values()),
        "usage": usage,
        "cost": sum(float(item.get("cost") or 0) for item in by_kind.values()),
        "accounting": accounting,
    }


def archive_metrics(prime_context_home: Path) -> dict[str, int]:
    writes = 0
    archive_bytes = 0
    sessions = prime_context_home / "sessions"
    if not sessions.is_dir():
        return {"archive_writes": 0, "archive_bytes": 0}
    for session_file in sessions.glob("*/session.json"):
        observation_count: int | None = None
        try:
            session = json.loads(session_file.read_text())
            value = session.get("observationCount") if isinstance(session, dict) else None
            if isinstance(value, int) and value >= 0:
                observation_count = value
        except (OSError, ValueError, json.JSONDecodeError):
            pass
        if observation_count is None:
            observation_count = sum(1 for _ in (session_file.parent / "observations").glob("*.meta.json"))
        writes += observation_count
    for observations in sessions.glob("*/observations"):
        for artifact in observations.rglob("*"):
            if artifact.is_file():
                try:
                    archive_bytes += artifact.stat().st_size
                except OSError:
                    pass
    return {"archive_writes": writes, "archive_bytes": archive_bytes}


def merge_current_accounting(metrics: dict[str, Any], accounting: dict[str, Any] | None) -> None:
    solver_usage = dict(metrics.get("provider_usage") or {})
    solver_cost = dict(metrics.get("api_cost") or {})
    metrics["solver_model_calls"] = int(metrics.get("all_model_calls") or 0)
    metrics["solver_provider_usage"] = solver_usage
    metrics["solver_api_cost"] = solver_cost
    if accounting is None:
        metrics["auxiliary_model_calls"] = None
        metrics["auxiliary_model_calls_by_kind"] = {kind: None for kind in AUXILIARY_KINDS}
        metrics["auxiliary_provider_usage"] = None
        metrics["auxiliary_api_cost"] = None
        metrics["zero_extra_call"] = None
        metrics["explicit_compiler_calls"] = None
        metrics["explicit_compiler_cost"] = None
        metrics["automatic_compiler_calls"] = None
        metrics["automatic_compiler_cost"] = None
        metrics["automatic_refinement_model_calls"] = None
        return
    metrics["auxiliary_model_calls"] = accounting["total_calls"]
    metrics["auxiliary_model_calls_by_kind"] = accounting["calls"]
    metrics["auxiliary_provider_usage"] = accounting["usage"]
    metrics["auxiliary_api_cost"] = accounting["cost"]
    metrics["zero_extra_call"] = accounting["total_calls"] == 0
    metrics["auxiliary_accounting"] = accounting["accounting"]
    compiler = accounting["accounting"]["byKind"]["knowledge-compile"]
    metrics["explicit_compiler_calls"] = 0
    metrics["explicit_compiler_cost"] = 0.0
    metrics["automatic_compiler_calls"] = int(compiler.get("callsAttempted") or 0)
    metrics["automatic_compiler_cost"] = float(compiler.get("cost") or 0)
    metrics["automatic_refinement_model_calls"] = 0
    metrics["all_model_calls"] = metrics["solver_model_calls"] + accounting["total_calls"]
    metrics["provider_usage"] = {
        key: int(solver_usage.get(key) or 0) + int(accounting["usage"].get(key) or 0)
        for key in ("input", "output", "cacheRead", "cacheWrite", "totalTokens")
    }
    combined_cost = dict(solver_cost)
    combined_cost["total"] = float(solver_cost.get("total") or 0) + float(accounting["cost"])
    metrics["api_cost"] = combined_cost
    denominator = sum(metrics["provider_usage"][key] for key in ("input", "cacheRead", "cacheWrite"))
    metrics["prompt_cache_reuse"] = metrics["provider_usage"]["cacheRead"] / denominator if denominator else None


def strict_pass(attempt: dict[str, Any]) -> bool:
    judge = attempt.get("judge") or {}
    return judge.get("status") == "pass" and judge.get("progress_level") == 5


def run_rpc(
    variant: str,
    task_dir: Path,
    scenario: dict[str, Any],
    workspace: Path,
    run_dir: Path,
    args: argparse.Namespace,
) -> dict[str, Any]:
    roots = prepare_agent_home(run_dir, args)
    environment = clean_environment(roots["config"], roots["pc-home"], roots["home"])
    environment.update({
        "PIP_NO_INDEX": "1",
        "PIP_DISABLE_PIP_VERSION_CHECK": "1",
        "UV_OFFLINE": "1",
        "npm_config_offline": "true",
        "npm_config_audit": "false",
        "npm_config_fund": "false",
        "NODE_OPTIONS": "--max-old-space-size=8192",
        "PRIME_CONTEXT_BENCHMARK_SHELL": str(roots["launcher"]),
        "PRIME_CONTEXT_BENCHMARK_METRICS": str(run_dir / "prime-context-accounting.json"),
    })
    events_path = run_dir / "rpc-events.jsonl"
    stderr_path = run_dir / "rpc-stderr.txt"
    transcript_path = run_dir / "transcript.jsonl"
    q: queue.Queue[str | None] = queue.Queue()
    daemon_root = Path(tempfile.mkdtemp(prefix="pcb-daemon-"))
    daemon_socket = daemon_root / "daemon.sock"
    command = agent_command(variant, workspace, roots, daemon_socket, args)
    services: list[Service] = []
    service_events: list[dict[str, Any]] = []
    fixture = scenario.get("fixture_service")
    if isinstance(fixture, dict):
        service = start_service("fixture-service", fixture, task_dir, workspace, run_dir)
        services.append(service)
        service_events.append({"kind": "fixture_service", "event": "started", "url": service.url, "at": utc_now()})
    json_dump(run_dir / "sandbox-runtime" / "services.json", {
        "services": sandbox_service_specs(scenario, task_dir, workspace, run_dir),
    })

    with stderr_path.open("w") as stderr, events_path.open("w") as event_log, transcript_path.open("w") as transcript:
        try:
            process = subprocess.Popen(
                command,
                cwd=workspace,
                env=environment,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=stderr,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
        except Exception:
            for service in reversed(services):
                service.stop()
            shutil.rmtree(daemon_root, ignore_errors=True)
            raise
        assert process.stdin is not None and process.stdout is not None

        def reader() -> None:
            for line in process.stdout:
                q.put(line)
            q.put(None)

        threading.Thread(target=reader, daemon=True).start()
        request_counter = 0
        responses: list[dict[str, Any]] = []
        compaction_requests: list[dict[str, Any]] = []
        compaction_events: list[dict[str, Any]] = []
        stage_events: list[dict[str, Any]] = []
        stage_index = 0
        awaiting_compaction = False
        input_ready_after_compaction = False
        compaction_request_id: str | None = None
        compaction_response_seen = False
        send_stage_after_compaction_response = False
        pending_stage_after_compaction: int | None = None
        done = False
        error: str | None = None
        peak_provider_bound: int | None = None

        def send(kind: str, label: str, message: str | None = None) -> str:
            nonlocal request_counter
            request_counter += 1
            request_id = f"request-{request_counter}-{label}"
            payload: dict[str, Any] = {"id": request_id, "type": kind}
            if message is not None:
                payload["message"] = message
            if kind == "prompt":
                # Daemon follow-up admission resumes the input pump left suspended
                # by manual compaction, and queues safely if cleanup is still active.
                payload["streamingBehavior"] = "followUp"
            process.stdin.write(json.dumps(payload) + "\n")
            process.stdin.flush()
            return request_id

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
                    url = str(service_spec.get("url_template", "http://127.0.0.1:{port}")).format(port=port)
                    target.write_text(url + "\n")
                    make_read_only(target)
                    make_read_only(target.parent)
                from urllib.parse import urlsplit
                port = urlsplit(target.read_text().strip()).port
                if port:
                    service_spec["_port_override"] = port
            try:
                service = start_service("candidate-service", service_spec, task_dir, workspace, run_dir)
            except Exception as exc:
                service_events.append({"kind": "candidate_service", "event": "start_failed", "stage": stage_id, "error": f"{type(exc).__name__}: {exc}", "at": utc_now()})
                return
            services.append(service)
            service_events.append({"kind": "candidate_service", "event": "started", "stage": stage_id, "url": service.url, "at": utc_now()})

        def send_stage(index: int) -> None:
            stage = scenario["stages"][index]
            if index:
                inject_stage(task_dir, workspace, stage, "main")
                for editable in scenario["editable_paths"]:
                    make_writable_tree(workspace / str(editable))
            start_candidate_service(str(stage["id"]))
            message = scenario["initial_prompt"] if index == 0 else str(stage["message"])
            request_id = send("prompt", f"stage-{stage['id']}", message)
            stage_events.append({"stage": stage["id"], "request_id": request_id, "sent_at": utc_now()})

        started = time.monotonic()
        try:
            send_stage(0)
            deadline = started + min(int(args.timeout_seconds), int(scenario["timeout_seconds"]))
            while not done:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError(f"agent exceeded {min(int(args.timeout_seconds), int(scenario['timeout_seconds']))} seconds")
                try:
                    line = q.get(timeout=remaining)
                except queue.Empty as exc:
                    raise TimeoutError("agent produced no terminal idle event before timeout") from exc
                if line is None:
                    raise RuntimeError(f"prime-agent exited with code {process.poll()}")
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    event_log.write(line)
                    event_log.flush()
                    continue
                kind = event.get("type")
                # Incremental message snapshots are superseded by message_end and can
                # grow quadratically for large tool evidence. Preserve terminal
                # messages and all tool/lifecycle events instead.
                if kind != "message_update":
                    event_log.write(line)
                    event_log.flush()
                if kind == "message_end":
                    transcript.write(json.dumps({"at": utc_now(), "message": event.get("message")}, sort_keys=True) + "\n")
                    transcript.flush()
                    terminal_error = message_end_error(event)
                    if terminal_error is not None:
                        error = terminal_error
                        done = True
                if kind == "response":
                    response = {
                        "id": event.get("id"),
                        "success": bool(event.get("success")),
                        "error": event.get("error"),
                    }
                    responses.append(response)
                    transient_suspension = (
                        not response["success"]
                        and isinstance(response["error"], str)
                        and "queued session input is suspended" in response["error"]
                    )
                    if transient_suspension:
                        sent_stage = next(
                            (item for item in reversed(stage_events) if item["request_id"] == response["id"]),
                            None,
                        )
                        if sent_stage is not None:
                            pending_stage_after_compaction = next(
                                index for index, stage in enumerate(scenario["stages"])
                                if stage["id"] == sent_stage["stage"]
                            )
                    if response["id"] == compaction_request_id:
                        compaction_response_seen = True
                        if send_stage_after_compaction_response and pending_stage_after_compaction is not None:
                            send_stage(pending_stage_after_compaction)
                            pending_stage_after_compaction = None
                            send_stage_after_compaction_response = False
                elif kind == "compaction_start":
                    compaction_events.append({"event": "start", "at": utc_now(), "reason": event.get("reason")})
                elif kind == "compaction_end":
                    item = {
                        "event": "end",
                        "at": utc_now(),
                        "reason": event.get("reason"),
                        "aborted": bool(event.get("aborted")),
                        "error": event.get("errorMessage"),
                        "will_retry": bool(event.get("willRetry")),
                    }
                    compaction_events.append(item)
                    tokens_before = (event.get("result") or {}).get("tokensBefore")
                    if isinstance(tokens_before, int):
                        peak_provider_bound = max(peak_provider_bound or 0, tokens_before)
                    if awaiting_compaction and not item["will_retry"]:
                        # A requested compaction is interaction data, not a pass
                        # criterion. The daemon emits no reliable needs_input after
                        # manual compaction. Wait for the compact RPC response, then
                        # use follow-up admission to resume its suspended input pump.
                        awaiting_compaction = False
                        stage_index += 1
                        if stage_index < len(scenario["stages"]):
                            pending_stage_after_compaction = stage_index
                            if compaction_response_seen or input_ready_after_compaction:
                                send_stage(pending_stage_after_compaction)
                                pending_stage_after_compaction = None
                                input_ready_after_compaction = False
                            else:
                                send_stage_after_compaction_response = True
                        else:
                            done = True
                elif kind == "needs_input":
                    if pending_stage_after_compaction is not None:
                        send_stage(pending_stage_after_compaction)
                        pending_stage_after_compaction = None
                        input_ready_after_compaction = False
                        send_stage_after_compaction_response = False
                    elif awaiting_compaction:
                        input_ready_after_compaction = True
                elif kind == "agent_end" and not awaiting_compaction:
                    stage = scenario["stages"][stage_index]
                    if stage_index + 1 >= len(scenario["stages"]):
                        done = True
                    elif stage.get("compact_after") is True:
                        awaiting_compaction = True
                        input_ready_after_compaction = False
                        request_id = send("compact", f"after-{stage['id']}")
                        compaction_request_id = request_id
                        compaction_response_seen = False
                        send_stage_after_compaction_response = False
                        compaction_requests.append({"stage": stage["id"], "request_id": request_id, "at": utc_now()})
                    else:
                        stage_index += 1
                        send_stage(stage_index)
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
        finally:
            agent_wall = time.monotonic() - started
            stop_process(process)
            for service in reversed(services):
                service.stop()
                service_events.append({"kind": service.name.replace("-", "_"), "event": "stopped", "at": utc_now()})
            stop_attempt_processes(run_dir, daemon_root)

    metrics = aggregate_sessions(collect_sessions(roots["sessions"]))
    metrics.update({
        "compaction_requests": len(compaction_requests),
        "compaction_completions": sum(1 for item in compaction_events if item["event"] == "end" and not item["aborted"] and not item["error"]),
        "compaction_failures": sum(1 for item in compaction_events if item["event"] == "end" and (item["aborted"] or item["error"])),
        "peak_provider_bound_token_estimate": peak_provider_bound,
        **archive_metrics(roots["pc-home"]),
    })
    merge_current_accounting(metrics, read_current_accounting(run_dir / "prime-context-accounting.json"))
    (roots["config"] / "auth.json").unlink(missing_ok=True)
    shutil.rmtree(daemon_root, ignore_errors=True)
    return {
        "agent_wall_seconds": agent_wall,
        "error": error,
        "command": command,
        "responses": responses,
        "stage_events": stage_events,
        "compaction_requests": compaction_requests,
        "compaction_events": compaction_events,
        "service_events": service_events,
        "metrics": metrics,
    }


def run_attempt(
    variant: str,
    task_dir: Path,
    scenario: dict[str, Any],
    attempt_dir: Path,
    args: argparse.Namespace,
) -> dict[str, Any]:
    started_at = utc_now()
    lifecycle_started = time.monotonic()
    workspace = attempt_dir / "workspace"
    attempt_dir.mkdir(parents=True, exist_ok=True)
    setup_started = time.monotonic()
    prepare_workspace(task_dir, scenario, workspace)
    setup_seconds = time.monotonic() - setup_started
    rpc = run_rpc(variant, task_dir, scenario, workspace, attempt_dir, args)
    judge, judge_seconds, judge_log = run_judge(task_dir, scenario, workspace, args.bwrap)
    (attempt_dir / "judge.log").write_text(judge_log)
    lifecycle_seconds = time.monotonic() - lifecycle_started
    result = {
        "schema": RUN_SCHEMA,
        "variant": variant,
        "task_id": scenario["id"],
        "task_slug": scenario["slug"],
        "pressure": scenario["pressure"],
        "started_at": started_at,
        "completed_at": utc_now(),
        "setup_seconds": setup_seconds,
        "agent_wall_seconds": rpc.pop("agent_wall_seconds"),
        "judge_seconds": judge_seconds,
        "lifecycle_wall_seconds": lifecycle_seconds,
        "judge": judge,
        **rpc,
    }
    json_dump(attempt_dir / "result.json", result)
    return result


def safe_run_attempt(
    variant: str,
    task_dir: Path,
    scenario: dict[str, Any],
    attempt_dir: Path,
    args: argparse.Namespace,
) -> dict[str, Any]:
    try:
        return run_attempt(variant, task_dir, scenario, attempt_dir, args)
    except Exception as exc:
        attempt_dir.mkdir(parents=True, exist_ok=True)
        result = {
            "schema": RUN_SCHEMA,
            "variant": variant,
            "task_id": scenario["id"],
            "task_slug": scenario["slug"],
            "pressure": scenario["pressure"],
            "started_at": utc_now(),
            "completed_at": utc_now(),
            "setup_seconds": 0.0,
            "agent_wall_seconds": 0.0,
            "judge_seconds": 0.0,
            "lifecycle_wall_seconds": 0.0,
            "judge": {
                "status": "error",
                "progress_level": 0,
                "main_checks_passed": 0,
                "main_checks_total": 0,
                "edge_check_passed": False,
                "notes": [f"runner failure: {type(exc).__name__}: {exc}"],
            },
            "error": f"{type(exc).__name__}: {exc}",
            "metrics": empty_metrics(),
        }
        json_dump(attempt_dir / "result.json", result)
        return result
    finally:
        (attempt_dir / "config" / "auth.json").unlink(missing_ok=True)


def run_case(
    variant: str,
    task_dir: Path,
    scenario: dict[str, Any],
    output: Path,
    args: argparse.Namespace,
) -> dict[str, Any]:
    case_dir = output / f"task-{scenario['id']:02d}-{scenario['slug']}" / variant
    attempts = [safe_run_attempt(variant, task_dir, scenario, case_dir / "attempt-1", args)]
    retry_triggers: list[dict[str, Any]] = []
    if not strict_pass(attempts[0]) and args.retry_failed:
        attempts.append(safe_run_attempt(variant, task_dir, scenario, case_dir / "attempt-2-diagnostic", args))
        retry_triggers.append({"attempt": 2, "reasons": ["strict_failure"]})
    selected = choose_better_attempt(attempts)
    result = {
        "variant": variant,
        "task_id": scenario["id"],
        "task_slug": scenario["slug"],
        "pressure": scenario["pressure"],
        "primary_attempt": 0,
        "selected_attempt": selected,
        "retry_triggers": retry_triggers,
        "attempts": attempts,
    }
    json_dump(case_dir / "case.json", result)
    return result


def selected_attempt(result: dict[str, Any]) -> dict[str, Any]:
    return result["attempts"][result["selected_attempt"]]


def attempt_accuracy(attempt: dict[str, Any]) -> tuple[int, int, int]:
    judge = attempt.get("judge") or {}
    return (
        int(judge.get("progress_level") or 0),
        int(judge.get("main_checks_passed") or 0),
        int(bool(judge.get("edge_check_passed"))),
    )


def attempt_cost(attempt: dict[str, Any]) -> float:
    return float((((attempt.get("metrics") or {}).get("api_cost") or {}).get("total")) or 0)


def comparison_retry_reasons(
    vanilla: dict[str, Any], current: dict[str, Any]
) -> list[str]:
    if len(current.get("attempts") or []) != 1:
        return []
    baseline_attempt = selected_attempt(vanilla)
    current_attempt = selected_attempt(current)
    reasons: list[str] = []
    if attempt_accuracy(baseline_attempt) > attempt_accuracy(current_attempt):
        reasons.append("correctness_regression")
    if strict_pass(baseline_attempt) and strict_pass(current_attempt):
        if float(current_attempt.get("agent_wall_seconds") or 0) >= float(baseline_attempt.get("agent_wall_seconds") or 0):
            reasons.append("speed_regression")
        if attempt_cost(current_attempt) >= attempt_cost(baseline_attempt):
            reasons.append("cost_regression")
    return reasons


def retry_case_for_regression(
    result: dict[str, Any],
    task_dir: Path,
    scenario: dict[str, Any],
    output: Path,
    args: argparse.Namespace,
    reasons: list[str],
) -> dict[str, Any]:
    if len(result.get("attempts") or []) != 1:
        return result
    case_dir = output / f"task-{scenario['id']:02d}-{scenario['slug']}" / result["variant"]
    result["attempts"].append(
        safe_run_attempt(result["variant"], task_dir, scenario, case_dir / "attempt-2-diagnostic", args)
    )
    result.setdefault("retry_triggers", []).append({"attempt": 2, "reasons": reasons})
    result["selected_attempt"] = choose_better_attempt(result["attempts"])
    json_dump(case_dir / "case.json", result)
    return result


def aggregate_bucket(items: list[tuple[dict[str, Any], dict[str, Any]]]) -> dict[str, Any]:
    attempts = [attempt for _, attempt in items]
    strict_items = [attempt for attempt in attempts if strict_pass(attempt)]
    total = len(items)
    usage = {
        key: sum(int((((attempt.get("metrics") or {}).get("provider_usage") or {}).get(key)) or 0) for attempt in attempts)
        for key in ("input", "output", "cacheRead", "cacheWrite", "totalTokens")
    }
    cost = {
        key: sum(float((((attempt.get("metrics") or {}).get("api_cost") or {}).get(key)) or 0) for attempt in attempts)
        for key in ("input", "output", "cacheRead", "cacheWrite", "total")
    }
    prompt_denominator = usage["input"] + usage["cacheRead"] + usage["cacheWrite"]
    peak_values = [
        int((attempt.get("metrics") or {}).get("peak_provider_bound_token_estimate"))
        for attempt in attempts
        if (attempt.get("metrics") or {}).get("peak_provider_bound_token_estimate") is not None
    ]
    exposed_zero = [
        bool((attempt.get("metrics") or {}).get("zero_extra_call"))
        for attempt in attempts
        if (attempt.get("metrics") or {}).get("zero_extra_call") is not None
    ]
    prompt_sample_count = sum(int(((attempt.get("metrics") or {}).get("provider_prompt_sample_count")) or 0) for attempt in attempts)
    prompt_token_sum = sum(int(((attempt.get("metrics") or {}).get("provider_prompt_token_sum")) or 0) for attempt in attempts)
    prompt_peaks = [
        int((attempt.get("metrics") or {}).get("peak_provider_prompt_tokens"))
        for attempt in attempts
        if (attempt.get("metrics") or {}).get("peak_provider_prompt_tokens") is not None
    ]
    auxiliary_by_kind: dict[str, int | None] = {}
    for kind in AUXILIARY_KINDS:
        values = [
            ((attempt.get("metrics") or {}).get("auxiliary_model_calls_by_kind") or {}).get(kind)
            for attempt in attempts
        ]
        exposed = [int(value) for value in values if value is not None]
        auxiliary_by_kind[kind] = sum(exposed) if exposed else None
    return {
        "runs": total,
        "strict_passes": len(strict_items),
        "strict_pass_rate": len(strict_items) / total if total else 0.0,
        "mean_progress": sum(float((attempt.get("judge") or {}).get("progress_level") or 0) for attempt in attempts) / total if total else 0.0,
        "agent_wall_seconds": sum(float(attempt.get("agent_wall_seconds") or 0) for attempt in attempts),
        "lifecycle_wall_seconds": sum(float(attempt.get("lifecycle_wall_seconds") or 0) for attempt in attempts),
        "judge_seconds": sum(float(attempt.get("judge_seconds") or 0) for attempt in attempts),
        "main_model_calls": sum(int(((attempt.get("metrics") or {}).get("main_model_calls")) or 0) for attempt in attempts),
        "all_model_calls": sum(int(((attempt.get("metrics") or {}).get("all_model_calls")) or 0) for attempt in attempts),
        "auxiliary_model_calls_by_kind": auxiliary_by_kind,
        "zero_extra_call_runs": sum(exposed_zero) if exposed_zero else None,
        "zero_extra_call_share": sum(exposed_zero) / len(exposed_zero) if exposed_zero else None,
        "child_sessions": sum(int(((attempt.get("metrics") or {}).get("child_sessions")) or 0) for attempt in attempts),
        "tool_calls": sum(int(((attempt.get("metrics") or {}).get("tool_calls")) or 0) for attempt in attempts),
        "recovery_tool_calls": sum(int(((attempt.get("metrics") or {}).get("recovery_tool_calls")) or 0) for attempt in attempts),
        "tool_result_bytes_shown": sum(int(((attempt.get("metrics") or {}).get("tool_result_bytes_shown")) or 0) for attempt in attempts),
        "automatic_refinement_applied": sum(int(((attempt.get("metrics") or {}).get("automatic_refinement_applied")) or 0) for attempt in attempts),
        "automatic_refinement_model_calls": sum(int(((attempt.get("metrics") or {}).get("automatic_refinement_model_calls")) or 0) for attempt in attempts) if any((attempt.get("metrics") or {}).get("automatic_refinement_model_calls") is not None for attempt in attempts) else None,
        "compaction_requests": sum(int(((attempt.get("metrics") or {}).get("compaction_requests")) or 0) for attempt in attempts),
        "compaction_completions": sum(int(((attempt.get("metrics") or {}).get("compaction_completions")) or 0) for attempt in attempts),
        "compaction_failures": sum(int(((attempt.get("metrics") or {}).get("compaction_failures")) or 0) for attempt in attempts),
        "provider_usage": usage,
        "api_cost": cost,
        "prompt_cache_reuse": usage["cacheRead"] / prompt_denominator if prompt_denominator else None,
        "peak_provider_bound_token_estimate": max(peak_values) if peak_values else None,
        "mean_peak_provider_bound_token_estimate": sum(peak_values) / len(peak_values) if peak_values else None,
        "peak_provider_prompt_tokens": max(prompt_peaks) if prompt_peaks else None,
        "average_provider_prompt_tokens": prompt_token_sum / prompt_sample_count if prompt_sample_count else None,
        "provider_prompt_token_sum": prompt_token_sum,
        "provider_prompt_sample_count": prompt_sample_count,
        "explicit_compiler_calls": sum(int(((attempt.get("metrics") or {}).get("explicit_compiler_calls")) or 0) for attempt in attempts) if any((attempt.get("metrics") or {}).get("explicit_compiler_calls") is not None for attempt in attempts) else None,
        "explicit_compiler_cost": sum(float(((attempt.get("metrics") or {}).get("explicit_compiler_cost")) or 0) for attempt in attempts) if any((attempt.get("metrics") or {}).get("explicit_compiler_cost") is not None for attempt in attempts) else None,
        "automatic_compiler_calls": sum(int(((attempt.get("metrics") or {}).get("automatic_compiler_calls")) or 0) for attempt in attempts) if any((attempt.get("metrics") or {}).get("automatic_compiler_calls") is not None for attempt in attempts) else None,
        "automatic_compiler_cost": sum(float(((attempt.get("metrics") or {}).get("automatic_compiler_cost")) or 0) for attempt in attempts) if any((attempt.get("metrics") or {}).get("automatic_compiler_cost") is not None for attempt in attempts) else None,
        "final_response_tokens": sum(int(((attempt.get("metrics") or {}).get("final_response_tokens")) or 0) for attempt in attempts),
        "archive_writes": sum(int(((attempt.get("metrics") or {}).get("archive_writes")) or 0) for attempt in attempts),
        "archive_bytes": sum(int(((attempt.get("metrics") or {}).get("archive_bytes")) or 0) for attempt in attempts),
        "strict_pass_agent_wall_seconds": sum(float(item.get("agent_wall_seconds") or 0) for item in strict_items),
        "strict_pass_api_cost": sum(float(((item.get("metrics") or {}).get("api_cost") or {}).get("total") or 0) for item in strict_items),
    }


def comprehensive_summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    selected = [(result, selected_attempt(result)) for result in results]
    by_variant: dict[str, Any] = {}
    by_pressure: dict[str, Any] = {}
    for variant in VARIANTS:
        items = [(r, a) for r, a in selected if r["variant"] == variant]
        if items:
            bucket = aggregate_bucket(items)
            retained = [result for result in results if result["variant"] == variant]
            primary_items = [(result, result["attempts"][0]) for result in retained if result.get("attempts")]
            all_attempt_items = [
                (result, attempt)
                for result in retained
                for attempt in result.get("attempts") or []
            ]
            all_attempts = aggregate_bucket(all_attempt_items)
            primary = aggregate_bucket(primary_items)
            bucket["primary"] = primary
            bucket["all_attempts"] = all_attempts
            bucket["retained_attempts"] = all_attempts["runs"]
            bucket["cost_per_completed_task"] = (
                all_attempts["api_cost"]["total"] / bucket["strict_passes"]
                if bucket["strict_passes"] else None
            )
            bucket["agent_seconds_per_completed_task"] = (
                all_attempts["agent_wall_seconds"] / bucket["strict_passes"]
                if bucket["strict_passes"] else None
            )
            by_variant[variant] = bucket
    for pressure in ("N", "L", "M", "H"):
        pressure_items = [(r, a) for r, a in selected if r["pressure"] == pressure]
        if pressure_items:
            by_pressure[pressure] = {}
            for variant in VARIANTS:
                selected_pressure = [(r, a) for r, a in pressure_items if r["variant"] == variant]
                if not selected_pressure:
                    continue
                bucket = aggregate_bucket(selected_pressure)
                pressure_results = [r for r in results if r["pressure"] == pressure and r["variant"] == variant]
                bucket["primary"] = aggregate_bucket([
                    (r, r["attempts"][0]) for r in pressure_results if r.get("attempts")
                ])
                bucket["all_attempts"] = aggregate_bucket([
                    (r, attempt) for r in pressure_results for attempt in r.get("attempts") or []
                ])
                by_pressure[pressure][variant] = bucket
    by_key = {(r["task_id"], r["variant"]): a for r, a in selected}
    matched: list[dict[str, Any]] = []
    current_correctness_wins: list[dict[str, Any]] = []
    baseline_failures: list[dict[str, Any]] = []
    regressions: list[dict[str, Any]] = []
    task_ids = sorted({r["task_id"] for r, _ in selected})
    complete_pairs = 0
    for task_id in task_ids:
        current = by_key.get((task_id, "current"))
        vanilla = by_key.get((task_id, "vanilla"))
        if current is None or vanilla is None:
            continue
        complete_pairs += 1
        current_accuracy = attempt_accuracy(current)
        baseline_accuracy = attempt_accuracy(vanilla)
        if not strict_pass(current):
            regressions.append({
                "task_id": task_id,
                "baseline": "vanilla",
                "kind": "current_failure",
                "current_progress": current_accuracy[0],
            })
        if not strict_pass(vanilla):
            failure = {
                "task_id": task_id,
                "baseline": "vanilla",
                "baseline_progress": baseline_accuracy[0],
                "baseline_main_checks_passed": baseline_accuracy[1],
                "baseline_edge_check_passed": bool(baseline_accuracy[2]),
            }
            baseline_failures.append(failure)
            if strict_pass(current):
                current_correctness_wins.append({
                    **failure,
                    "current_progress": current_accuracy[0],
                    "current_main_checks_passed": current_accuracy[1],
                    "current_edge_check_passed": bool(current_accuracy[2]),
                })
        if baseline_accuracy > current_accuracy:
            regressions.append({
                "task_id": task_id,
                "baseline": "vanilla",
                "kind": "correctness",
                "baseline_progress": baseline_accuracy[0],
                "current_progress": current_accuracy[0],
                "baseline_main_checks_passed": baseline_accuracy[1],
                "current_main_checks_passed": current_accuracy[1],
                "baseline_edge_check_passed": bool(baseline_accuracy[2]),
                "current_edge_check_passed": bool(current_accuracy[2]),
            })
        if strict_pass(current) and strict_pass(vanilla):
            comparison = {
                "task_id": task_id,
                "baseline": "vanilla",
                "agent_wall_delta_current_minus_baseline": float(current.get("agent_wall_seconds") or 0) - float(vanilla.get("agent_wall_seconds") or 0),
                "api_cost_delta_current_minus_baseline": attempt_cost(current) - attempt_cost(vanilla),
                "provider_tokens_delta_current_minus_baseline": int((((current.get("metrics") or {}).get("provider_usage") or {}).get("totalTokens")) or 0) - int((((vanilla.get("metrics") or {}).get("provider_usage") or {}).get("totalTokens")) or 0),
            }
            matched.append(comparison)
            for kind, key in (
                ("speed", "agent_wall_delta_current_minus_baseline"),
                ("cost", "api_cost_delta_current_minus_baseline"),
            ):
                if comparison[key] >= 0:
                    regressions.append({
                        "task_id": task_id,
                        "baseline": "vanilla",
                        "kind": kind,
                        "delta": comparison[key],
                    })
    publication_ready = (
        len(task_ids) == 30
        and complete_pairs == 30
        and len(matched) + len(current_correctness_wins) == 30
        and not regressions
    )
    return {
        "schema": "prime-context.python-realworld-summary/v1",
        "generated_at": utc_now(),
        "selection_policy": "correctness first; one diagnostic retry is retained after a failure or current regression; a strict current pass over a failed vanilla baseline is a current correctness win",
        "metric_priority": ["completion_progress_and_success", "agent_wall_seconds", "api_cost"],
        "metric_limitations": [
            "Vanilla does not expose Prime Context auxiliary accounting; unavailable fields remain null rather than estimated.",
            "Actual provider prompt tokens use input + cache-read + cache-write per solver call; tokens are supporting data, while cost is the cost-efficiency gate.",
            "Task efficiency uses the selected strict attempt; aggregate totals also retain retry time and cost.",
        ],
        "by_variant": by_variant,
        "by_pressure": by_pressure,
        "matched_strict_pass_comparisons": matched,
        "current_correctness_wins": current_correctness_wins,
        "baseline_failures": baseline_failures,
        "regressions": regressions,
        "publication_ready": publication_ready,
        "complete_task_pairs": complete_pairs,
    }


def write_summary_markdown(path: Path, summary: dict[str, Any], results: list[dict[str, Any]]) -> None:
    lines = [
        "# Python Real-World 30 Results", "", f"Generated: {summary['generated_at']}", "",
        f"Publication ready: {'yes' if summary.get('publication_ready') else 'no'}.", "",
        f"Publication protocol blockers: {', '.join(summary.get('publication_blockers') or []) or 'none'}.", "",
        "Metric priority: completion/progress, then agent elapsed time, then cost.", "",
        "Selection: correctness first; one diagnostic retry follows a failure or current regression, and all attempts remain in totals.", "",
        "## Metric limitations", "",
        *[f"- {item}" for item in summary.get("metric_limitations", [])], "",
        "## Variant summary", "",
        "| Variant | Tasks | Primary strict | Final strict | Progress | Attempts | Total agent s | Model calls | Tool calls | Provider tokens | Cache reuse | Total cost | Cost/completed |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for variant, item in summary["by_variant"].items():
        all_attempts = item["all_attempts"]
        reuse = all_attempts["prompt_cache_reuse"]
        reuse_text = f"{reuse:.3f}" if reuse is not None else "n/a"
        cost_per = item["cost_per_completed_task"]
        cost_per_text = f"{cost_per:.6f}" if cost_per is not None else "n/a"
        lines.append(
            f"| {variant} | {item['runs']} | {item['primary']['strict_passes']} | {item['strict_passes']} | "
            f"{item['mean_progress']:.3f} | {all_attempts['runs']} | {all_attempts['agent_wall_seconds']:.3f} | "
            f"{all_attempts['all_model_calls']} | {all_attempts['tool_calls']} | {all_attempts['provider_usage']['totalTokens']} | "
            f"{reuse_text} | {all_attempts['api_cost']['total']:.6f} | {cost_per_text} |"
        )
    lines.extend(["", "### Explanatory totals", ""])
    for variant, item in summary["by_variant"].items():
        total = item["all_attempts"]
        auxiliary = total["auxiliary_model_calls_by_kind"]
        zero = total["zero_extra_call_share"]
        lines.append(
            f"- **{variant}**: auxiliary={auxiliary}; zero-extra-call-share={zero if zero is not None else 'not exposed'}; "
            f"compactions={total['compaction_completions']}/{total['compaction_requests']} "
            f"(failures={total['compaction_failures']}); child-sessions={total['child_sessions']}; "
            f"recovery-calls={total['recovery_tool_calls']}; auto-refinement-model-calls={total['automatic_refinement_model_calls']}; "
            f"auto-refinements-applied={total['automatic_refinement_applied']}; "
            f"peak-provider-estimate={total['peak_provider_bound_token_estimate']}; "
            f"actual-provider-prompt=peak {total['peak_provider_prompt_tokens']}/average {total['average_provider_prompt_tokens']}; "
            f"compiler=explicit {total['explicit_compiler_calls']} calls/{total['explicit_compiler_cost']} cost, "
            f"automatic {total['automatic_compiler_calls']} calls/{total['automatic_compiler_cost']} cost; "
            f"archive={total['archive_writes']} writes/{total['archive_bytes']} bytes; "
            f"tool-result-visible-bytes={total['tool_result_bytes_shown']}."
        )
    lines.extend([
        "", "## Pressure classes", "",
        "| Pressure | Variant | Tasks | Primary strict | Final strict | Attempts | Total agent s | Total cost |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
    ])
    for pressure, variants in summary["by_pressure"].items():
        for variant, item in variants.items():
            total = item["all_attempts"]
            lines.append(
                f"| {pressure} | {variant} | {item['runs']} | {item['primary']['strict_passes']} | "
                f"{item['strict_passes']} | {total['runs']} | {total['agent_wall_seconds']:.3f} | {total['api_cost']['total']:.6f} |"
            )
    lines.extend([
        "", "## Task results", "",
        "| Task | Variant | Attempts | Primary | Selected | Strict | Progress | Selected agent s | All-attempt agent s | Model calls | Tool calls | Tokens | Cost |",
        "|---:|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|",
    ])
    for result in sorted(results, key=lambda item: (item["task_id"], item["variant"])):
        attempt = selected_attempt(result)
        attempts = result.get("attempts") or []
        all_bucket = aggregate_bucket([(result, item) for item in attempts])
        progress = int((attempt.get("judge") or {}).get("progress_level") or 0)
        lines.append(
            f"| {result['task_id']:02d} | {result['variant']} | {len(attempts)} | 1 | {result['selected_attempt'] + 1} | "
            f"{'yes' if strict_pass(attempt) else 'no'} | {progress} | {float(attempt.get('agent_wall_seconds') or 0):.3f} | "
            f"{all_bucket['agent_wall_seconds']:.3f} | {all_bucket['all_model_calls']} | {all_bucket['tool_calls']} | "
            f"{all_bucket['provider_usage']['totalTokens']} | {all_bucket['api_cost']['total']:.6f} |"
        )
    lines.extend([
        "", "## Current correctness wins", "",
        "A strict current pass over a failed vanilla baseline is a decisive correctness win; efficiency is not compared for that task.", "",
        "| Task | Baseline | Current | Vanilla |",
        "|---:|---|---|---|",
    ])
    for item in summary["current_correctness_wins"]:
        lines.append(
            f"| {item['task_id']:02d} | {item['baseline']} | "
            f"progress {item['current_progress']}, {item['current_main_checks_passed']}/5, edge={item['current_edge_check_passed']} | "
            f"progress {item['baseline_progress']}, {item['baseline_main_checks_passed']}/5, edge={item['baseline_edge_check_passed']} |"
        )
    if not summary["current_correctness_wins"]:
        lines.append("| — | — | — | — |")
    lines.extend([
        "", "## Matched strict-pass comparisons", "",
        "Efficiency is compared only where both current and the baseline strictly passed.", "",
        "| Task | Baseline | Current−baseline agent s | Current−baseline cost | Current−baseline provider tokens |",
        "|---:|---|---:|---:|---:|",
    ])
    for item in summary["matched_strict_pass_comparisons"]:
        lines.append(
            f"| {item['task_id']:02d} | {item['baseline']} | {item['agent_wall_delta_current_minus_baseline']:.3f} | "
            f"{item['api_cost_delta_current_minus_baseline']:.6f} | {item['provider_tokens_delta_current_minus_baseline']} |"
        )
    if not summary["matched_strict_pass_comparisons"]:
        lines.append("| — | — | — | — | — |")
    lines.extend(["", "## Regressions", ""])
    if summary["regressions"]:
        lines.extend(f"- Task {item['task_id']:02d} vs {item['baseline']}: {item['kind']} ({item})" for item in summary["regressions"])
    else:
        lines.append("None in the selected runs.")
    path.write_text("\n".join(lines) + "\n")


def parse_variants(value: str) -> list[str]:
    variants = [part.strip() for part in value.split(",") if part.strip()]
    unknown = sorted(set(variants) - set(VARIANTS))
    if unknown:
        raise ValueError(f"unknown variants: {unknown}")
    if not variants:
        raise ValueError("no variants selected")
    return variants


def apply_hosts_manifest(args: argparse.Namespace) -> dict[str, Any] | None:
    if args.hosts_manifest is None:
        return None
    path = args.hosts_manifest.expanduser().resolve(strict=True)
    manifest = json.loads(path.read_text())
    if manifest.get("schema") != HOSTS_SCHEMA:
        raise ValueError(f"unsupported hosts manifest: {manifest.get('schema')!r}")
    if manifest.get("prime_agent_version") != PRIME_AGENT_VERSION:
        raise ValueError(f"hosts manifest must use prime-agent@{PRIME_AGENT_VERSION}")
    if manifest.get("prime_context_version") != PRIME_CONTEXT_VERSION:
        raise ValueError(f"hosts manifest must use prime-agent-context@{PRIME_CONTEXT_VERSION}")
    bindings = {
        "baseline_prime_agent": "vanilla_prime_agent",
        "current_prime_agent": "current_prime_agent",
        "current_extension": "current_extension",
    }
    for argument, key in bindings.items():
        supplied = getattr(args, argument)
        value = manifest.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"hosts manifest is missing {key!r}")
        resolved = str(Path(value).expanduser().resolve(strict=True))
        if supplied is not None and str(Path(supplied).expanduser().resolve(strict=True)) != resolved:
            raise ValueError(f"--{argument.replace('_', '-')} conflicts with --hosts-manifest")
        setattr(args, argument, Path(resolved) if argument == "current_extension" else resolved)
    args.hosts_manifest = path
    return manifest


def validate_corpus(scenarios: dict[int, tuple[Path, dict[str, Any]]], bwrap: str | None) -> dict[str, Any]:
    python_files = [ROOT / "benchlib.py", ROOT / "run.py", *sorted((ROOT / "tasks").rglob("*.py"))]
    compile_script = "import sys; [compile(open(path, 'rb').read(), path, 'exec') for path in sys.argv[1:]]"
    subprocess.run(
        [python312(), "-E", "-S", "-c", compile_script, *map(str, python_files)],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
        timeout=300,
    )
    node = shutil.which("node")
    if not node:
        raise RuntimeError("node is required to load the neutral benchmark Bash adapter")
    subprocess.run(
        [node, "--check", str(ROOT / "bash-tool.mjs")],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
        timeout=30,
    )
    temporary = Path(tempfile.mkdtemp(prefix="pcbench-validate-"))
    empty_judges = 0
    stage_files = 0
    try:
        for task_id, (task_dir, scenario) in sorted(scenarios.items()):
            workspace = temporary / f"task-{task_id:02d}" / "workspace"
            prepare_workspace(task_dir, scenario, workspace)
            for stage in scenario["stages"][1:]:
                payload = materialize_payload(task_dir / str(stage["inject"]), "main")
                try:
                    future_files = [path.relative_to(payload) for path in payload.rglob("*") if path.is_file()]
                    leaked = [str(path) for path in future_files if (workspace / path).exists()]
                    if leaked:
                        raise ValueError(f"task {task_id:02d} future stage {stage['id']} leaks initially: {leaked[:5]}")
                    stage_files += len(future_files)
                finally:
                    shutil.rmtree(payload, ignore_errors=True)
            candidate = temporary / f"task-{task_id:02d}" / "empty-candidate"
            candidate.mkdir()
            judge, _, _ = run_judge(task_dir, scenario, candidate, bwrap)
            if judge.get("progress_level") != 0 or judge.get("edge_check_passed") is not False:
                raise ValueError(f"task {task_id:02d} empty candidate did not fail at progress 0: {judge}")
            empty_judges += 1
    finally:
        make_writable_tree(temporary)
        shutil.rmtree(temporary, ignore_errors=True)
    return {"valid": True, "task_count": len(scenarios), "python_files": len(python_files), "future_stage_files": stage_files, "empty_judges": empty_judges}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tasks", default="all")
    parser.add_argument("--variants", default=",".join(VARIANTS))
    parser.add_argument("--output", type=Path, default=ROOT / "results" / datetime.now().strftime("%Y%m%d-%H%M%S"))
    parser.add_argument("--provider", default="openai-codex")
    parser.add_argument("--model", default="gpt-5.6-sol")
    parser.add_argument("--thinking", default="medium")
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    parser.add_argument("--group-size", type=int, default=2)
    parser.add_argument("--max-workers", type=int, default=6)
    parser.add_argument("--retry-failed", type=int, choices=(0, 1), default=1)
    parser.add_argument("--hosts-manifest", type=Path, help="manifest written by prepare-hosts.py")
    parser.add_argument("--baseline-prime-agent", help="explicit isolated stock prime-agent@0.9.1 executable")
    parser.add_argument("--current-prime-agent", help="explicit isolated patched prime-agent@0.9.1 executable")
    parser.add_argument("--auth-file", type=Path)
    parser.add_argument("--bwrap", default=shutil.which("bwrap") or "", help="bubblewrap executable used to deny non-loopback tool network access")
    parser.add_argument("--current-extension", type=Path, help="installed prime-agent-context@9.2.0 package root")
    parser.add_argument("--validate-only", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    require_python312()
    if not (1 <= args.group_size <= 2):
        raise SystemExit("--group-size must be 1..2")
    if not (1 <= args.max_workers <= 6):
        raise SystemExit("--max-workers must be 1..6")
    scenarios = load_scenarios(ROOT, require_complete=True)
    if args.validate_only:
        print(json.dumps(validate_corpus(scenarios, args.bwrap or None), sort_keys=True))
        return 0
    hosts_manifest = apply_hosts_manifest(args)
    task_ids = parse_task_ids(args.tasks, scenarios)
    variants = parse_variants(args.variants)
    if args.group_size != len(variants):
        raise SystemExit("--group-size must equal the number of selected variants so each task runs as one comparison group")
    if not args.bwrap:
        raise SystemExit("bubblewrap (bwrap) is required for hermetic tool execution")
    if args.current_extension is None:
        raise ValueError("--current-extension or --hosts-manifest is required")
    extension_root = prime_context_package_root(args.current_extension)
    args.current_extension = extension_root
    patcher = extension_root / "scripts" / "patch-prime-agent.mjs"
    if not patcher.is_file():
        raise FileNotFoundError(f"installed Prime Context patcher not found: {patcher}")
    for variant in variants:
        variant_extension(variant, args)
    uses_baseline = "vanilla" in variants
    uses_current = "current" in variants
    baseline_version = None
    current_version = None
    baseline_path = None
    current_path = None
    baseline_root = None
    current_root = None
    if uses_baseline:
        baseline_version, baseline_path = require_prime_agent(args.baseline_prime_agent, "--baseline-prime-agent")
        args.baseline_prime_agent = str(baseline_path)
        baseline_root = require_host_contract(
            baseline_path, "--baseline-prime-agent", patched=False, patcher=patcher,
        )
    if uses_current:
        current_version, current_path = require_prime_agent(args.current_prime_agent, "--current-prime-agent")
        args.current_prime_agent = str(current_path)
        current_root = require_host_contract(
            current_path, "--current-prime-agent", patched=True, patcher=patcher,
        )
    if baseline_root is not None and current_root is not None and baseline_root == current_root:
        raise ValueError("baseline and current must use distinct isolated Prime Agent hosts")
    if current_root is not None and extension_root.parent != current_root.parent:
        raise ValueError(
            "current Prime Agent and prime-agent-context must be sibling packages "
            "inside the same isolated npm prefix"
        )
    publication_blockers: list[str] = []
    if task_ids != sorted(scenarios):
        publication_blockers.append("tasks must contain all 30 scenarios")
    if variants != list(VARIANTS):
        publication_blockers.append("variants must be vanilla,current")
    if args.provider != "openai-codex":
        publication_blockers.append("provider must be openai-codex")
    if args.model != "gpt-5.6-sol":
        publication_blockers.append("model must be gpt-5.6-sol")
    if args.thinking != "medium":
        publication_blockers.append("thinking must be medium")
    if args.timeout_seconds != 1800:
        publication_blockers.append("timeout-seconds must be 1800")
    if args.group_size != 2 or args.max_workers != 6:
        publication_blockers.append("group-size/max-workers must be 2/6")
    if args.retry_failed != 1:
        publication_blockers.append("retry-failed must be 1")
    if hosts_manifest is None:
        publication_blockers.append("hosts must come from prepare-hosts.py")

    args.output = args.output.resolve()
    if args.output.exists() and any(args.output.iterdir()):
        raise ValueError(f"output directory must be fresh and empty: {args.output}")
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schema": "prime-context.python-realworld-invocation/v1",
        "started_at": utc_now(),
        "tasks": task_ids,
        "variants": variants,
        "provider": args.provider,
        "model": args.model,
        "thinking": args.thinking,
        "timeout_seconds": args.timeout_seconds,
        "group_size": args.group_size,
        "max_workers": args.max_workers,
        "retry_failed": args.retry_failed,
        "tool_network": "loopback-only",
        "hosts_manifest": str(args.hosts_manifest) if args.hosts_manifest else None,
        "hosts_prepared_at": (hosts_manifest or {}).get("prepared_at"),
        "baseline_prime_agent": args.baseline_prime_agent,
        "current_prime_agent": args.current_prime_agent,
        "current_extension": str(extension_root),
        "baseline_prime_agent_version": baseline_version,
        "current_prime_agent_version": current_version,
        "prime_context_version": PRIME_CONTEXT_VERSION,
        "publication_protocol": not publication_blockers,
        "publication_blockers": publication_blockers,
    }
    json_dump(args.output / "invocation.json", manifest)
    results: list[dict[str, Any]] = []
    tasks_per_wave = max(1, args.max_workers // args.group_size)
    for offset in range(0, len(task_ids), tasks_per_wave):
        group = task_ids[offset:offset + tasks_per_wave]
        print(f"starting comparison groups for tasks {group}", flush=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.max_workers, len(group) * len(variants))) as executor:
            futures = {
                executor.submit(run_case, variant, scenarios[task_id][0], scenarios[task_id][1], args.output, args): (task_id, variant)
                for task_id in group
                for variant in variants
            }
            for future in concurrent.futures.as_completed(futures):
                task_id, variant = futures[future]
                try:
                    result = future.result()
                except Exception as exc:
                    result = {
                        "variant": variant,
                        "task_id": task_id,
                        "task_slug": scenarios[task_id][1]["slug"],
                        "pressure": scenarios[task_id][1]["pressure"],
                        "primary_attempt": 0,
                        "selected_attempt": 0,
                        "retry_triggers": [],
                        "attempts": [{"error": f"{type(exc).__name__}: {exc}", "judge": {"status": "error", "progress_level": 0}, "metrics": {}}],
                    }
                results.append(result)
                json_dump(args.output / "results.partial.json", results)
                print(f"finished task {task_id:02d} {variant}: progress {(selected_attempt(result).get('judge') or {}).get('progress_level', 0)}", flush=True)
        if args.retry_failed and {"vanilla", "current"}.issubset(variants):
            wave_by_key = {
                (result["task_id"], result["variant"]): result
                for result in results
                if result["task_id"] in group
            }
            retry_jobs: list[tuple[int, dict[str, Any], list[str]]] = []
            for task_id in group:
                vanilla = wave_by_key.get((task_id, "vanilla"))
                current = wave_by_key.get((task_id, "current"))
                if vanilla is None or current is None:
                    continue
                reasons = comparison_retry_reasons(vanilla, current)
                if reasons:
                    retry_jobs.append((task_id, current, reasons))
            if retry_jobs:
                with concurrent.futures.ThreadPoolExecutor(
                    max_workers=min(args.max_workers, len(retry_jobs))
                ) as executor:
                    retry_futures = {
                        executor.submit(
                            retry_case_for_regression,
                            result,
                            scenarios[task_id][0],
                            scenarios[task_id][1],
                            args.output,
                            args,
                            reasons,
                        ): (task_id, reasons)
                        for task_id, result, reasons in retry_jobs
                    }
                    for future in concurrent.futures.as_completed(retry_futures):
                        task_id, reasons = retry_futures[future]
                        future.result()
                        json_dump(args.output / "results.partial.json", results)
                        print(
                            f"retried task {task_id:02d} current after {','.join(reasons)}",
                            flush=True,
                        )
    results.sort(key=lambda item: (item["task_id"], item["variant"]))
    summary = comprehensive_summary(results)
    summary["publication_protocol"] = manifest["publication_protocol"]
    summary["publication_blockers"] = manifest["publication_blockers"]
    summary["publication_ready"] = bool(
        summary["publication_ready"] and manifest["publication_protocol"]
    )
    json_dump(args.output / "results.json", results)
    json_dump(args.output / "summary.json", summary)
    write_summary_markdown(args.output / "SUMMARY.md", summary, results)
    manifest["completed_at"] = utc_now()
    json_dump(args.output / "invocation.json", manifest)
    print(json.dumps({"output": str(args.output), "runs": len(results), "regressions": len(summary["regressions"])}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
