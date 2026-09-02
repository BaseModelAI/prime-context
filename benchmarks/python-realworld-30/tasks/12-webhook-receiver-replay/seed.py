#!/usr/bin/env python3
"""Create a fresh deterministic workspace for task 12."""

from __future__ import annotations

import argparse
import json
import random
import shutil
from pathlib import Path

SEED = 20260831 + 12


def seed(workspace: Path, fixture: str) -> None:
    if workspace.exists():
        if workspace.is_symlink() or not workspace.is_dir():
            raise ValueError(f"workspace is not a normal directory: {workspace}")
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)

    task_dir = Path(__file__).resolve().parent
    shutil.copytree(task_dir / "visible" / "webhook_app", workspace / "webhook_app")
    shutil.copy2(task_dir / "TASK.md", workspace / "TASK.md")
    (workspace / "workspace").mkdir()
    inputs = workspace / "inputs"
    inputs.mkdir()

    rng = random.Random(SEED)
    example_number = rng.randrange(100000, 1000000)
    if fixture == "main":
        example = {
            "kind": "example.created",
            "reference": f"sample-{example_number}",
            "value": 17,
        }
        (inputs / "example_event.json").write_text(
            json.dumps(example, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
    else:
        # This is the one stated edge: a malformed object body.
        (inputs / "invalid_event.txt").write_text(
            '{"reference":"edge-%d","value":' % example_number,
            encoding="utf-8",
        )

    # The suite runner owns the live loopback sink and writes sink_url.txt
    # after this seed step.  Later-stage content is likewise runner-only.


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    seed(args.workspace.resolve(), args.fixture)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
