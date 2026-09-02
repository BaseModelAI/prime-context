#!/usr/bin/env python3
"""Generate Task 20's retroactive tariff correction."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def generate(output: Path, fixture: str) -> None:
    _ = fixture
    target = output / "inputs" / "tariff_correction.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    correction = {
        "effective_from": "2025-10-15T00:00:00",
        "new_price_per_kwh": "0.2500",
        "new_rate_id": "PEAK-CORR-2025-10-15",
        "rate_id": "PEAK-OCT",
    }
    target.write_text(json.dumps(correction, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    generate(args.output.resolve(), args.fixture)
