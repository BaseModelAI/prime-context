#!/usr/bin/env python3
"""Generate Task 08 updates and alternatives."""
from __future__ import annotations
import argparse, csv, json
from pathlib import Path
FIELDS=["alternative_id","replaces_segment_id","start_local","end_local","start_timezone","end_timezone","origin","destination","price"]

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--output",required=True,type=Path); parser.add_argument("--fixture",required=True,choices=("main","edge")); args=parser.parse_args()
    inputs=args.output/"inputs"; inputs.mkdir(parents=True,exist_ok=True)
    if args.fixture=="main":
        updates=[{"segment_id":"F2","revision":2,"start_local":"2025-03-02T10:20"},{"segment_id":"F2","revision":3,"start_local":"2025-03-02T10:15"},{"segment_id":"A1","revision":2,"status":"cancelled"}]
        alternatives=[
          ["ALT-A","F2","2025-03-02T10:20","2025-03-02T13:40","Europe/London","America/New_York","LHR","JFK","180.00"],
          ["ALT-B","F2","2025-03-02T10:50","2025-03-02T14:00","Europe/London","America/New_York","LHR","JFK","190.00"],
          ["ALT-C","F2","2025-03-02T11:00","2025-03-02T13:50","Europe/London","America/New_York","LHR","JFK","220.00"],
          ["ALT-D","F2","2025-03-02T11:00","2025-03-02T13:50","Europe/London","America/New_York","LHR","JFK","220.00"]]
    else: updates=[]; alternatives=[]
    (inputs/"updates.json").write_text(json.dumps(updates,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    with (inputs/"alternatives.csv").open("w",encoding="utf-8",newline="") as h:
        w=csv.writer(h,lineterminator="\n"); w.writerow(FIELDS); w.writerows(alternatives)

if __name__=="__main__": main()
