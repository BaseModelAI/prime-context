#!/usr/bin/env python3
"""Generate Task 06 fairness policy."""
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
    policy = {"eligible_shift_minimum": 3, "max_count_difference": 1}
    (inputs / "fairness.json").write_text(json.dumps(policy, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
