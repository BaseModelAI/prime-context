#!/usr/bin/env python3.12
import argparse, json
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument("--output",type=Path,required=True)
p.add_argument("--fixture",choices=("main","edge"),required=True)
a=p.parse_args()
t=a.output/"inputs"/"provider_absence.json"
t.parent.mkdir(parents=True,exist_ok=True)
if a.fixture=="main":
    data={"provider_id":"P001","start":"2025-09-15T09:00","end":"2025-09-15T10:00"}
else:
    data={"provider_id":"P009","start":"2025-09-15T09:00","end":"2025-09-15T10:00"}
t.write_text(json.dumps(data,indent=2,sort_keys=True)+"\n",encoding="utf-8")
