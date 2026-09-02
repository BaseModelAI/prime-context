#!/usr/bin/env python3
"""Generate the hidden receipt-correction follow-up payload."""

import argparse
import json
import random
from pathlib import Path

SEED = 20260831 + 23


def generate(output: Path, fixture: str) -> None:
    (output / "stage.json").unlink(missing_ok=True)
    # Keep the stage tied to the task seed even though anchor corrections are explicit.
    random.Random(SEED)
    inputs = output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    if fixture == "main":
        corrections = [
            {"record_id": "REC-002", "action": "void"},
            {
                "record_id": "REC-001",
                "action": "replace",
                "replacement": {
                    "receipt_id": "REC-001-R1",
                    "received_date": "2025-04-08",
                    "po_id": "PO-100",
                    "line_id": "L01",
                    "quantity": "102",
                    "unit": "each",
                },
            },
            {
                "record_id": "REC-003",
                "action": "replace",
                "replacement": {
                    "receipt_id": "REC-003-R1",
                    "received_date": "2025-04-10",
                    "po_id": "PO-100",
                    "line_id": "L02",
                    "quantity": "9.8",
                    "unit": "case",
                },
            },
        ]
    else:
        corrections = []
    payload = {"corrections": corrections}
    (inputs / "receipt_corrections.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    generate(args.output.resolve(), args.fixture)


if __name__ == "__main__":
    main()
