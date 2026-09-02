#!/usr/bin/env python3
"""Runner-only generator for the intentionally incomplete monitor scaffold."""
from __future__ import annotations

import argparse
import random
from pathlib import Path

SEED = 20260831 + 13
SCAFFOLD = r'''#!/usr/bin/env python3
"""Read mixed service log records from stdin and emit an incident alert."""
from __future__ import annotations

import sys


def main() -> int:
    for _line in sys.stdin:
        pass
    # TODO: correlate deployment DROP COLUMN and application UNDEFINED_COLUMN.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


def generate(output: Path, fixture: str) -> None:
    random.Random(SEED + (300 if fixture == "main" else 301)).getstate()
    path = output / "monitor" / "monitor.py"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(SCAFFOLD, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    arguments = parser.parse_args()
    generate(arguments.output.resolve(), arguments.fixture)
