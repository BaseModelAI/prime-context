#!/usr/bin/env python3
"""Direct, hermetic main-and-edge judge for Task 14."""
from __future__ import annotations

import argparse
import json
import os
import shutil
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


COMMAND = [
    benchmark_python(),
    "-E",
    "-S",
    "-m",
    "solution.config_upgrade",
    "inputs",
    "--output",
    "output/config.json",
    "--report",
    "output/report.txt",
]

EXPECTED_CONFIG: dict[str, Any] = {
    "app": {
        "banner": "Atlas at site.internal:9443 (TLS=True)",
        "debug": False,
        "features": ["runtime-only"],
        "name": "Atlas",
        "preferences": {"density": "compact", "language": "fr"},
    },
    "custom": {"runtime_flag": True, "shortcut": "ctrl+k"},
    "database": {
        "credentials": {
            "password_secret": "runtime-password",
            "user": "analyst",
        },
        "host": "db.site.internal",
        "options": {"application_name": "orion", "connect_timeout": 30},
        "port": 5432,
    },
    "logging": {"format": "%(levelname)s:%(message)s", "level": "WARNING"},
    "network": {"host": "site.internal", "port": 9443, "tls": True},
    "operator": {"enabled": False, "summary": "Atlas/9443"},
    "paths": {
        "cache_dir": "/home/alice/atlas/cache",
        "data_dir": "/home/alice/atlas",
        "log_dir": "/home/alice/atlas/logs",
    },
    "token_secret": "user-token",
}

# Leaves present after migrating defaults.ini, plus migration destinations.
KNOWN_LEAVES = {
    "app.banner",
    "app.debug",
    "app.edition",
    "app.features",
    "app.name",
    "database.credentials.password_secret",
    "database.credentials.user",
    "database.host",
    "database.options.application_name",
    "database.options.connect_timeout",
    "database.port",
    "logging.format",
    "logging.handlers",
    "logging.level",
    "network.host",
    "network.port",
    "network.tls",
    "paths.data_dir",
    "paths.log_dir",
}

CROSS_FORMAT_VALUES = {
    "app.debug": False,
    "app.features": ["runtime-only"],
    "app.preferences.density": "compact",
    "app.preferences.language": "fr",
    "custom.runtime_flag": True,
    "custom.shortcut": "ctrl+k",
    "database.credentials.password_secret": "runtime-password",
    "database.host": "db.site.internal",
    "database.options.application_name": "orion",
    "database.options.connect_timeout": 30,
    "database.port": 5432,
    "logging.format": "%(levelname)s:%(message)s",
    "logging.level": "WARNING",
    "network.tls": True,
    "paths.data_dir": "/home/alice/atlas",
    "token_secret": "user-token",
}


def leaf_items(value: dict[str, Any], prefix: str = "") -> list[tuple[str, Any]]:
    items: list[tuple[str, Any]] = []
    for key, child in value.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(child, dict):
            items.extend(leaf_items(child, path))
        else:
            items.append((path, child))
    return items


def expected_report() -> str:
    lines = ["Layered Configuration Upgrade Report", "[effective]"]
    for path, value in sorted(leaf_items(EXPECTED_CONFIG)):
        if path.rsplit(".", 1)[-1].endswith("_secret"):
            rendered = "***"
        else:
            rendered = json.dumps(
                value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
            )
        lines.append(f"{path} = {rendered}")
    lines.append("[unknown]")
    for path, _ in sorted(leaf_items(EXPECTED_CONFIG)):
        if path not in KNOWN_LEAVES:
            lines.append(f"WARNING unknown key: {path}")
    return "\n".join(lines) + "\n"


def get_path(root: dict[str, Any], path: str) -> tuple[bool, Any]:
    current: Any = root
    for component in path.split("."):
        if not isinstance(current, dict) or component not in current:
            return False, None
        current = current[component]
    return True, current


def same_json_type(actual: Any, expected: Any) -> bool:
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(
            same_json_type(actual[key], value) for key, value in expected.items()
        )
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(
            same_json_type(left, right) for left, right in zip(actual, expected)
        )
    return actual == expected


def values_match(config: dict[str, Any], expected: dict[str, Any]) -> bool:
    for path, wanted in expected.items():
        found, actual = get_path(config, path)
        if not found or not same_json_type(actual, wanted):
            return False
    return True


def has_substitution(value: Any) -> bool:
    if isinstance(value, dict):
        return any(has_substitution(child) for child in value.values())
    if isinstance(value, list):
        return any(has_substitution(child) for child in value)
    return isinstance(value, str) and "${" in value


def copy_candidate(candidate: Path, run_root: Path) -> None:
    destination = run_root / "solution"
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(candidate / "solution", destination)


def prepare_fixture(candidate: Path, fixture: str) -> tuple[tempfile.TemporaryDirectory[str], Path]:
    holder = tempfile.TemporaryDirectory(prefix=f"pcbench-14-{fixture}-")
    run_root = Path(holder.name)
    subprocess.run(
        [
            benchmark_python(),
            "-E",
            "-S",
            str(TASK_DIR / "seed.py"),
            "--workspace",
            str(run_root),
            "--fixture",
            fixture,
        ],
        cwd=TASK_DIR,
        check=True,
        capture_output=True,
        text=True,
        timeout=20,
    )
    copy_candidate(candidate, run_root)
    return holder, run_root


def run_command(run_root: Path) -> tuple[subprocess.CompletedProcess[str] | None, bool]:
    environment = os.environ.copy()
    environment.pop("PYTHONPATH", None)
    environment["PYTHONNOUSERSITE"] = "1"
    try:
        completed = subprocess.run(
            COMMAND,
            cwd=run_root,
            capture_output=True,
            text=True,
            timeout=20,
            env=environment,
        )
    except subprocess.TimeoutExpired:
        return None, True
    return completed, False


def parse_main_outputs(run_root: Path) -> tuple[dict[str, Any], str]:
    config = json.loads(
        (run_root / "output" / "config.json").read_text(encoding="utf-8")
    )
    if not isinstance(config, dict):
        raise ValueError("config.json is not an object")
    report = (run_root / "output" / "report.txt").read_text(encoding="utf-8")
    return config, report


def check_main(config: dict[str, Any], report: str) -> list[bool]:
    actual_leaf_paths = {path for path, _ in leaf_items(config)}
    expected_leaf_paths = {path for path, _ in leaf_items(EXPECTED_CONFIG)}

    cross_format = values_match(config, CROSS_FORMAT_VALUES)

    deep_merge_and_deletion = (
        actual_leaf_paths == expected_leaf_paths
        and same_json_type(config.get("database", {}).get("options"), EXPECTED_CONFIG["database"]["options"])
        and same_json_type(config.get("app", {}).get("features"), ["runtime-only"])
        and not get_path(config, "app.edition")[0]
        and not get_path(config, "custom.theme")[0]
        and not get_path(config, "database.options.sslmode")[0]
        and not get_path(config, "logging.handlers")[0]
    )

    migrations = (
        values_match(
            config,
            {
                "app.name": "Atlas",
                "database.credentials.user": "analyst",
                "network.host": "site.internal",
                "network.port": 9443,
            },
        )
        and "server" not in config
        and "service" not in config
        and not get_path(config, "database.username")[0]
    )

    substitutions = (
        values_match(
            config,
            {
                "app.banner": "Atlas at site.internal:9443 (TLS=True)",
                "operator.summary": "Atlas/9443",
                "paths.cache_dir": "/home/alice/atlas/cache",
                "paths.log_dir": "/home/alice/atlas/logs",
            },
        )
        and not has_substitution(config)
    )

    report_correct = (
        report == expected_report()
        and "runtime-password" not in report
        and "user-token" not in report
    )
    return [cross_format, deep_merge_and_deletion, migrations, substitutions, report_correct]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "solution" / "config_upgrade.py").is_file()

    notes: list[str] = []
    main_checks = [False] * 5
    main_parseable = False
    edge_passed = False
    main_holder: tempfile.TemporaryDirectory[str] | None = None
    edge_holder: tempfile.TemporaryDirectory[str] | None = None

    if artifact:
        try:
            main_holder, main_root = prepare_fixture(candidate, "main")
            main_run, main_timed_out = run_command(main_root)
            if main_timed_out:
                notes.append("main command timed out")
            elif main_run is None or main_run.returncode != 0:
                status = "unknown" if main_run is None else str(main_run.returncode)
                notes.append(f"main command exited with status {status}")
            else:
                try:
                    config, report = parse_main_outputs(main_root)
                    main_parseable = True
                    main_checks = check_main(config, report)
                except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
                    notes.append(f"main outputs invalid: {type(exc).__name__}")

            edge_holder, edge_root = prepare_fixture(candidate, "edge")
            edge_run, edge_timed_out = run_command(edge_root)
            if edge_timed_out:
                notes.append("edge command timed out")
            elif edge_run is not None:
                stderr = edge_run.stderr.casefold()
                edge_passed = (
                    edge_run.returncode == 2
                    and "cycle.first" in stderr
                    and "cycle.second" in stderr
                    and not (edge_root / "output" / "config.json").exists()
                )
                if not edge_passed:
                    notes.append("cycle edge behavior incorrect")
        except (OSError, subprocess.SubprocessError) as exc:
            notes.append(f"judge execution failed: {type(exc).__name__}")
        finally:
            if main_holder is not None:
                main_holder.cleanup()
            if edge_holder is not None:
                edge_holder.cleanup()

    passed = sum(main_checks)
    if not artifact:
        level = 0
    elif not main_parseable:
        level = 1
    elif passed == len(main_checks):
        level = 5 if edge_passed else 4
    elif passed:
        level = 3
    else:
        level = 2

    result = {
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": len(main_checks),
        "edge_check_passed": edge_passed,
        "notes": notes,
    }
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
