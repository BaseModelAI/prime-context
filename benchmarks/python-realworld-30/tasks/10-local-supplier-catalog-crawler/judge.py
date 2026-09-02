#!/usr/bin/env python3
"""Direct main-and-edge judge for Task 10."""

import argparse
import csv
import io
import json
from pathlib import Path
import random
import selectors
import shutil
import subprocess
import sys
import tempfile

TASK_DIR = Path(__file__).resolve().parent
SEED = 20260831 + 10
HEADER = ["sku", "name", "price", "currency", "stock", "revision"]


def reference_rows(fixture):
    """Small independent calculation of the catalog's retained rows."""
    rng = random.Random(SEED)
    rows = []
    if fixture == "edge":
        rows = [
            ("EDGE-001", "Query & Link", "1.25", "USD", "7", "1"),
            ("EDGE-002", "Arrived <Safely>", "2.50", "USD", "3", "1"),
        ]
    else:
        for page in range(1, 41):
            for slot in range(8):
                number = (page - 1) * 8 + slot + 1
                marker = " & Workshop" if number % 37 == 0 else ""
                rows.append((
                    f"SKU-{number:04d}",
                    f"Supplier Part {number:04d}{marker}",
                    f"{rng.randrange(125, 25000) / 100:.2f}",
                    ("USD", "EUR", "GBP")[rng.randrange(3)],
                    str(rng.randrange(0, 501)),
                    str(rng.randrange(1, 8)),
                ))
        rows.extend([
            ("ACME-001", "Acme & Sons", "10.00", "USD", "4", "1"),
            ("ENTITY-001", "Safety <Shield> & Clamp", "12.50", "EUR", "9", "2"),
            ("REV-ONLY", "Revision Two", "5.00", "USD", "1", "2"),
            ("REV-ONLY", "Revision Ten", "7.00", "USD", "8", "10"),
            ("ACME-001", "Acme & Sons Deluxe", "11.00", "USD", "12", "3"),
        ])
    retained = {}
    for row in rows:
        if row[0] not in retained or int(row[5]) > int(retained[row[0]][5]):
            retained[row[0]] = row
    return [retained[sku] for sku in sorted(retained)]


def expected_csv(rows):
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, lineterminator="\n")
    writer.writerow(HEADER)
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8")


def start_server(fixture, log_path):
    process = subprocess.Popen(
        [
            sys.executable,
            str(TASK_DIR / "fixture_server.py"),
            "--port", "0",
            "--fixture", fixture,
            "--log", str(log_path),
        ],
        cwd=TASK_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    ready = selector.select(timeout=5)
    selector.close()
    if not ready:
        process.terminate()
        process.wait(timeout=3)
        raise RuntimeError("fixture service did not become ready")
    line = process.stdout.readline().strip()
    parts = line.split()
    if len(parts) != 2 or parts[0] != "LISTENING" or not parts[1].isdigit():
        process.terminate()
        process.wait(timeout=3)
        raise RuntimeError("fixture service returned an invalid ready line")
    return process, int(parts[1])


def parse_output(path):
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    reader = csv.reader(io.StringIO(text, newline=""))
    table = list(reader)
    if not table or table[0] != HEADER or any(len(row) != len(HEADER) for row in table[1:]):
        return raw, None
    records = [dict(zip(HEADER, row)) for row in table[1:]]
    return raw, records


def run_fixture(candidate_workspace, fixture):
    with tempfile.TemporaryDirectory(prefix=f"task10-{fixture}-") as tmp:
        workspace = Path(tmp) / "workspace"
        subprocess.run(
            [sys.executable, str(TASK_DIR / "seed.py"), "--workspace", str(workspace), "--fixture", fixture],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
        )
        source_solution = candidate_workspace / "solution"
        if source_solution.is_dir():
            shutil.rmtree(workspace / "solution")
            shutil.copytree(source_solution, workspace / "solution")
        log_path = Path(tmp) / "requests.jsonl"
        service = None
        returncode = None
        timed_out = False
        try:
            service, port = start_server(fixture, log_path)
            base_file = workspace / "inputs" / "base_url.txt"
            base_file.write_text(f"http://127.0.0.1:{port}/\n", encoding="utf-8")
            for input_path in (workspace / "inputs").iterdir():
                input_path.chmod(0o444)
            (workspace / "inputs").chmod(0o555)
            try:
                completed = subprocess.run(
                    [
                        sys.executable, "-E", "-S", "-m", "solution.catalog_sync",
                        "--base-url-file", "inputs/base_url.txt",
                        "--output", "output/catalog.csv",
                    ],
                    cwd=workspace,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=45,
                )
                returncode = completed.returncode
            except subprocess.TimeoutExpired:
                timed_out = True
        finally:
            if service is not None:
                service.terminate()
                try:
                    service.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    service.kill()
                    service.wait(timeout=3)

        requests = []
        if log_path.exists():
            for line in log_path.read_text(encoding="utf-8").splitlines():
                requests.append(json.loads(line))
        output_path = workspace / "output" / "catalog.csv"
        raw = b""
        records = None
        if output_path.is_file():
            try:
                raw, records = parse_output(output_path)
            except (UnicodeDecodeError, csv.Error, OSError):
                pass
        expected = reference_rows(fixture)
        return {
            "returncode": returncode,
            "timed_out": timed_out,
            "requests": requests,
            "raw": raw,
            "records": records,
            "expected": expected,
        }


def request_check(result, fixture):
    catalog = [item["target"] for item in result["requests"] if item.get("server") == "catalog"]
    decoy = [item for item in result["requests"] if item.get("server") == "decoy"]
    if fixture == "edge":
        expected = ["/", "/?page=2&channel=a%26b"]
    else:
        expected = ["/"] + [f"/catalog?page={page}" for page in range(2, 41)]
        expected.insert(17, "/catalog?page=17")
    waited = True
    if fixture == "main":
        retry = [item for item in result["requests"] if item.get("server") == "catalog" and item.get("target") == "/catalog?page=17"]
        waited = len(retry) == 2 and float(retry[1].get("at", 0)) - float(retry[0].get("at", 0)) >= 0.9
    return catalog == expected and not decoy and waited


def record_map(result):
    if result["records"] is None:
        return {}
    return {row["sku"]: row for row in result["records"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "solution" / "catalog_sync.py").is_file()
    notes = []

    try:
        main_result = run_fixture(candidate, "main")
        edge_result = run_fixture(candidate, "edge")
    except Exception as exc:
        result = {
            "status": "fail",
            "progress_level": 1 if artifact else 0,
            "main_checks_passed": 0,
            "main_checks_total": 5,
            "edge_check_passed": False,
            "notes": [f"judge setup failed: {type(exc).__name__}"],
        }
        print(json.dumps(result, sort_keys=True))
        return

    actual = record_map(main_result)
    expected_rows = main_result["expected"]
    expected_map = {row[0]: row for row in expected_rows}
    main_checks = [
        main_result["returncode"] == 0 and request_check(main_result, "main"),
        main_result["records"] is not None and set(actual) == set(expected_map),
        actual.get("ENTITY-001", {}).get("name") == "Safety <Shield> & Clamp"
        and actual.get("ACME-001", {}).get("name") == "Acme & Sons Deluxe",
        actual.get("REV-ONLY", {}).get("revision") == "10"
        and actual.get("REV-ONLY", {}).get("name") == "Revision Ten"
        and actual.get("ACME-001", {}).get("revision") == "3",
        main_result["raw"] == expected_csv(expected_rows),
    ]

    edge_ok = (
        edge_result["returncode"] == 0
        and request_check(edge_result, "edge")
        and edge_result["raw"] == expected_csv(edge_result["expected"])
    )
    passed = sum(main_checks)
    if main_result["timed_out"] or edge_result["timed_out"]:
        notes.append("candidate command timed out")
    if not artifact:
        level = 0
    elif main_result["records"] is None:
        level = 1
    elif all(main_checks):
        level = 5 if edge_ok else 4
    else:
        level = 3 if passed else 2
    result = {
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": 5,
        "edge_check_passed": edge_ok,
        "notes": notes,
    }
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
