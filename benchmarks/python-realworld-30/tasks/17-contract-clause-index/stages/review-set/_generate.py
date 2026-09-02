#!/usr/bin/env python3
"""Generate the stage-2 review set."""
from __future__ import annotations
import argparse
import csv
from pathlib import Path


def generate(output: Path, fixture: str) -> None:
    target = output / "inputs" / "review_set.csv"
    target.parent.mkdir(parents=True, exist_ok=True)
    ids = ["E001"] if fixture == "edge" else [f"C{number:03d}" for number in range(1, 19)]
    with target.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["contract_id"])
        writer.writerows((item,) for item in ids)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    generate(args.output.resolve(), args.fixture)
