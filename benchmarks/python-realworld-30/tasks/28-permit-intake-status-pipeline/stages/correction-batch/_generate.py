#!/usr/bin/env python3.12
import argparse,csv,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("--output",type=Path,required=True);p.add_argument("--fixture",required=True);a=p.parse_args()
d=a.output/"inputs"/"correction_batch";d.mkdir(parents=True,exist_ok=True)
corrections=[] if a.fixture=="edge" else [{"source_id":"APP-0002","revision":2,"owner_id":"OWN-0002"}]
links=[["source_id_a","source_id_b"]] if a.fixture=="edge" else [["source_id_a","source_id_b"],["APP-0009","APP-0010"]]
(d/"owner_corrections.json").write_text(json.dumps({"corrections":corrections},indent=2)+"\n",encoding="utf-8")
with (d/"duplicate_links.csv").open("w",encoding="utf-8",newline="") as f:csv.writer(f,lineterminator="\n").writerows(links)
