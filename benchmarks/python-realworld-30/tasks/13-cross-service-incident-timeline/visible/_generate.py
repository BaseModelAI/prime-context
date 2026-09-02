#!/usr/bin/env python3
"""Runner-only deterministic generator for the initial large log payload."""
from __future__ import annotations

import argparse
import gzip
import io
import json
import random
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, TextIO

SEED = 20260831 + 13
MAIN_COUNTS = {
    "access.log": 450_000,
    "application.log.gz": 400_000,
    "deployment.log": 250_000,
    "database.log.gz": 400_000,
}


@contextmanager
def text_output(path: Path) -> Iterator[TextIO]:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == ".gz":
        with path.open("wb") as raw:
            with gzip.GzipFile(filename="", fileobj=raw, mode="wb", compresslevel=1, mtime=0) as zipped:
                with io.TextIOWrapper(zipped, encoding="utf-8", newline="\n") as text:
                    yield text
    else:
        with path.open("w", encoding="utf-8", newline="\n") as text:
            yield text


def filler_timestamp(index: int, salt: int) -> str:
    second = (index * 17 + salt) % 1_800
    return f"2025-04-17T14:{second // 60:02d}:{second % 60:02d}.{index % 1000:03d}Z"


def write_access(path: Path, count: int, salt: int, edge: bool) -> None:
    anchors = {
        12_345: "2025-04-17T14:08:10.500Z | access | ERROR | request_id=req-1001 release_id=2025.04.17.3 code=HTTP_RESPONSE status=500 method=GET path=/customers/101",
        230_001: "2025-04-17T14:08:14.800Z | access | ERROR | request_id=req-1002 release_id=2025.04.17.3 code=HTTP_RESPONSE status=500 method=GET path=/customers/102",
        449_000: "2025-04-17T14:08:21.400Z | access | ERROR | request_id=req-1003 release_id=2025.04.17.3 code=HTTP_RESPONSE status=500 method=GET path=/customers/103",
    }
    if edge:
        anchors = {
            20: anchors[12_345],
            70: anchors[230_001],
            # Same external request ID, but this is a separate next-day chain.
            110: "2025-04-18T14:08:10.500Z | access | ERROR | request_id=req-1001 code=HTTP_RESPONSE status=500 method=GET path=/unrelated-retry",
        }
    with text_output(path) as output:
        for line_number in range(1, count + 1):
            if line_number in anchors:
                output.write(anchors[line_number] + "\n")
                continue
            timestamp = filler_timestamp(line_number, salt)
            severity = "ERROR" if line_number % 997 == 0 else "INFO"
            status = 503 if severity == "ERROR" else 200
            code = "UPSTREAM_TIMEOUT" if severity == "ERROR" else "HTTP_RESPONSE"
            output.write(
                f"{timestamp} | access | {severity} | request_id=n{line_number:07d} "
                f"release_id=na{line_number % 31:02d} code={code} status={status}\n"
            )


def write_application(path: Path, count: int, salt: int, edge: bool) -> None:
    anchors = {
        20_002: "2025-04-17T14:08:12.000Z [ERROR] application request_id=req-1001 release_id=2025.04.17.3 code=UNDEFINED_COLUMN message=\"psycopg.errors.UndefinedColumn: column customer_status does not exist\"",
        210_005: "2025-04-17T14:08:16.000Z [ERROR] application request_id=req-1002 release_id=2025.04.17.3 code=UNDEFINED_COLUMN message=\"psycopg.errors.UndefinedColumn: column customer_status does not exist\"",
        399_999: "2025-04-17T14:08:23.000Z [ERROR] application request_id=req-1003 release_id=2025.04.17.3 code=UNDEFINED_COLUMN message=\"psycopg.errors.UndefinedColumn: column customer_status does not exist\"",
    }
    if edge:
        anchors = {25: anchors[20_002], 75: anchors[210_005]}
    with text_output(path) as output:
        for line_number in range(1, count + 1):
            if line_number in anchors:
                output.write(anchors[line_number] + "\n")
                continue
            timestamp = filler_timestamp(line_number, salt)
            severity = "ERROR" if line_number % 751 == 0 else "INFO"
            code = "CACHE_TIMEOUT" if severity == "ERROR" else "REQUEST_COMPLETE"
            output.write(
                f"{timestamp} [{severity}] application request_id=noise-p-{line_number:07d} "
                f"release_id=noise-app-{line_number % 29:02d} code={code} message=\"unrelated application record {line_number}\"\n"
            )


def write_deployment(path: Path, count: int, salt: int, edge: bool) -> None:
    causal = {
        "timestamp": "2025-04-17T14:08:00.000Z",
        "service": "deployment",
        "severity": "INFO",
        "release": "2025.04.17.3",
        "event": "SCHEMA_CHANGE",
        "operation": "ALTER TABLE customers DROP COLUMN customer_status",
        "message": "applying migration 042_customer_cleanup",
    }
    anchor_line = 40 if edge else 175_000
    with text_output(path) as output:
        for line_number in range(1, count + 1):
            if line_number == anchor_line:
                output.write(json.dumps(causal, sort_keys=True, separators=(",", ":")) + "\n")
                continue
            timestamp = filler_timestamp(line_number, salt)
            severity = "ERROR" if line_number % 1201 == 0 else "INFO"
            event = "HEALTHCHECK_FAILED" if severity == "ERROR" else "RELEASE_CHECK"
            output.write(
                '{"event":"%s","release":"nd%02d","service":"deployment",'
                '"severity":"%s","timestamp":"%s"}\n'
                % (event, line_number % 23, severity, timestamp)
            )


def write_database(path: Path, count: int, salt: int) -> None:
    with text_output(path) as output:
        for line_number in range(1, count + 1):
            timestamp = filler_timestamp(line_number, salt)
            severity = "ERROR" if line_number % 887 == 0 else "INFO"
            code = "LOCK_TIMEOUT" if severity == "ERROR" else "QUERY_SAMPLE"
            output.write(
                f"timestamp={timestamp} service=database severity={severity} "
                f"release_id=noise-db-{line_number % 19:02d} code={code} "
                f"message=\"unrelated database record {line_number}\"\n"
            )


def generate(output: Path, fixture: str) -> None:
    rng = random.Random(SEED + (0 if fixture == "main" else 1))
    salts = [rng.randrange(1_800) for _ in range(4)]
    logs = output / "inputs" / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    if fixture == "main":
        counts = MAIN_COUNTS
    else:
        counts = {name: 120 for name in MAIN_COUNTS}
    write_access(logs / "access.log", counts["access.log"], salts[0], fixture == "edge")
    write_application(logs / "application.log.gz", counts["application.log.gz"], salts[1], fixture == "edge")
    write_deployment(logs / "deployment.log", counts["deployment.log"], salts[2], fixture == "edge")
    write_database(logs / "database.log.gz", counts["database.log.gz"], salts[3])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    arguments = parser.parse_args()
    generate(arguments.output.resolve(), arguments.fixture)
