#!/usr/bin/env python3
"""Runner-side generator for the withheld warehouse-outage stage."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", choices=("main", "edge"), default="main")
    args = parser.parse_args()
    (args.output / "stage.json").unlink(missing_ok=True)
    path = args.output / "inputs" / "warehouse_outage.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    warehouse = "W-B" if args.fixture == "main" else "W-D"
    payload = {
        "warehouse_id": warehouse,
        "effective_date": "2025-09-02",
        "reason": "flood closure" if args.fixture == "main" else "edge maintenance",
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
