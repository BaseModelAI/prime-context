#!/usr/bin/env python3
"""Create a deterministic fresh Task 05 workspace."""
from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

SEED = 20260831 + 5


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    random.Random(SEED).getstate()
    workspace = args.workspace.resolve()
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)
    (workspace / "solution").mkdir()
    (workspace / "output").mkdir()


if __name__ == "__main__":
    main()
