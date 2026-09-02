#!/usr/bin/env python3.12
import argparse,csv,random
from pathlib import Path
SEED=20260831+25
HEAD=["action","void_transaction_id","transaction_id","item_id","patron_id","kind","timestamp","due_date","amount"]
def main(output,fixture):
 (output / "stage.json").unlink(missing_ok=True)
 random.Random(SEED);p=output/"inputs/corrections.csv";p.parent.mkdir(parents=True,exist_ok=True)
 with p.open("w",newline="",encoding="utf8") as f:
  w=csv.writer(f,lineterminator="\n");w.writerow(HEAD)
  if fixture=="main":
   w.writerow(["void","T-A3","","","","","","",""])
   w.writerow(["replace","T-C2","T-C2R","A003","P003","renew","2025-08-25T09:00:00Z","2025-09-15",""])
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--output",required=True,type=Path);p.add_argument("--fixture",required=True,choices=("main","edge"));a=p.parse_args();main(a.output.resolve(),a.fixture)
