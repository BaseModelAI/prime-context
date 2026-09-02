#!/usr/bin/env python3.12
import argparse, json
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument("--output",type=Path,required=True)
p.add_argument("--fixture",choices=("main","edge"),required=True)
a=p.parse_args()
t=a.output/"inputs"/"equipment_outage.json"
t.parent.mkdir(parents=True,exist_ok=True)
data={"room_id":"N-IMG-1","equipment_id":"XRAY"}
t.write_text(json.dumps(data,indent=2,sort_keys=True)+"\n",encoding="utf-8")
