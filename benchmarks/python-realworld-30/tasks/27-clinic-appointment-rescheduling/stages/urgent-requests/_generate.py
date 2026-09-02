#!/usr/bin/env python3.12
import argparse, csv
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument("--output",type=Path,required=True)
p.add_argument("--fixture",choices=("main","edge"),required=True)
a=p.parse_args()
t=a.output/"inputs"/"urgent_requests.csv"
t.parent.mkdir(parents=True,exist_ok=True)
header=["appointment_id","patient_id","type_id","site_id","window_start","window_end","priority","preferred_provider_id"]
if a.fixture=="main":
    rows=[
      ["U001","URG-0001","CONSULT","NORTH","2025-09-15T10:00","2025-09-15T10:30",10,"P002"],
      ["U002","URG-0002","CONSULT","NORTH","2025-09-15T11:00","2025-09-15T11:30",9,"P002"],
    ]
else:
    rows=[["EU001","EDGE-URG","CONSULT","NORTH","2025-09-15T10:00","2025-09-15T10:30",10,"P001"]]
with t.open("w",encoding="utf-8",newline="") as f:
    csv.writer(f,lineterminator="\n").writerows([header,*rows])
