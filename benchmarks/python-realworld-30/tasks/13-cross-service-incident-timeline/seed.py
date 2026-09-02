#!/usr/bin/env python3
"""Create a clean workspace for task 13.

Large read-only log inputs are produced by runner-owned stage generators so they
are never exposed as solution files and are not committed to the corpus.
"""
from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

SEED = 20260831 + 13


def seed(workspace: Path, fixture: str) -> None:
    # Keep the prescribed seed explicit even though large filler records are
    # emitted later by the runner-owned payload generator.
    random.Random(SEED + (0 if fixture == "main" else 1))
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)
    (workspace / "solution").mkdir()
    (workspace / "output").mkdir()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    arguments = parser.parse_args()
    seed(arguments.workspace.resolve(), arguments.fixture)
