#!/usr/bin/env python3
"""Create a clean scaffold for Task 02; stage payloads are runner-injected."""
from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

SEED = 20260831 + 2


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), required=True)
    args = parser.parse_args()

    # Instantiate the task's fixed RNG on every fixture path.  The runner-side
    # payload generators use the same seed for the actual calendar records.
    random.Random(SEED).getstate()
    workspace = args.workspace.resolve()
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)
    (workspace / "solution").mkdir()
    (workspace / "output").mkdir()
    # In particular, do not create inputs/late_changes.ics here.  It belongs
    # only to the second runner stage.


if __name__ == "__main__":
    main()
