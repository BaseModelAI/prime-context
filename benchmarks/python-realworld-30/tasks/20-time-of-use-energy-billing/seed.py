#!/usr/bin/env python3
"""Create a clean candidate workspace for Task 20."""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil

SEED = 20260831 + 20


def seed(workspace: Path, fixture: str) -> None:
    # Fixture payloads are materialized separately, outside the workspace.
    _ = (SEED, fixture)
    if workspace.exists():
        if workspace.is_symlink() or not workspace.is_dir():
            raise ValueError(f"workspace is not a normal directory: {workspace}")
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)
    (workspace / "solution").mkdir()
    (workspace / "output").mkdir()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    seed(args.workspace.resolve(), args.fixture)
