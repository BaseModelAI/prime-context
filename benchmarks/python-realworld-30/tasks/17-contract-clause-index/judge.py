#!/usr/bin/env python3
"""Direct main-and-edge judge for Task 17."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

TASK = Path(__file__).resolve().parent
PYTHON = shutil.which("python3.12")
CLAUSE_TYPES = ("auto_renewal", "termination_notice_days", "governing_law", "liability_cap", "data_retention_days")
HEADER = ["contract_id", "clause_type", "normalized_value", "start_line", "end_line", "excerpt"]


def invoke(script: Path, *arguments: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [PYTHON or "python3.12", "-E", "-S", str(script), *arguments],
        cwd=cwd, text=True, capture_output=True, timeout=300,
    )


def prepare(candidate: Path, fixture: str) -> tuple[Path, tempfile.TemporaryDirectory[str], bool, str]:
    holder = tempfile.TemporaryDirectory(prefix=f"task17-{fixture}-")
    root = Path(holder.name)
    work = root / "workspace"
    seeded = invoke(TASK / "seed.py", "--workspace", str(work), "--fixture", fixture, cwd=TASK)
    if seeded.returncode:
        return work, holder, False, "fixture seed failed"
    for source in (TASK / "visible", TASK / "stages/review-set", TASK / "stages/late-contracts"):
        payload = Path(tempfile.mkdtemp(prefix="task17-payload-"))
        try:
            generated = invoke(source / "_generate.py", "--output", str(payload), "--fixture", fixture, cwd=source)
            if generated.returncode:
                return work, holder, False, "fixture generator failed"
            shutil.copytree(payload, work, dirs_exist_ok=True)
        finally:
            shutil.rmtree(payload, ignore_errors=True)
    artifact = candidate / "solution"
    shutil.rmtree(work / "solution", ignore_errors=True)
    if artifact.is_dir():
        shutil.copytree(artifact, work / "solution")
    else:
        (work / "solution").mkdir()
    completed = subprocess.run(
        [PYTHON or "python3.12", "-E", "-S", "-m", "solution.clause_index", "inputs/contracts", "--output", "output"],
        cwd=work, text=True, capture_output=True, timeout=180,
    )
    detail = "" if completed.returncode == 0 else completed.stderr[-300:]
    return work, holder, completed.returncode == 0, detail


def read_csv(path: Path, header: list[str]) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != header:
            raise ValueError(f"bad header for {path.name}")
        rows = list(reader)
    if any(None in row or None in row.values() for row in rows):
        raise ValueError(f"malformed row in {path.name}")
    return rows


def expected_main() -> dict[tuple[str, str], str]:
    expected: dict[tuple[str, str], str] = {}
    for number in range(1, 121):
        cid = f"C{number:03d}"
        if number % 41:
            expected[cid, "auto_renewal"] = ("yes", "no", "yes")[(number - 1) % 3]
        expected[cid, "termination_notice_days"] = str((30, 60, 45)[(number - 1) % 3])
        if number % 37:
            expected[cid, "governing_law"] = ("California", "New York", "Texas")[(number - 1) % 3]
        expected[cid, "liability_cap"] = ("usd:100000", "fees_months:6", "usd:250000")[(number - 1) % 3]
        if number % 29:
            expected[cid, "data_retention_days"] = str((45, 30, 90)[(number - 1) % 3])
    return expected


def expected_main_spans() -> dict[tuple[str, str], tuple[int, int]]:
    spans: dict[tuple[str, str], tuple[int, int]] = {}
    for number in range(1, 121):
        cid = f"C{number:03d}"
        line = 3
        for clause, present in (
            ("auto_renewal", number % 41 != 0),
            ("termination_notice_days", True),
            ("governing_law", number % 37 != 0),
            ("liability_cap", True),
            ("data_retention_days", number % 29 != 0),
        ):
            if present:
                spans[cid, clause] = (line, line + 1)
                line += 2
    return spans


def check_main(work: Path, completed: bool) -> tuple[list[bool], bool, list[str]]:
    checks = [False] * 5
    notes: list[str] = []
    if not completed:
        return checks, False, ["main command failed"]
    try:
        rows = read_csv(work / "output/clauses.csv", HEADER)
        missing = read_csv(work / "output/missing.csv", ["contract_id", "clause_type"])
        comparison = (work / "output/comparison.md").read_text(encoding="utf-8")
        parseable = True
    except (OSError, UnicodeError, csv.Error, ValueError) as exc:
        return checks, False, [f"main outputs are not parseable: {exc}"]
    keyed = {(row["contract_id"], row["clause_type"]): row for row in rows}
    expected = expected_main()
    ordinary = {key: row["normalized_value"] for key, row in keyed.items() if key[0].startswith("C")}
    checks[0] = ordinary == expected and len(ordinary) == len(expected)

    ranges_ok = True
    for key, row in keyed.items():
        source_dir = "contracts-late" if key[0].startswith("LATE-") else "contracts"
        source = work / "inputs" / source_dir / f"{key[0]}.txt"
        try:
            physical = source.read_text(encoding="utf-8").splitlines(keepends=True)
            physical = [line.removesuffix("\n") for line in physical]
            start, end = int(row["start_line"]), int(row["end_line"])
            ranges_ok &= 1 <= start <= end <= len(physical) and row["excerpt"] == "\n".join(physical[start - 1:end])
        except (OSError, UnicodeError, ValueError):
            ranges_ok = False
    expected_spans = expected_main_spans()
    actual_spans = {
        key: (int(row["start_line"]), int(row["end_line"]))
        for key, row in keyed.items()
        if key[0].startswith("C")
    }
    checks[1] = ranges_ok and actual_spans == expected_spans

    expected_missing = sorted(
        (
            {"contract_id": f"C{number:03d}", "clause_type": clause}
            for number in range(1, 121)
            for clause, absent in (
                ("auto_renewal", number % 41 == 0),
                ("governing_law", number % 37 == 0),
                ("data_retention_days", number % 29 == 0),
            )
            if absent
        ),
        key=lambda row: (row["contract_id"], row["clause_type"]),
    )
    checks[2] = missing == expected_missing

    review_ids = [f"C{number:03d}" for number in range(1, 19)]
    comparison_folded = comparison.casefold()
    groups_present = (
        all(token in comparison_folded for token in ("12 months", "24 months", "california", "new york", "texas"))
        and ("does not automatically renew" in comparison_folded or "no" in comparison_folded)
        and ("100,000" in comparison_folded or "usd:100000" in comparison_folded)
        and ("6 months" in comparison_folded or "fees_months:6" in comparison_folded)
        and ("250,000" in comparison_folded or "250000" in comparison_folded or "usd:250000" in comparison_folded)
    )
    citations_present = all(re.search(rf"{cid}.*(?:3-4|3–4)", comparison, re.IGNORECASE) for cid in review_ids)
    checks[3] = groups_present and citations_present

    late_expected = {
        ("LATE-001", "auto_renewal"): ("yes", 3, 5),
        ("LATE-001", "termination_notice_days"): ("20", 6, 7),
        ("LATE-001", "governing_law"): ("Washington", 8, 9),
        ("LATE-001", "liability_cap"): ("fees_months:3", 10, 11),
        ("LATE-001", "data_retention_days"): ("14", 12, 13),
        ("LATE-002", "auto_renewal"): ("no", 2, 4),
        ("LATE-003", "liability_cap"): ("usd:25000", 8, 9),
    }
    checks[4] = all(
        key in keyed and (
            keyed[key]["normalized_value"], int(keyed[key]["start_line"]), int(keyed[key]["end_line"])
        ) == value
        for key, value in late_expected.items()
    )
    for number, passed in enumerate(checks, 1):
        if not passed:
            notes.append(f"main semantic check {number} failed")
    return checks, parseable, notes


def check_edge(work: Path, completed: bool) -> tuple[bool, str]:
    if not completed:
        return False, "edge command failed"
    try:
        rows = read_csv(work / "output/clauses.csv", HEADER)
        row = next(row for row in rows if row["contract_id"] == "E-LATE" and row["clause_type"] == "auto_renewal")
        passed = (
            row["normalized_value"] == "yes"
            and row["start_line"] == "3" and row["end_line"] == "5"
            and row["excerpt"] == "AUTOMATIC\nRENEWAL\nThis Agreement renews for 18 months."
        )
        return passed, "" if passed else "wrapped-heading edge failed"
    except (OSError, UnicodeError, csv.Error, ValueError, StopIteration):
        return False, "wrapped-heading edge outputs missing"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "solution/clause_index.py").is_file()
    main_work, main_holder, main_done, detail = prepare(candidate, "main")
    try:
        checks, parseable, notes = check_main(main_work, main_done)
        if detail and not main_done:
            notes.append(detail)
    finally:
        main_holder.cleanup()
    edge_work, edge_holder, edge_done, _ = prepare(candidate, "edge")
    try:
        edge, edge_note = check_edge(edge_work, edge_done)
        if edge_note:
            notes.append(edge_note)
    finally:
        edge_holder.cleanup()
    passed = sum(checks)
    if passed == 5 and edge:
        level = 5
    elif passed == 5:
        level = 4
    elif passed:
        level = 3
    elif parseable:
        level = 2
    elif artifact:
        level = 1
    else:
        level = 0
    print(json.dumps({
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": 5,
        "edge_check_passed": edge,
        "notes": notes,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
