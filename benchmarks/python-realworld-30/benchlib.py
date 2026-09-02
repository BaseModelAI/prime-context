#!/usr/bin/env python3
"""Small shared helpers for the Python Real-World 30 benchmark."""
from __future__ import annotations

import json
import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Iterable

SCHEMA = "prime-context.python-realworld-task/v1"
SUITE_SCHEMA = "prime-context.python-realworld-suite/v1"
RUN_SCHEMA = "prime-context.python-realworld-run/v1"
PRESSURE_COUNTS = {"N": 8, "L": 10, "M": 8, "H": 4}
PRESSURE_TIMEOUTS = {"N": 600, "L": 900, "M": 1200, "H": 1800}
EXPECTED_PROFILES = {
    1: ("N", 1), 2: ("L", 2), 3: ("L", 2), 4: ("N", 1), 5: ("L", 2),
    6: ("M", 3), 7: ("N", 1), 8: ("L", 2), 9: ("N", 1), 10: ("N", 1),
    11: ("L", 2), 12: ("M", 3), 13: ("H", 4), 14: ("N", 1), 15: ("N", 1),
    16: ("L", 2), 17: ("M", 3), 18: ("L", 2), 19: ("N", 1), 20: ("M", 3),
    21: ("L", 2), 22: ("M", 3), 23: ("M", 3), 24: ("M", 3), 25: ("L", 2),
    26: ("L", 2), 27: ("H", 4), 28: ("H", 4), 29: ("M", 3), 30: ("H", 5),
}
USAGE_KEYS = ("input", "output", "cacheRead", "cacheWrite", "totalTokens")
COST_KEYS = ("input", "output", "cacheRead", "cacheWrite", "total")


def text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    return "".join(
        str(block.get("text", ""))
        for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    )


def parse_task_ids(value: str, available: Iterable[int]) -> list[int]:
    allowed = set(available)
    if value.strip().lower() == "all":
        return sorted(allowed)
    selected: set[int] = set()
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            left, right = part.split("-", 1)
            start, end = int(left), int(right)
            if start > end:
                raise ValueError(f"descending task range: {part}")
            selected.update(range(start, end + 1))
        else:
            selected.add(int(part))
    missing = sorted(selected - allowed)
    if missing:
        raise ValueError(f"unknown task ids: {missing}")
    if not selected:
        raise ValueError("no tasks selected")
    return sorted(selected)


def load_scenarios(root: Path, *, require_complete: bool = True) -> dict[int, tuple[Path, dict[str, Any]]]:
    tasks_root = root / "tasks"
    found: dict[int, tuple[Path, dict[str, Any]]] = {}
    errors: list[str] = []
    for scenario_path in sorted(tasks_root.glob("*/scenario.json")):
        task_dir = scenario_path.parent
        try:
            data = json.loads(scenario_path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{scenario_path}: {exc}")
            continue
        task_id = data.get("id")
        if not isinstance(task_id, int) or not (1 <= task_id <= 30):
            errors.append(f"{scenario_path}: id must be an integer in 1..30")
            continue
        if task_id in found:
            errors.append(f"duplicate task id {task_id}")
            continue
        errors.extend(validate_scenario(task_dir, data))
        found[task_id] = (task_dir, data)
    if require_complete and set(found) != set(range(1, 31)):
        errors.append(f"expected task ids 1..30; found {sorted(found)}")
    if require_complete:
        counts = {key: 0 for key in PRESSURE_COUNTS}
        for _, data in found.values():
            if data.get("pressure") in counts:
                counts[data["pressure"]] += 1
        if counts != PRESSURE_COUNTS:
            errors.append(f"pressure counts must be {PRESSURE_COUNTS}; found {counts}")
        fixture_service_ids = {task_id for task_id, (_, data) in found.items() if "fixture_service" in data}
        candidate_service_ids = {task_id for task_id, (_, data) in found.items() if "candidate_service" in data}
        if fixture_service_ids != {10, 12}:
            errors.append(f"fixture_service tasks must be exactly 10 and 12; found {sorted(fixture_service_ids)}")
        if candidate_service_ids != {30}:
            errors.append(f"candidate_service tasks must be exactly 30; found {sorted(candidate_service_ids)}")
        index_path = root / "tasks.json"
        try:
            index = json.loads(index_path.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{index_path}: {exc}")
        else:
            expected = [
                {
                    "id": task_id,
                    "slug": data["slug"],
                    "title": data["title"],
                    "pressure": data["pressure"],
                    "scenario": f"tasks/{task_dir.name}/scenario.json",
                }
                for task_id, (task_dir, data) in sorted(found.items())
            ]
            if index.get("schema") != SUITE_SCHEMA or index.get("tasks") != expected:
                errors.append(f"{index_path}: suite index does not exactly match scenario files")
    if errors:
        raise ValueError("invalid benchmark corpus:\n- " + "\n- ".join(errors))
    return found


def validate_scenario(task_dir: Path, data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    label = str(task_dir / "scenario.json")
    required = {
        "schema", "id", "slug", "title", "pressure", "timeout_seconds",
        "editable_paths", "initial_prompt", "stages", "judge_command",
    }
    missing = sorted(required - set(data))
    if missing:
        errors.append(f"{label}: missing keys {missing}")
        return errors
    if data["schema"] != SCHEMA:
        errors.append(f"{label}: schema must be {SCHEMA}")
    task_id = data.get("id")
    slug = data.get("slug")
    if isinstance(task_id, int) and isinstance(slug, str) and task_dir.name != f"{task_id:02d}-{slug}":
        errors.append(f"{label}: directory name must be {task_id:02d}-{slug}")
    if data.get("initial_prompt") != "Read TASK.md and complete the requested workflow using only the Python standard library.":
        errors.append(f"{label}: initial_prompt must use the suite's fixed wording")
    pressure = data.get("pressure")
    if pressure not in PRESSURE_COUNTS:
        errors.append(f"{label}: invalid pressure {pressure!r}")
    elif data.get("timeout_seconds") != PRESSURE_TIMEOUTS[pressure]:
        errors.append(
            f"{label}: timeout for {pressure} must be {PRESSURE_TIMEOUTS[pressure]}"
        )
    expected_stages = {"N": 1, "L": 2, "M": 3, "H": (4, 5)}.get(pressure)
    stages = data.get("stages")
    if not isinstance(stages, list) or not stages:
        errors.append(f"{label}: stages must be a non-empty list")
        stages = []
    if isinstance(expected_stages, tuple):
        if len(stages) not in expected_stages:
            errors.append(f"{label}: {pressure} task must have 4 or 5 stages")
    elif expected_stages is not None and len(stages) != expected_stages:
        errors.append(f"{label}: {pressure} task must have {expected_stages} stages")
    fixed_profile = EXPECTED_PROFILES.get(task_id) if isinstance(task_id, int) else None
    if fixed_profile is None:
        errors.append(f"{label}: task id must be one of 1..30")
    elif (pressure, len(stages)) != fixed_profile:
        errors.append(
            f"{label}: task {task_id:02d} profile must be pressure {fixed_profile[0]} with {fixed_profile[1]} stages"
        )
    if stages and isinstance(stages[0], dict) and (stages[0].get("id") != "initial" or stages[0].get("inject") != "visible/"):
        errors.append(f"{label}: first stage must be initial and inject visible/")
    if stages and isinstance(stages[-1], dict) and stages[-1].get("compact_after") is True:
        errors.append(f"{label}: final stage cannot request a context-free terminal compaction")
    ids: set[str] = set()
    compact_count = 0
    for index, stage in enumerate(stages):
        if not isinstance(stage, dict):
            errors.append(f"{label}: stage {index} is not an object")
            continue
        stage_missing = sorted({"id", "inject", "message", "compact_after"} - set(stage))
        if stage_missing:
            errors.append(f"{label}: stage {index} missing {stage_missing}")
            continue
        if stage["id"] in ids:
            errors.append(f"{label}: duplicate stage id {stage['id']!r}")
        ids.add(str(stage["id"]))
        compact_count += int(stage.get("compact_after") is True)
        inject_relative = Path(str(stage["inject"]))
        inject = task_dir / inject_relative
        if inject_relative.is_absolute() or ".." in inject_relative.parts:
            errors.append(f"{label}: unsafe inject path: {stage['inject']}")
        elif not inject.is_dir():
            errors.append(f"{label}: inject directory not found: {stage['inject']}")
    expected_compactions = 0 if pressure in {"N", "L"} else 1 if pressure == "M" else 2
    if compact_count != expected_compactions:
        errors.append(
            f"{label}: {pressure} task requires {expected_compactions} requested compactions; found {compact_count}"
        )
    expected_compaction_positions = {
        "N": [], "L": [], "M": [0], "H": [0, 2],
    }.get(pressure, [])
    actual_compaction_positions = [index for index, stage in enumerate(stages) if isinstance(stage, dict) and stage.get("compact_after") is True]
    if actual_compaction_positions != expected_compaction_positions:
        errors.append(
            f"{label}: compactions must follow stages {[index + 1 for index in expected_compaction_positions]}"
        )
    for filename in ("TASK.md", "seed.py", "judge.py"):
        if not (task_dir / filename).is_file():
            errors.append(f"{label}: missing {filename}")
    for editable in data.get("editable_paths") or []:
        editable_path = Path(str(editable))
        if editable_path.is_absolute() or ".." in editable_path.parts:
            errors.append(f"{label}: unsafe editable path: {editable}")
    for service_key in ("fixture_service", "candidate_service"):
        service = data.get(service_key)
        if service is None:
            continue
        if not isinstance(service, dict) or not service.get("command") or not service.get("url_file"):
            errors.append(f"{label}: {service_key} requires command and url_file")
    has_fixture = isinstance(data.get("fixture_service"), dict)
    has_candidate = isinstance(data.get("candidate_service"), dict)
    if has_fixture != (task_id in {10, 12}):
        errors.append(f"{label}: fixture_service is required only for tasks 10 and 12")
    if has_candidate != (task_id == 30):
        errors.append(f"{label}: candidate_service is required only for task 30")
    if task_id == 30 and has_fixture:
        errors.append(f"{label}: task 30 must not declare a second fixture service")
    judge = data.get("judge_command")
    if not isinstance(judge, list) or "{workspace}" not in judge:
        errors.append(f"{label}: judge_command must be an argv list containing {{workspace}}")
    return errors


def copy_payload(source: Path, destination: Path, *, exclude_generators: bool = True) -> None:
    if not source.exists():
        return
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        if exclude_generators and relative.name == "_generate.py":
            continue
        target = destination / relative
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif path.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.is_file() or target.is_symlink():
                target.unlink()
            shutil.copy2(path, target)


def python312() -> str:
    executable = os.environ.get("PRIME_CONTEXT_BENCHMARK_PYTHON") or shutil.which("python3.12")
    if executable is None:
        raise RuntimeError("Python 3.12 is required (set PRIME_CONTEXT_BENCHMARK_PYTHON to its executable)")
    return executable


def require_python312() -> str:
    executable = python312()
    completed = subprocess.run(
        [executable, "-E", "-S", "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
        text=True,
        capture_output=True,
        timeout=20,
    )
    if completed.returncode != 0 or completed.stdout.strip() != "3.12":
        raise RuntimeError(f"benchmark Python must be 3.12.x: {executable}")
    return executable


def run_seed(task_dir: Path, workspace: Path, fixture: str) -> None:
    task_dir = task_dir.resolve()
    workspace = workspace.resolve()
    temporary = Path(tempfile.mkdtemp(prefix="pcbench-seed-"))
    try:
        subprocess.run(
            [python312(), "-E", "-S", str(task_dir / "seed.py"), "--workspace", str(temporary), "--fixture", fixture],
            cwd=task_dir,
            check=True,
            text=True,
            capture_output=True,
            timeout=300,
        )
        workspace.mkdir(parents=True, exist_ok=True)
        copy_payload(temporary, workspace, exclude_generators=False)
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def materialize_payload(source: Path, fixture: str = "main") -> Path:
    source = source.resolve()
    temporary = Path(tempfile.mkdtemp(prefix="pcbench-stage-"))
    copy_payload(source, temporary)
    generator = source / "_generate.py"
    if generator.is_file():
        subprocess.run(
            [python312(), "-E", "-S", str(generator), "--output", str(temporary), "--fixture", fixture],
            cwd=source,
            check=True,
            text=True,
            capture_output=True,
            timeout=300,
        )
    return temporary


def inject_stage(task_dir: Path, workspace: Path, stage: dict[str, Any], fixture: str = "main") -> None:
    source = task_dir / str(stage["inject"])
    payload = materialize_payload(source, fixture)
    changed_directories: set[Path] = set()
    try:
        for item in payload.rglob("*"):
            relative = item.relative_to(payload)
            parent = (workspace / relative).parent
            while parent != workspace and workspace in parent.parents:
                if parent.exists():
                    parent.chmod(parent.stat().st_mode | stat.S_IWUSR)
                    changed_directories.add(parent)
                parent = parent.parent
        copy_payload(payload, workspace, exclude_generators=False)
        make_payload_read_only(payload, workspace)
        for directory in sorted(changed_directories, key=lambda path: len(path.parts), reverse=True):
            make_read_only(directory)
    finally:
        shutil.rmtree(payload, ignore_errors=True)


def prepare_workspace(task_dir: Path, scenario: dict[str, Any], workspace: Path) -> None:
    run_seed(task_dir, workspace, "main")
    task_target = workspace / "TASK.md"
    shutil.copy2(task_dir / "TASK.md", task_target)
    # The initial inject is copied after seeding so static visible files win.
    initial = scenario["stages"][0]
    inject_stage(task_dir, workspace, initial, "main")
    for editable in scenario["editable_paths"]:
        (workspace / str(editable)).mkdir(parents=True, exist_ok=True)
    for item in sorted(workspace.rglob("*"), reverse=True):
        make_read_only(item)
    for editable in scenario["editable_paths"]:
        make_writable_tree(workspace / str(editable))


def make_read_only(path: Path) -> None:
    try:
        mode = path.stat().st_mode
        path.chmod(mode & ~(stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH))
    except FileNotFoundError:
        return


def make_payload_read_only(source: Path, destination: Path) -> None:
    for path in sorted(source.rglob("*"), reverse=True):
        make_read_only(destination / path.relative_to(source))


def make_writable_tree(path: Path) -> None:
    for item in [path, *path.rglob("*")]:
        try:
            mode = item.stat().st_mode
            item.chmod(mode | stat.S_IWUSR)
        except FileNotFoundError:
            pass


def clean_environment(config: Path, pc_home: Path, home: Path) -> dict[str, str]:
    environment = dict(os.environ)
    for key in list(environment):
        if key.startswith("PRIME_AGENT_INTERNAL_"):
            environment.pop(key, None)
    for key in ("PI_OFFLINE", "DO_NOT_TRACK", "FORCE_COLOR", "PRIME_AGENT_KERNEL_PYTHON", "PYTHONPATH"):
        environment.pop(key, None)
    environment.update(
        {
            "PRIME_AGENT_CODING_AGENT_DIR": str(config),
            "PRIME_CONTEXT_HOME": str(pc_home),
            "PRIME_AGENT_TELEMETRY": "0",
            "HOME": str(home),
            "NO_COLOR": "1",
            "PYTHONDONTWRITEBYTECODE": "1",
        }
    )
    return environment


def parse_session_file(path: Path) -> dict[str, Any] | None:
    header: dict[str, Any] | None = None
    usage = {key: 0 for key in USAGE_KEYS}
    cost = {key: 0.0 for key in COST_KEYS}
    model_calls = tool_calls = tool_results = visible_tool_bytes = compactions = refinement_entries = recovery_tool_calls = 0
    final_response_tokens = 0
    provider_prompt_token_samples: list[int] = []
    try:
        handle = path.open(errors="ignore")
    except OSError:
        return None
    with handle:
        for line in handle:
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            entry_type = entry.get("type")
            if entry_type == "session":
                header = entry
            elif entry_type == "compaction":
                compactions += 1
            elif entry_type == "custom" and entry.get("customType") == "prime-agent.refinement":
                refinement_entries += 1
            if entry_type != "message":
                continue
            message = entry.get("message") or {}
            role = message.get("role")
            if role == "assistant":
                model_calls += 1
                item = message.get("usage") or {}
                for key in USAGE_KEYS:
                    usage[key] += item.get(key, 0) or 0
                provider_prompt_token_samples.append(sum(int(item.get(key, 0) or 0) for key in ("input", "cacheRead", "cacheWrite")))
                item_cost = item.get("cost") or {}
                for key in COST_KEYS:
                    cost[key] += item_cost.get(key, 0) or 0
                final_response_tokens = item.get("output", 0) or 0
                calls = [
                    block for block in message.get("content") or []
                    if isinstance(block, dict) and block.get("type") == "toolCall"
                ]
                tool_calls += len(calls)
                recovery_tool_calls += sum(1 for block in calls if block.get("name") == "prime_context")
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
        "recovery_tool_calls": recovery_tool_calls,
        "visible_tool_bytes": visible_tool_bytes,
        "compactions": compactions,
        "automatic_refinement_applied": refinement_entries,
        "usage": usage,
        "cost": cost,
        "final_response_tokens": final_response_tokens,
        "provider_prompt_token_samples": provider_prompt_token_samples,
    }


def collect_sessions(root: Path) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for path in root.rglob("*.jsonl"):
        parsed = parse_session_file(path)
        if parsed and parsed["session_id"] not in by_id:
            by_id[str(parsed["session_id"])] = parsed
    return list(by_id.values())


def aggregate_sessions(sessions: list[dict[str, Any]]) -> dict[str, Any]:
    usage = {key: sum(item["usage"][key] for item in sessions) for key in USAGE_KEYS}
    cost = {key: sum(item["cost"][key] for item in sessions) for key in COST_KEYS}
    prompt_denominator = usage["input"] + usage["cacheRead"] + usage["cacheWrite"]
    roots = [item for item in sessions if not item["rlm_depth"]]
    provider_prompt_samples = [sample for item in sessions for sample in item["provider_prompt_token_samples"]]
    return {
        "session_count": len(sessions),
        "child_sessions": sum(1 for item in sessions if item["rlm_depth"]),
        "main_model_calls": sum(item["model_calls"] for item in roots),
        "all_model_calls": sum(item["model_calls"] for item in sessions),
        "tool_calls": sum(item["tool_calls"] for item in sessions),
        "tool_results": sum(item["tool_results"] for item in sessions),
        "recovery_tool_calls": sum(item["recovery_tool_calls"] for item in sessions),
        "tool_result_bytes_shown": sum(item["visible_tool_bytes"] for item in sessions),
        "session_compactions": sum(item["compactions"] for item in sessions),
        "automatic_refinement_applied": sum(item["automatic_refinement_applied"] for item in sessions),
        "provider_usage": usage,
        "api_cost": cost,
        "prompt_cache_reuse": usage["cacheRead"] / prompt_denominator if prompt_denominator else None,
        "peak_provider_prompt_tokens": max(provider_prompt_samples) if provider_prompt_samples else None,
        "average_provider_prompt_tokens": (sum(provider_prompt_samples) / len(provider_prompt_samples)) if provider_prompt_samples else None,
        "provider_prompt_token_sum": sum(provider_prompt_samples),
        "provider_prompt_sample_count": len(provider_prompt_samples),
        "final_response_tokens": roots[-1]["final_response_tokens"] if roots else 0,
    }


def last_json_object(stdout: str) -> dict[str, Any]:
    for line in reversed(stdout.splitlines()):
        try:
            value = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    raise ValueError("judge did not print a JSON object")


def run_judge(
    task_dir: Path,
    scenario: dict[str, Any],
    workspace: Path,
    bwrap: str | None = None,
) -> tuple[dict[str, Any], float, str]:
    task_dir = task_dir.resolve()
    workspace = workspace.resolve()
    command = [str(workspace) if part == "{workspace}" else str(part) for part in scenario["judge_command"]]
    if command and command[0] in {"python", "python3", "python3.12"}:
        command[0:1] = [python312(), "-E", "-S"]
    if bwrap:
        command = [
            str(Path(bwrap).resolve()),
            "--die-with-parent",
            "--unshare-net",
            "--bind", "/", "/",
            "--dev-bind", "/dev", "/dev",
            "--proc", "/proc",
            "--",
            *command,
        ]
    started = time.monotonic()
    completed = subprocess.run(
        command,
        cwd=task_dir,
        text=True,
        capture_output=True,
        timeout=600,
    )
    elapsed = time.monotonic() - started
    transcript = completed.stdout + (("\n" + completed.stderr) if completed.stderr else "")
    try:
        result = last_json_object(completed.stdout)
    except ValueError as exc:
        result = {
            "status": "error",
            "progress_level": 0,
            "main_checks_passed": 0,
            "main_checks_total": 0,
            "edge_check_passed": False,
            "notes": [str(exc), f"judge exit code {completed.returncode}"],
        }
    result.setdefault("notes", [])
    if completed.returncode and result.get("status") == "pass":
        result["status"] = "error"
        result["notes"].append(f"judge exit code {completed.returncode}")
    return result, elapsed, transcript


def choose_better_attempt(attempts: list[dict[str, Any]]) -> int:
    """Select by correctness first, then lower cost and agent time; retain every attempt."""
    def key(index: int) -> tuple[int, float, int, int, float, float]:
        item = attempts[index]
        judge = item.get("judge") or {}
        metrics = item.get("metrics") or {}
        strict = int(judge.get("status") == "pass" and judge.get("progress_level") == 5)
        progress = float(judge.get("progress_level") or 0)
        main_checks = int(judge.get("main_checks_passed") or 0)
        edge_check = int(judge.get("edge_check_passed") is True)
        cost = float((metrics.get("api_cost") or {}).get("total") or 0)
        wall = float(item.get("agent_wall_seconds") or 0)
        return strict, progress, main_checks, edge_check, -cost, -wall
    return max(range(len(attempts)), key=key)


def summarize_results(results: list[dict[str, Any]]) -> dict[str, Any]:
    selected = [item["attempts"][item["selected_attempt"]] for item in results]
    strict = [
        item for item in selected
        if item.get("judge", {}).get("status") == "pass"
        and item.get("judge", {}).get("progress_level") == 5
    ]
    by_variant: dict[str, dict[str, Any]] = {}
    for result, attempt in zip(results, selected):
        bucket = by_variant.setdefault(result["variant"], {"runs": 0, "strict_passes": 0, "progress_sum": 0.0, "selected_cost": 0.0, "all_attempt_cost": 0.0, "selected_agent_wall_seconds": 0.0})
        bucket["runs"] += 1
        bucket["strict_passes"] += int(
            attempt.get("judge", {}).get("status") == "pass"
            and attempt.get("judge", {}).get("progress_level") == 5
        )
        bucket["progress_sum"] += float(attempt.get("judge", {}).get("progress_level") or 0)
        bucket["selected_cost"] += float((attempt.get("metrics", {}).get("api_cost") or {}).get("total") or 0)
        bucket["all_attempt_cost"] += sum(float((a.get("metrics", {}).get("api_cost") or {}).get("total") or 0) for a in result["attempts"])
        bucket["selected_agent_wall_seconds"] += float(attempt.get("agent_wall_seconds") or 0)
    for bucket in by_variant.values():
        bucket["strict_pass_rate"] = bucket["strict_passes"] / bucket["runs"] if bucket["runs"] else 0
        bucket["mean_progress"] = bucket["progress_sum"] / bucket["runs"] if bucket["runs"] else 0
    return {"runs": len(results), "selected_strict_passes": len(strict), "by_variant": by_variant}
