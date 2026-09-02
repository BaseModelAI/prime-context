#!/usr/bin/env python3
"""Generate the content-team rename follow-up for Task 16."""
from __future__ import annotations

import argparse
import csv
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    path = args.output / "inputs" / "renames.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    if args.fixture == "main":
        rows = [
            ("guides/move-me.md", "manuals/team/moved-guide.md"),
            ("articles/section-00/note-000.md", "archive/note-zero.md"),
        ]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(("old_path", "new_path"))
        writer.writerows(rows)


if __name__ == "__main__":
    main()
