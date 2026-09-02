#!/usr/bin/env python3
"""Runner-only generator for the service clock offsets."""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

SEED = 20260831 + 13


def generate(output: Path, fixture: str) -> None:
    random.Random(SEED + (200 if fixture == "main" else 201)).getstate()
    value = {
        "sign_convention": "service_clock_equals_utc_plus_offset_ms",
        "offsets_ms": {
            "access": 2500,
            "application": 5000,
            "database": 1000,
            "deployment": -2000,
        },
    }
    path = output / "inputs" / "clock_offsets.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    arguments = parser.parse_args()
    generate(arguments.output.resolve(), arguments.fixture)
