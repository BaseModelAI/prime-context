#!/usr/bin/env python3.12
import argparse, csv
from pathlib import Path

def main():
    p=argparse.ArgumentParser(); p.add_argument("--output",type=Path,required=True); p.add_argument("--fixture",choices=("main","edge"),required=True); a=p.parse_args()
    target=a.output/"inputs"/"splits.csv"; target.parent.mkdir(parents=True,exist_ok=True)
    rent2="-200.00" if a.fixture=="main" else "-199.99"
    rows=[
      ["source_account","source_id","part","category","amount"],
      ["checking-001","a-rent","1","Housing","-1000.00"],
      ["checking-001","a-rent","2","Home Office",rent2],
      ["savings-01","b-util","1","Utilities","-80.00"],
      ["savings-01","b-util","2","Internet","-40.00"],
    ]
    with target.open("w",encoding="utf-8",newline="") as f: csv.writer(f,lineterminator="\n").writerows(rows)
if __name__=="__main__": main()
