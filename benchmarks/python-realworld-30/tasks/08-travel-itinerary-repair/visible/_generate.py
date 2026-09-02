#!/usr/bin/env python3
"""Generate Task 08 initial inputs."""
from __future__ import annotations
import argparse, csv, json, random
from pathlib import Path
SEED=20260831+8

def seg(sid,kind,revision,start,end,start_tz,end_tz,origin,destination,booking):
    return {"segment_id":sid,"type":kind,"revision":revision,"start_local":start,"end_local":end,"start_timezone":start_tz,"end_timezone":end_tz,"origin":origin,"destination":destination,"booking_ref":booking}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--output",required=True,type=Path); parser.add_argument("--fixture",required=True,choices=("main","edge")); args=parser.parse_args()
    random.Random(SEED).getstate(); inputs=args.output/"inputs"; inputs.mkdir(parents=True,exist_ok=True)
    if args.fixture=="edge":
        segments=[
          seg("H-EDGE","hotel",1,"2025-03-01T18:00","2025-03-02T08:00","Europe/London","Europe/London","LON","LON","HOT-EDGE"),
          seg("T-EDGE","train",1,"2025-03-02T08:00","2025-03-02T09:00","Europe/London","Europe/London","LON","MAN","RAIL-EDGE")]
        itinerary={"trip_start_date":"2025-03-01","trip_end_date":"2025-03-02","segments":segments}
    else:
        segments=[
          seg("A1","activity",1,"2025-03-01T09:00","2025-03-01T10:00","Europe/London","Europe/London","LON","LON","ACT-1"),
          seg("H1","hotel",1,"2025-03-01T18:00","2025-03-02T08:00","Europe/Paris","Europe/Paris","PAR","PAR","HOT-1"),
          seg("F1","flight",1,"2025-03-02T09:00","2025-03-02T10:00","Europe/Paris","Europe/London","CDG","LHR","FLT-1"),
          seg("F2","flight",1,"2025-03-02T11:00","2025-03-02T14:00","Europe/London","America/New_York","LHR","JFK","FLT-2"),
          seg("H2","hotel",1,"2025-03-02T18:00","2025-03-03T08:00","America/New_York","America/New_York","NYC","NYC","HOT-2"),
          seg("T3","train",1,"2025-03-03T09:00","2025-03-03T11:00","America/New_York","America/New_York","NYP","BOS","RAIL-3"),
          seg("A2","activity",1,"2025-03-03T12:00","2025-03-03T13:00","America/New_York","America/New_York","BOS","BOS","DUP-77"),
          seg("A3","activity",1,"2025-03-03T13:00","2025-03-03T14:00","America/New_York","America/New_York","BOS","BOS","DUP-77"),
          seg("H3","hotel",1,"2025-03-03T18:00","2025-03-04T08:00","America/New_York","America/New_York","BOS","BOS","HOT-3")]
        itinerary={"trip_start_date":"2025-03-01","trip_end_date":"2025-03-04","segments":segments}
    (inputs/"itinerary.json").write_text(json.dumps(itinerary,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    (inputs/"connection_rules.json").write_text(json.dumps({"airport_change_minutes":90,"minimum_connection_minutes":{"flight>flight":45,"flight>train":30,"train>flight":40,"train>train":20}},indent=2,sort_keys=True)+"\n",encoding="utf-8")
    with (inputs/"airports.csv").open("w",encoding="utf-8",newline="") as h:
        w=csv.writer(h,lineterminator="\n"); w.writerow(["code","timezone","city"]); w.writerows([["CDG","Europe/Paris","Paris"],["LHR","Europe/London","London"],["JFK","America/New_York","New York"],["NYP","America/New_York","New York"],["BOS","America/New_York","Boston"],["LON","Europe/London","London"],["MAN","Europe/London","Manchester"],["NYC","America/New_York","New York"],["PAR","Europe/Paris","Paris"]])

if __name__=="__main__": main()
