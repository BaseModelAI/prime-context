#!/usr/bin/env python3
"""Generate the Task 17 initial contracts outside the candidate workspace."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import random
import string

SEED = 20260831 + 17
ALIASES = {
    "auto_renewal": ["AUTOMATIC RENEWAL", "RENEWAL TERM"],
    "termination_notice_days": ["TERMINATION NOTICE", "NOTICE OF TERMINATION"],
    "governing_law": ["GOVERNING LAW", "CHOICE OF LAW"],
    "liability_cap": ["LIMITATION OF LIABILITY", "LIABILITY CAP"],
    "data_retention_days": ["DATA RETENTION", "RETENTION OF DATA"],
}


def clause_lines(index: int) -> list[str]:
    renewal = (
        ["AUTOMATIC RENEWAL", "This Agreement renews for 12 months."]
        if index % 3 == 1
        else ["RENEWAL TERM", "This Agreement does not automatically renew."]
        if index % 3 == 2
        else ["AUTOMATIC RENEWAL", "This Agreement renews for 24 months."]
    )
    notice = ["TERMINATION NOTICE", f"Either party may give notice at least {(30, 60, 45)[(index - 1) % 3]} days before termination."]
    law = ["GOVERNING LAW", f"This Agreement is governed by the laws of {('California', 'New York', 'Texas')[(index - 1) % 3]}."]
    liability = (
        ["LIMITATION OF LIABILITY", "Aggregate liability will not exceed $100,000."]
        if index % 3 == 1
        else ["LIABILITY CAP", "Liability is limited to 6 months of fees."]
        if index % 3 == 2
        else ["LIMITATION OF LIABILITY", "Aggregate liability will not exceed $250000."]
    )
    retention = ["DATA RETENTION", f"The processor will retain customer data for {(45, 30, 90)[(index - 1) % 3]} days after closure."]
    sections = []
    if index % 41:
        sections += renewal
    sections += notice
    if index % 37:
        sections += law
    sections += liability
    if index % 29:
        sections += retention
    return sections


def write_contract(path: Path, index: int, filler: list[str]) -> None:
    lines = [f"VENDOR AGREEMENT C{index:03d}", "Stable-line source copy.", *clause_lines(index), "\f"]
    lines.extend(f"ARCHIVE {index:03d} {line}" for line in filler)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def generate(output: Path, fixture: str) -> None:
    inputs = output / "inputs"
    contracts = inputs / "contracts"
    contracts.mkdir(parents=True, exist_ok=True)
    (inputs / "clause_aliases.json").write_text(json.dumps(ALIASES, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if fixture == "edge":
        (contracts / "E001.txt").write_text(
            "EDGE AGREEMENT\nAUTOMATIC RENEWAL\nThis Agreement renews for 12 months.\n"
            "TERMINATION NOTICE\nNotice must be given 30 days before termination.\n"
            "GOVERNING LAW\nGoverned by the laws of Oregon.\n"
            "LIMITATION OF LIABILITY\nLiability is limited to $5000.\n"
            "DATA RETENTION\nRetain records for 10 days.\n",
            encoding="utf-8",
        )
        return
    rng = random.Random(SEED)
    alphabet = string.ascii_letters + string.digits + "     -_"
    filler = ["".join(rng.choice(alphabet) for _ in range(1024)) for _ in range(220)]
    for index in range(1, 121):
        write_contract(contracts / f"C{index:03d}.txt", index, filler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    generate(args.output.resolve(), args.fixture)
