#!/usr/bin/env python3.12
import argparse,csv,random,shutil
from datetime import datetime,timedelta,timezone
from pathlib import Path
SEED=20260831+25; TOTAL=300_000
PATRON_HEAD=["patron_id","name","timezone","email"]
CAT_HEAD=["item_id","title","daily_fine","lost_fee","fine_cap"]
TX_HEAD=["transaction_id","item_id","patron_id","kind","timestamp","due_date","amount"]
def write(path,head,rows):
 with path.open("w",newline="",encoding="utf8") as f:w=csv.writer(f,lineterminator="\n");w.writerow(head);w.writerows(rows)
def edge(inputs):
 write(inputs/"patrons.csv",PATRON_HEAD,[["P-EDGE","Edge Reader","UTC","edge@example.test"]])
 write(inputs/"catalog.csv",CAT_HEAD,[["EDGE-ITEM","Out of order","1.00","20.00","10.00"]])
 # File order is intentionally the reverse of event time.
 write(inputs/"transactions.csv",TX_HEAD,[["EDGE-R","EDGE-ITEM","P-EDGE","return","2025-08-03T12:00:00Z","",""] ,["EDGE-C","EDGE-ITEM","P-EDGE","checkout","2025-08-01T12:00:00Z","2025-08-01",""]])
def main_fixture(inputs):
 rng=random.Random(SEED)
 patrons=[["P001","Alice Anchor","America/New_York","alice@example.test"],["P002","Bob Anchor","UTC","bob@example.test"],["P003","Cara Anchor","Europe/London","cara@example.test"],["P004","Dan Anchor","UTC","dan@example.test"],["P005","Eve Anchor","UTC","eve@example.test"]]
 patrons += [[f"P{n:04d}",f"Reader {n:04d}","UTC",f"reader{n:04d}@example.test"] for n in range(10,310)]
 catalog=[["A001","Renewed Interview","1.00","25.00","10.00"],["A002","Restored Atlas","0.50","30.00","5.00"],["A003","Corrected Catalog","2.00","50.00","8.00"],["A004","Waiver Guide","1.25","20.00","15.00"],["A005","Last Day Loan","0.25","10.00","5.00"]]
 catalog += [[f"F{i:04d}",f"Filler title {i:04d}","0.10","15.00","5.00"] for i in range(1500)]
 tx=[
 ["T-A1","A001","P001","checkout","2025-08-01T14:00:00Z","2025-08-05",""],
 ["T-A2","A001","P001","renew","2025-08-04T14:00:00Z","2025-08-10",""],
 ["T-A3","A001","P001","return","2025-08-14T14:00:00Z","",""],
 ["T-B1","A002","P002","checkout","2025-07-30T12:00:00Z","2025-08-01",""],
 ["T-B2","A002","P002","mark-lost","2025-08-04T12:00:00Z","",""],
 ["T-B3","A002","P002","restore","2025-08-06T12:00:00Z","",""],
 ["T-B4","A002","P002","return","2025-08-08T12:00:00Z","",""],
 ["T-C1","A003","P003","checkout","2025-08-01T09:00:00Z","2025-08-20",""],
 ["T-C2","A003","P003","mark-lost","2025-08-25T09:00:00Z","",""],
 ["T-D1","A004","P004","checkout","2025-07-20T09:00:00Z","2025-07-31",""],
 ["T-D2","A004","P004","return","2025-08-03T09:00:00Z","",""],
 ["T-D3","A004","P004","waive-fine","2025-08-04T09:00:00Z","","5.00"],
 ["T-E0","A005","P005","renew","2025-08-29T08:00:00Z","2025-09-10",""],
 ["T-E1","A005","P005","checkout","2025-08-30T08:00:00Z","2025-08-31",""],
 ]
 pairs=(TOTAL-len(tx))//2;base=datetime(2025,1,1,tzinfo=timezone.utc)
 for i in range(pairs):
  item=f"F{i%1500:04d}";pat=f"P{10+(i%300):04d}";start=base+timedelta(minutes=2*i);due=(start.date()+timedelta(days=14)).isoformat()
  tx.append([f"F{i:06d}C",item,pat,"checkout",start.isoformat().replace("+00:00","Z"),due,""])
  tx.append([f"F{i:06d}R",item,pat,"return",(start+timedelta(minutes=1)).isoformat().replace("+00:00","Z"),"",""])
 assert len(tx)==TOTAL;rng.shuffle(tx)
 write(inputs/"patrons.csv",PATRON_HEAD,patrons);write(inputs/"catalog.csv",CAT_HEAD,catalog);write(inputs/"transactions.csv",TX_HEAD,tx)
def seed(workspace,fixture):
 if workspace.exists():shutil.rmtree(workspace)
 inputs=workspace/"inputs";inputs.mkdir(parents=True);(workspace/"solution").mkdir();(workspace/"output").mkdir()
 edge(inputs) if fixture=="edge" else main_fixture(inputs)
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--workspace",required=True,type=Path);p.add_argument("--fixture",required=True,choices=("main","edge"));a=p.parse_args();seed(a.workspace.resolve(),a.fixture)
