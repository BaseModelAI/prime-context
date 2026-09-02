#!/usr/bin/env python3.12
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument("--output",type=Path,required=True);p.add_argument("--fixture",required=True);a=p.parse_args()
t=a.output/"inputs"/"ordinance_update.json";t.parent.mkdir(parents=True,exist_ok=True)
data={"effective_date":"2025-06-01","document_requirements":{"residential":["ENERGY","PLAN"]},"fees":{"residential":"125.00"}}
t.write_text(json.dumps(data,indent=2,sort_keys=True)+"\n",encoding="utf-8")
