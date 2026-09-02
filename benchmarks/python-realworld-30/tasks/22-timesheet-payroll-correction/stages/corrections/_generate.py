#!/usr/bin/env python3
import argparse
import csv
import random
from pathlib import Path
SEED = 20260831 + 22

def main(output, fixture):
    (output / "stage.json").unlink(missing_ok=True)
    random.Random(SEED)
    inputs = output / "inputs"
    inputs.mkdir(parents=True, exist_ok=True)
    with (inputs / "punch_corrections.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["action", "record_id", "employee_id", "shift_id", "kind", "timestamp"])
        if fixture == "main":
            w.writerow(["replace", "R0010", "E1", "E1-7", "OUT", "2025-11-07T17:00:00-05:00"])
if __name__ == "__main__":
    p=argparse.ArgumentParser(); p.add_argument("--output",required=True,type=Path); p.add_argument("--fixture",required=True,choices=("main","edge")); a=p.parse_args(); main(a.output.resolve(),a.fixture)
