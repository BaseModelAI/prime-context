#!/usr/bin/env python3
"""Create deterministic main or edge workspaces for Task 14."""
from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

TASK_DIR = Path(__file__).resolve().parent
VISIBLE = TASK_DIR / "visible"
SEED = 20260831 + 14


def copy_visible(workspace: Path) -> None:
    """Copy the static initial payload without exposing runner-owned files."""
    for source in sorted(VISIBLE.rglob("*")):
        relative = source.relative_to(VISIBLE)
        destination = workspace / relative
        if source.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        elif source.is_file():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)


def write_edge_inputs(workspace: Path) -> None:
    """Write the one private edge: a two-key substitution cycle."""
    inputs = workspace / "inputs"
    if inputs.exists():
        shutil.rmtree(inputs)
    inputs.mkdir(parents=True)
    (inputs / "defaults.ini").write_text(
        '[cycle]\nfirst = "${cycle.second}"\nsecond = "${cycle.first}"\n',
        encoding="utf-8",
    )
    (inputs / "site.toml").write_text("# no site overrides\n", encoding="utf-8")
    (inputs / "user.json").write_text("{}\n", encoding="utf-8")
    (inputs / "runtime.json").write_text("{}\n", encoding="utf-8")
    (inputs / "key_migrations.csv").write_text(
        "old_key,new_key\n", encoding="utf-8"
    )


def seed_workspace(workspace: Path, fixture: str) -> None:
    random.Random(SEED).getstate()
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)
    copy_visible(workspace)
    if fixture == "edge":
        write_edge_inputs(workspace)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), required=True)
    args = parser.parse_args()
    seed_workspace(args.workspace, args.fixture)


if __name__ == "__main__":
    main()
