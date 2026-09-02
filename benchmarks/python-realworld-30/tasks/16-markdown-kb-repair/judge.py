#!/usr/bin/env python3
"""Direct semantic main-and-edge judge for Task 16."""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

PYTHON = "python3.12"
REPORT_FIELDS = ["source_path", "original_target", "resolved_target", "status"]
RENAMES = {
    "guides/move-me.md": "manuals/team/moved-guide.md",
    "articles/section-00/note-000.md": "archive/note-zero.md",
}

EXPECTED_START = """# Start Here

[Old API](../reference/api.md#café-setup)
[Moved page](../manuals/team/moved-guide.md#overview)
[Redirect moved](../manuals/team/moved-guide.md#overview)
[Unknown](../missing/nope.md)
[Ambiguous](../legacy/ambiguous.md)
![Old logo](../assets/logo.bin)
[Web](https://example.invalid/guide)
[Mail](mailto:docs@example.invalid)
[Root path](/reference/api.md)

```markdown
[Old API](../legacy/api-old.md#not-a-real-anchor)
![Old logo](../assets/old-logo.bin)
```
"""
EXPECTED_CONSUMER = """# Consumer

See [the overview](../manuals/team/moved-guide.md#overview) and [the second repeat](../reference/api.md#repeat-1).
Return to [this page](#consumer).
"""
EXPECTED_MOVED = """# Moving Guide

## Overview
This document will move.

[API setup](../../reference/api.md#café-setup)
![Logo](../../assets/logo.bin)
"""
EXPECTED_OVERVIEW = """# Knowledge Base

See [Start](docs/start.md) and [API](reference/api.md#api-reference).
"""
MAIN_FENCE = """```markdown
[Old API](../legacy/api-old.md#not-a-real-anchor)
![Old logo](../assets/old-logo.bin)
```"""

EXPECTED_REPORT = [
    {"source_path": "docs/start.md", "original_target": "../legacy/api-old.md#CAFÉ-SETUP", "resolved_target": "reference/api.md#café-setup", "status": "repaired"},
    {"source_path": "docs/start.md", "original_target": "../guides/move-me.md#Overview!", "resolved_target": "manuals/team/moved-guide.md#overview", "status": "repaired"},
    {"source_path": "docs/start.md", "original_target": "../legacy/moved-old.md#OVERVIEW", "resolved_target": "manuals/team/moved-guide.md#overview", "status": "repaired"},
    {"source_path": "docs/start.md", "original_target": "../missing/nope.md", "resolved_target": "", "status": "unresolved"},
    {"source_path": "docs/start.md", "original_target": "../legacy/ambiguous.md", "resolved_target": "", "status": "unresolved"},
    {"source_path": "docs/start.md", "original_target": "../assets/old-logo.bin", "resolved_target": "assets/logo.bin", "status": "repaired"},
    {"source_path": "docs/start.md", "original_target": "https://example.invalid/guide", "resolved_target": "", "status": "external"},
    {"source_path": "docs/start.md", "original_target": "mailto:docs@example.invalid", "resolved_target": "", "status": "external"},
    {"source_path": "docs/start.md", "original_target": "/reference/api.md", "resolved_target": "", "status": "external"},
    {"source_path": "guides/consumer.md", "original_target": "move-me.md#OVERVIEW!", "resolved_target": "manuals/team/moved-guide.md#overview", "status": "repaired"},
    {"source_path": "guides/consumer.md", "original_target": "../reference/api.md#repeat-1", "resolved_target": "reference/api.md#repeat-1", "status": "ok"},
    {"source_path": "guides/consumer.md", "original_target": "#CONSUMER!", "resolved_target": "guides/consumer.md#consumer", "status": "repaired"},
    {"source_path": "manuals/team/moved-guide.md", "original_target": "../reference/api.md#CAFÉ SETUP!", "resolved_target": "reference/api.md#café-setup", "status": "repaired"},
    {"source_path": "manuals/team/moved-guide.md", "original_target": "../assets/logo.bin", "resolved_target": "assets/logo.bin", "status": "repaired"},
    {"source_path": "overview.md", "original_target": "docs/start.md", "resolved_target": "docs/start.md", "status": "ok"},
    {"source_path": "overview.md", "original_target": "reference/api.md#api-reference", "resolved_target": "reference/api.md#api-reference", "status": "ok"},
]

EDGE_INPUT = """# Fence Edge

Before.

   ~~~~markdown
[Broken](../legacy/api-old.md#WRONG)
![Old logo](../assets/old-logo.bin)
   ~~~~

After [valid](../reference/api.md#REAL HEADING!).
"""
EDGE_EXPECTED = EDGE_INPUT.replace(
    "../reference/api.md#REAL HEADING!", "../reference/api.md#real-heading"
)
EDGE_FENCE = """   ~~~~markdown
[Broken](../legacy/api-old.md#WRONG)
![Old logo](../assets/old-logo.bin)
   ~~~~"""
EDGE_REPORT = [{
    "source_path": "docs/edge.md",
    "original_target": "../reference/api.md#REAL HEADING!",
    "resolved_target": "reference/api.md#real-heading",
    "status": "repaired",
}]


def run_python(script_or_flag: str, *arguments: str, cwd: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [PYTHON, "-E", "-S", script_or_flag, *arguments],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def merge_copy(source: Path, destination: Path) -> None:
    for path in sorted(source.rglob("*")):
        relative = path.relative_to(source)
        target = destination / relative
        if path.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif path.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)


def prepare(candidate: Path, fixture: str) -> tuple[tempfile.TemporaryDirectory[str], Path, bool]:
    holder = tempfile.TemporaryDirectory(prefix=f"pcbench-16-{fixture}-")
    root = Path(holder.name)
    workspace = root / "workspace"
    workspace.mkdir()
    task_dir = Path(__file__).resolve().parent

    seeded = run_python(
        str(task_dir / "seed.py"), "--workspace", str(workspace), "--fixture", fixture,
        cwd=task_dir, timeout=30,
    )
    if seeded.returncode != 0:
        holder.cleanup()
        raise RuntimeError("fixture seed failed")

    # Generators write to sibling payload directories, never into the candidate workspace.
    initial_payload = root / "initial-payload"
    initial_payload.mkdir()
    generated = run_python(
        str(task_dir / "visible" / "_generate.py"), "--output", str(initial_payload), "--fixture", fixture,
        cwd=task_dir / "visible", timeout=30,
    )
    if generated.returncode != 0:
        holder.cleanup()
        raise RuntimeError("initial fixture generation failed")
    merge_copy(initial_payload, workspace)

    followup_payload = root / "followup-payload"
    followup_payload.mkdir()
    generated = run_python(
        str(task_dir / "stages" / "renames" / "_generate.py"),
        "--output", str(followup_payload), "--fixture", fixture,
        cwd=task_dir / "stages" / "renames", timeout=30,
    )
    if generated.returncode != 0:
        holder.cleanup()
        raise RuntimeError("follow-up fixture generation failed")
    merge_copy(followup_payload, workspace)

    # solution/ is the only candidate artifact needed to rebuild fresh outputs.
    source = candidate / "solution"
    copied = source.is_dir() and (source / "kb_repair.py").is_file()
    if source.is_dir():
        shutil.copytree(source, workspace / "solution", dirs_exist_ok=True)
    return holder, workspace, copied


def run_candidate(workspace: Path) -> subprocess.CompletedProcess[str]:
    return run_python(
        "-m", "solution.kb_repair", "inputs/kb", "--redirects", "inputs/redirects.json",
        "--output", "output", cwd=workspace, timeout=60,
    )


def import_candidate(workspace: Path) -> bool:
    result = run_python("-c", "import solution.kb_repair", cwd=workspace, timeout=10)
    return result.returncode == 0


def read_report(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != REPORT_FIELDS:
            raise ValueError("wrong report header")
        rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError("malformed report row")
    return rows


def read_index(path: Path) -> tuple[dict[str, object], bool]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("index is not an object")
    return data, keys_are_sorted(data)


def keys_are_sorted(value: object) -> bool:
    if isinstance(value, dict):
        return list(value) == sorted(value) and all(keys_are_sorted(item) for item in value.values())
    if isinstance(value, list):
        return all(keys_are_sorted(item) for item in value)
    return True


def entry(title: str, headings: list[tuple[str, str]], outgoing: list[str]) -> dict[str, object]:
    return {
        "title": title,
        "headings": [{"text": text, "anchor": anchor} for text, anchor in headings],
        "outgoing_local_links": outgoing,
    }


def expected_index() -> dict[str, object]:
    expected: dict[str, object] = {}
    for index in range(245):
        original = f"articles/section-{index % 7:02d}/note-{index:03d}.md"
        final = RENAMES.get(original, original)
        text = f"Note {index:03d}"
        expected[final] = entry(text, [(text, f"note-{index:03d}")], [])
    expected.update({
        "docs/start.md": entry("Start Here", [("Start Here", "start-here")], [
            "reference/api.md#café-setup",
            "manuals/team/moved-guide.md#overview",
            "manuals/team/moved-guide.md#overview",
            "assets/logo.bin",
        ]),
        "guides/consumer.md": entry("Consumer", [("Consumer", "consumer")], [
            "manuals/team/moved-guide.md#overview",
            "reference/api.md#repeat-1",
            "guides/consumer.md#consumer",
        ]),
        "manuals/team/moved-guide.md": entry("Moving Guide", [
            ("Moving Guide", "moving-guide"), ("Overview", "overview")
        ], ["reference/api.md#café-setup", "assets/logo.bin"]),
        "overview.md": entry("Knowledge Base", [("Knowledge Base", "knowledge-base")], [
            "docs/start.md", "reference/api.md#api-reference"
        ]),
        "reference/api.md": entry("API Reference", [
            ("API Reference", "api-reference"),
            ("Café Setup!", "café-setup"),
            ("Repeat", "repeat"),
            ("Repeat", "repeat-1"),
            ("A_B", "ab"),
        ], []),
    })
    return expected


def main_checks(workspace: Path, report: list[dict[str, str]], index: dict[str, object], sorted_keys: bool) -> list[bool]:
    source_kb = workspace / "inputs" / "kb"
    output_kb = workspace / "output" / "kb"
    source_files = {path.relative_to(source_kb).as_posix(): path for path in source_kb.rglob("*") if path.is_file()}
    expected_paths = {RENAMES.get(relative, relative) for relative in source_files}
    actual_files = {path.relative_to(output_kb).as_posix(): path for path in output_kb.rglob("*") if path.is_file()}
    changed = {"docs/start.md", "guides/consumer.md", "guides/move-me.md"}
    unchanged_bytes = all(
        actual_files.get(RENAMES.get(relative, relative), Path("/__missing__")).is_file()
        and actual_files[RENAMES.get(relative, relative)].read_bytes() == path.read_bytes()
        for relative, path in source_files.items() if relative not in changed
    )
    copy_and_rename = (
        set(actual_files) == expected_paths
        and len([name for name in expected_paths if name.endswith(".md")]) == 250
        and unchanged_bytes
        and "guides/move-me.md" not in actual_files
        and "articles/section-00/note-000.md" not in actual_files
    )

    report_exact = report == EXPECTED_REPORT

    general_repairs = (
        (output_kb / "docs" / "start.md").read_text(encoding="utf-8") == EXPECTED_START
        and (output_kb / "guides" / "consumer.md").read_text(encoding="utf-8") == EXPECTED_CONSUMER
        and (output_kb / "overview.md").read_text(encoding="utf-8") == EXPECTED_OVERVIEW
    )

    index_exact = index == expected_index() and sorted_keys

    start_text = (output_kb / "docs" / "start.md").read_text(encoding="utf-8")
    moved_text = (output_kb / "manuals" / "team" / "moved-guide.md").read_text(encoding="utf-8")
    rename_and_fence = (
        moved_text == EXPECTED_MOVED
        and MAIN_FENCE in start_text
        and "not-a-real-anchor" not in "\n".join(row["original_target"] for row in report)
        and start_text.count("../manuals/team/moved-guide.md#overview") == 2
    )
    return [copy_and_rename, report_exact, general_repairs, index_exact, rename_and_fence]


def check_edge(workspace: Path) -> bool:
    report = read_report(workspace / "output" / "link_report.csv")
    text = (workspace / "output" / "kb" / "docs" / "edge.md").read_text(encoding="utf-8")
    return (
        text == EDGE_EXPECTED
        and EDGE_FENCE in text
        and report == EDGE_REPORT
        and "../legacy/api-old.md#WRONG" in text
        and (workspace / "output" / "kb" / "assets" / "logo.bin").read_bytes() == b"EDGE\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.workspace.resolve()

    checks = [False] * 5
    edge_passed = False
    artifact = (candidate / "solution" / "kb_repair.py").is_file()
    runnable = False
    parseable = False
    notes: list[str] = []
    holders: list[tempfile.TemporaryDirectory[str]] = []

    try:
        main_holder, main_workspace, copied = prepare(candidate, "main")
        holders.append(main_holder)
        artifact = artifact and copied
        result = run_candidate(main_workspace)
        runnable = result.returncode == 0 or (copied and import_candidate(main_workspace))
        if result.returncode != 0:
            notes.append("main command failed")
        else:
            try:
                report = read_report(main_workspace / "output" / "link_report.csv")
                index, sorted_keys = read_index(main_workspace / "output" / "index.json")
                if not (main_workspace / "output" / "kb").is_dir():
                    raise ValueError("output KB missing")
                parseable = True
                checks = main_checks(main_workspace, report, index, sorted_keys)
            except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError, KeyError):
                notes.append("main outputs are not parseable")

        edge_holder, edge_workspace, _ = prepare(candidate, "edge")
        holders.append(edge_holder)
        edge_result = run_candidate(edge_workspace)
        if edge_result.returncode != 0:
            notes.append("edge command failed")
        else:
            try:
                edge_passed = check_edge(edge_workspace)
            except (OSError, UnicodeError, csv.Error, json.JSONDecodeError, ValueError, KeyError):
                edge_passed = False
    except (OSError, RuntimeError, subprocess.SubprocessError):
        notes.append("judge execution failed")
    finally:
        for holder in holders:
            holder.cleanup()

    passed = sum(checks)
    if not artifact or not runnable:
        level = 0
    elif not parseable:
        level = 1
    elif passed == 5:
        level = 5 if edge_passed else 4
    elif passed:
        level = 3
    else:
        level = 2
    print(json.dumps({
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": 5,
        "edge_check_passed": edge_passed,
        "notes": notes,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
