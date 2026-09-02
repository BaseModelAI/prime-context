#!/usr/bin/env python3
"""Generate late contracts, including the documented wrapped heading."""
from __future__ import annotations
import argparse
from pathlib import Path


def generate(output: Path, fixture: str) -> None:
    target = output / "inputs" / "contracts-late"
    target.mkdir(parents=True, exist_ok=True)
    if fixture == "edge":
        text = (
            "EDGE LATE AGREEMENT\nReference copy.\nAUTOMATIC\nRENEWAL\n"
            "This Agreement renews for 18 months.\nTERMINATION NOTICE\nNotice requires 20 days.\n"
            "GOVERNING LAW\nGoverned by the laws of Québec.\nLIABILITY CAP\n"
            "Liability is limited to 3 months of fees.\nDATA RETENTION\nRetain records for 14 days.\n"
        )
        (target / "E-LATE.txt").write_text(text, encoding="utf-8")
        return
    records = {
        "LATE-001.txt": "LATE AGREEMENT ONE\nFiled copy.\nAUTOMATIC\nRENEWAL\nThis Agreement renews for 18 months.\nTERMINATION NOTICE\nNotice requires 20 days.\nGOVERNING LAW\nGoverned by the laws of Washington.\nLIABILITY CAP\nLiability is limited to 3 months of fees.\nDATA RETENTION\nRetain records for 14 days.\n",
        "LATE-002.txt": "LATE AGREEMENT TWO\nRENEWAL\nTERM\nThis Agreement does not automatically renew.\nNOTICE OF TERMINATION\nNotice requires 75 days.\nCHOICE OF LAW\nGoverned by the laws of Illinois.\nLIMITATION OF LIABILITY\nLiability will not exceed $75,000.\nRETENTION OF DATA\nRetain data for 120 days.\n",
        "LATE-003.txt": "LATE AGREEMENT THREE\nAUTOMATIC RENEWAL\nThis Agreement renews for 9 months.\nTERMINATION NOTICE\nNotice requires 15 days.\nGOVERNING LAW\nGoverned by the laws of Nevada.\nLIMITATION OF LIABILITY\nLiability will not exceed $25000.\nDATA RETENTION\nRetain records for 7 days.\n",
    }
    for name, text in records.items():
        (target / name).write_text(text, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixture", required=True, choices=("main", "edge"))
    args = parser.parse_args()
    generate(args.output.resolve(), args.fixture)
