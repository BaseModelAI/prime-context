#!/usr/bin/env python3.12
"""Create a deterministic workspace for task 26."""
from __future__ import annotations

import argparse
import csv
import json
import random
import shutil
from pathlib import Path

SEED = 20260831 + 26
CSV_INPUTS = ("ingredients.csv", "recipes.csv", "recipe_components.csv", "menu.csv", "students.csv")


def _shuffle_csv(path: Path, rng: random.Random) -> None:
    with path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.reader(handle))
    header, data = rows[0], rows[1:]
    rng.shuffle(data)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(header)
        writer.writerows(data)



def seed(workspace: Path, fixture: str) -> None:
    source = Path(__file__).resolve().parent
    workspace.mkdir(parents=True, exist_ok=True)
    for name in ("inputs", "solution", "output"):
        target = workspace / name
        if target.exists():
            shutil.rmtree(target)
        target.mkdir()
    shutil.copy2(source / "TASK.md", workspace / "TASK.md")
    for item in (source / "visible" / "inputs").iterdir():
        shutil.copy2(item, workspace / "inputs" / item.name)

    rng = random.Random(SEED)
    for name in CSV_INPUTS:
        _shuffle_csv(workspace / "inputs" / name, rng)



def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    seed(args.workspace.resolve(), args.fixture)


if __name__ == "__main__":
    main()
