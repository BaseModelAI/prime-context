#!/usr/bin/env python3
import argparse
import json
import random
from pathlib import Path
SEED = 20260831 + 22

def main(output, fixture):
    (output / "stage.json").unlink(missing_ok=True)
    random.Random(SEED)
    inputs=output / "inputs"; inputs.mkdir(parents=True,exist_ok=True)
    rules={"group":"U","daily_overtime_after_hours":"8","daily_doubletime_after_hours":"12","overtime_multiplier":"1.5","doubletime_multiplier":"2","weekly_overtime":False}
    (inputs / "union_rules.json").write_text(json.dumps(rules,indent=2)+"\n")
if __name__ == "__main__":
    p=argparse.ArgumentParser(); p.add_argument("--output",required=True,type=Path); p.add_argument("--fixture",required=True,choices=("main","edge")); a=p.parse_args(); main(a.output.resolve(),a.fixture)
