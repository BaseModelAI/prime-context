#!/usr/bin/env python3
"""Runner-side generator for the withheld expedite stage."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", choices=("main", "edge"), default="main")
    args = parser.parse_args()
    (args.output / "stage.json").unlink(missing_ok=True)
    path = args.output / "inputs" / "expedite.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [("O0499",), ("O0500",)] if args.fixture == "main" else []
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(("order_id",))
        writer.writerows(rows)


if __name__ == "__main__":
    main()
