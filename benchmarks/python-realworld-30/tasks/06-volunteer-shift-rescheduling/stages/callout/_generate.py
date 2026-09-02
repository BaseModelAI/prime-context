#!/usr/bin/env python3
"""Generate Task 06 callout data."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    inputs = args.output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    unavailable = ["V01", "V13"] if args.fixture == "main" else []
    (inputs / "callout.json").write_text(json.dumps({"unavailable_volunteer_ids": unavailable}, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
