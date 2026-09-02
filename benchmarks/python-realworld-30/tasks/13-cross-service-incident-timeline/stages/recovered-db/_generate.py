#!/usr/bin/env python3
"""Runner-only generator for the recovered database log batch."""
from __future__ import annotations

import argparse
import gzip
import io
import random
from pathlib import Path

SEED = 20260831 + 13


def timestamp(index: int, salt: int) -> str:
    second = (index * 29 + salt) % 1_800
    return f"2025-04-17T14:{second // 60:02d}:{second % 60:02d}.{index % 1000:03d}Z"


def generate(output: Path, fixture: str) -> None:
    rng = random.Random(SEED + (100 if fixture == "main" else 101))
    count = 5_000 if fixture == "main" else 20
    anchor = 2_345 if fixture == "main" else 10
    path = output / "inputs" / "logs" / "db-extra.log.gz"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as raw:
        with gzip.GzipFile(filename="", fileobj=raw, mode="wb", compresslevel=1, mtime=0) as zipped:
            with io.TextIOWrapper(zipped, encoding="utf-8", newline="\n") as stream:
                for line_number in range(1, count + 1):
                    if line_number == anchor:
                        stream.write(
                            'timestamp=2025-04-17T14:08:04.000Z service=database severity=INFO '
                            'release_id=2025.04.17.3 code=SCHEMA_APPLIED column=customer_status '
                            'operation="ALTER TABLE customers DROP COLUMN customer_status" '
                            'message="migration 042_customer_cleanup committed"\n'
                        )
                    else:
                        stamp = timestamp(line_number, rng.randrange(1_800))
                        stream.write(
                            f'timestamp={stamp} service=database severity=INFO '
                            f'release_id=noise-extra-{line_number % 17:02d} code=QUERY_SAMPLE '
                            f'message="unrelated recovered record {line_number}"\n'
                        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    arguments = parser.parse_args()
    generate(arguments.output.resolve(), arguments.fixture)
