#!/usr/bin/env python3
"""Create only the initial visible workspace for Task 10."""

import argparse
from pathlib import Path
import random
import shutil

SEED = 20260831 + 10


def seed(workspace, fixture):
    # Catalog filler uses this same task seed in fixture_server.py.  Constructing
    # it here keeps the seeding contract explicit even though this task's data
    # is served at runtime rather than written into the agent workspace.
    rng = random.Random(SEED)
    rng.getstate()

    task_dir = Path(__file__).resolve().parent
    if workspace.exists():
        shutil.rmtree(workspace)
    workspace.mkdir(parents=True)
    inputs = workspace / "inputs"
    inputs.mkdir()
    (workspace / "solution").mkdir()
    (workspace / "output").mkdir()
    shutil.copyfile(task_dir / "TASK.md", workspace / "TASK.md")
    # The suite runner writes inputs/base_url.txt after it starts the service.


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--fixture", choices=("main", "edge"), required=True)
    args = parser.parse_args()
    seed(args.workspace.resolve(), args.fixture)


if __name__ == "__main__":
    main()
