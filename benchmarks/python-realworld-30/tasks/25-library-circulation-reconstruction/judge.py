#!/usr/bin/env python3.12
import argparse,csv,json,shutil,subprocess,tempfile
from collections import defaultdict
from datetime import date,datetime,timedelta,timezone
from decimal import Decimal,ROUND_HALF_UP
from pathlib import Path
from zoneinfo import ZoneInfo
PY="/usr/bin/python3.12";HERE=Path(__file__).resolve().parent;CAP=3000;CENT=Decimal(".01")
ACTIVE="item_id,patron_id,due_date,status,accrued_fine,lost_fee".split(",");FINES="patron_id,overdue_fines,lost_fees,waived,total_balance".split(",");EFFECT="patron_id,old_balance,new_balance,balance_delta,old_active_items,new_active_items".split(",")
def rows(p):
 with p.open(newline="",encoding="utf8") as f:return list(csv.DictReader(f))
def head(p):
 with p.open(newline="",encoding="utf8") as f:return next(csv.reader(f),[])
def money(x):return f"{x.quantize(CENT,rounding=ROUND_HALF_UP):.2f}"
def instant(s):return datetime.fromisoformat(s.replace("Z","+00:00")).astimezone(timezone.utc)
def run(argv,cwd,timeout=90):
 with tempfile.TemporaryFile() as o,tempfile.TemporaryFile() as e:
  try:p=subprocess.run(argv,cwd=cwd,stdout=o,stderr=e,timeout=timeout)
  except (OSError,subprocess.TimeoutExpired) as x:return 124,str(x)[:CAP]
  o.seek(0);e.seek(0);return p.returncode,(o.read(CAP)+e.read(CAP)).decode("utf8","replace")
def copy(src,dst):
 for p in sorted(src.rglob("*")):
  if p.name=="_generate.py":continue
  q=dst/p.relative_to(src)
  if p.is_dir():q.mkdir(parents=True,exist_ok=True)
  elif p.is_file():q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
def fresh(candidate,fixture):
 h=Path(tempfile.mkdtemp(prefix=f"pcbench-25-{fixture}-"));w=h/"workspace";code,d=run([PY,"-E","-S",str(HERE/"seed.py"),"--workspace",str(w),"--fixture",fixture],HERE)
 if code:return h,code,d
 for rel in (Path("solution/__init__.py"),Path("solution/library_state.py")):
  src=candidate/rel
  if src.is_file():dst=w/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
 s=HERE/"stages/corrections";p=h/"payload-corrections";p.mkdir();copy(s,p);code,d=run([PY,"-E","-S",str(s/"_generate.py"),"--output",str(p),"--fixture",fixture],s)
 if code:return h,code,d
 copy(p,w)
 return h,*run([PY,"-E","-S","-m","solution.library_state","inputs","--as-of","2025-08-31T23:59:59Z","--output","output"],w,120)
def load_transactions(inp,corrected):
 tx=rows(inp/"transactions.csv")
 if corrected and (inp/"corrections.csv").exists():
  by={r["transaction_id"]:r for r in tx}
  for c in rows(inp/"corrections.csv"):
   by.pop(c["void_transaction_id"],None)
   if c["action"]=="replace":by[c["transaction_id"]]={k:c[k] for k in ["transaction_id","item_id","patron_id","kind","timestamp","due_date","amount"]}
  tx=list(by.values())
 return tx
def reconstruct(inp,asof,corrected):
 patrons={r["patron_id"]:r for r in rows(inp/"patrons.csv")};catalog={r["item_id"]:r for r in rows(inp/"catalog.csv")};tot=defaultdict(lambda:{"overdue":Decimal(0),"lost":Decimal(0),"waived":Decimal(0)});loans={};limit=instant(asof)
 tx=[r for r in load_transactions(inp,corrected) if instant(r["timestamp"])<=limit];tx.sort(key=lambda r:(instant(r["timestamp"]),r["transaction_id"]))
 def balance(pid):return max(Decimal(0),tot[pid]["overdue"]+tot[pid]["lost"]-tot[pid]["waived"])
 def accrue(loan,through):
  if through<=loan["through"]:return
  start=max(loan["through"]+timedelta(days=1),loan["due"]+timedelta(days=1));days=max(0,(through-start).days+1);cat=catalog[loan["item"]];room=Decimal(cat["fine_cap"])-loan["fine"];charge=min(room,Decimal(days)*Decimal(cat["daily_fine"]))
  if charge>0:loan["fine"]+=charge;tot[loan["patron"]]["overdue"]+=charge
  loan["through"]=through
 for r in tx:
  pid=r["patron_id"];item=r["item_id"];kind=r["kind"];event=instant(r["timestamp"]);loan=loans.get(item)
  if kind=="waive-fine":tot[pid]["waived"]+=min(balance(pid),Decimal(r["amount"] or "0"));continue
  if loan:
   localday=event.astimezone(ZoneInfo(patrons[loan["patron"]]["timezone"])).date();accrue(loan,localday-timedelta(days=1))
  if kind=="checkout":
   due=date.fromisoformat(r["due_date"]);loans[item]={"item":item,"patron":pid,"due":due,"through":due,"fine":Decimal(0),"lost":False}
  elif loan and loan["patron"]==pid:
   if kind=="renew":loan["due"]=date.fromisoformat(r["due_date"]);loan["through"]=max(loan["through"],loan["due"])
   elif kind=="return":loans.pop(item)
   elif kind=="mark-lost" and not loan["lost"]:loan["lost"]=True;tot[pid]["lost"]+=Decimal(catalog[item]["lost_fee"])
   elif kind=="restore" and loan["lost"]:loan["lost"]=False;tot[pid]["lost"]-=Decimal(catalog[item]["lost_fee"])
 for loan in loans.values():
  localday=limit.astimezone(ZoneInfo(patrons[loan["patron"]]["timezone"])).date();accrue(loan,localday)
 active=[];active_by=defaultdict(list)
 for item,loan in sorted(loans.items()):
  active_by[loan["patron"]].append(item);active.append({"item_id":item,"patron_id":loan["patron"],"due_date":loan["due"].isoformat(),"status":"lost" if loan["lost"] else "on_loan","accrued_fine":money(loan["fine"]),"lost_fee":money(Decimal(catalog[item]["lost_fee"]) if loan["lost"] else Decimal(0))})
 fines=[]
 for pid in sorted(patrons):
  v=tot[pid];fines.append({"patron_id":pid,"overdue_fines":money(v["overdue"]),"lost_fees":money(v["lost"]),"waived":money(v["waived"]),"total_balance":money(balance(pid))})
 return patrons,active,fines,active_by
def effects(inp,asof):
 _,oa,of,oby=reconstruct(inp,asof,False);_,na,nf,nby=reconstruct(inp,asof,True);om={r["patron_id"]:r for r in of};nm={r["patron_id"]:r for r in nf};out=[]
 for pid in sorted(om):
  old=";".join(sorted(oby[pid]));new=";".join(sorted(nby[pid]));a=Decimal(om[pid]["total_balance"]);b=Decimal(nm[pid]["total_balance"])
  if a!=b or old!=new:out.append({"patron_id":pid,"old_balance":money(a),"new_balance":money(b),"balance_delta":money(b-a),"old_active_items":old,"new_active_items":new})
 return out
def notice(patron,asof,items,fine):
 return f'''Library account notice\nPatron: {patron["patron_id"]}\nName: {patron["name"]}\nAs of: {asof}\nActive loans: {len(items)}\nItems: {", ".join(sorted(items)) if items else "none"}\nOverdue fines: {fine["overdue_fines"]}\nLost fees: {fine["lost_fees"]}\nWaived: {fine["waived"]}\nBalance: {fine["total_balance"]}\n'''
def maincheck(candidate):
 h,code,d=fresh(candidate,"main");asof="2025-08-31T23:59:59Z"
 try:
  out=h/"workspace/output";struct=code==0 and all((out/n).is_file() for n in ("active_loans.csv","fines.csv","correction_effects.csv")) and (out/"notices").is_dir()
  if not struct:return [False]*5,code==0,False,d
  try:
   ga=rows(out/"active_loans.csv");gf=rows(out/"fines.csv");ge=rows(out/"correction_effects.csv");parsed=head(out/"active_loans.csv")==ACTIVE and head(out/"fines.csv")==FINES and head(out/"correction_effects.csv")==EFFECT
   patrons,ea,ef,eby=reconstruct(h/"workspace/inputs",asof,True);ee=effects(h/"workspace/inputs",asof);fm={r["patron_id"]:r for r in gf};am={r["item_id"]:r for r in ga}
  except (OSError,UnicodeError,csv.Error,KeyError,ValueError):return [False]*5,True,False,d
  check1=fm.get("P001",{}).get("total_balance")=="10.00" and am.get("A001",{}).get("due_date")=="2025-08-10" and am.get("A001",{}).get("accrued_fine")=="10.00"
  check2=am.get("A003",{}).get("status")=="on_loan" and am.get("A003",{}).get("due_date")=="2025-09-15" and "A002" not in am and "A004" not in am and am.get("A005",{}).get("accrued_fine")=="0.00"
  check3=parsed and ga==ea and gf==ef and fm.get("P002",{}).get("total_balance")=="3.00" and fm.get("P004",{}).get("waived")=="2.50"
  nfiles=sorted(p.name for p in (out/"notices").glob("*.txt"));expected_names=[pid+".txt" for pid in sorted(patrons)];fine_map={r["patron_id"]:r for r in ef}
  check4=nfiles==expected_names and all((out/"notices"/(pid+".txt")).read_text(encoding="utf8")==notice(patrons[pid],asof,eby[pid],fine_map[pid]) for pid in patrons)
  check5=ge==ee and [r["patron_id"] for r in ge]==["P001","P003"] and ge[0]["old_active_items"]=="" and ge[0]["new_active_items"]=="A001"
  return [check1,check2,check3,check4,check5],True,parsed,d
 finally:shutil.rmtree(h,ignore_errors=True)
def edgecheck(candidate):
 h,code,d=fresh(candidate,"edge")
 try:
  if code:return False,d
  try:
   a=rows(h/"workspace/output/active_loans.csv");f=rows(h/"workspace/output/fines.csv");e=rows(h/"workspace/output/correction_effects.csv")
   return a==[] and f==[{"patron_id":"P-EDGE","overdue_fines":"1.00","lost_fees":"0.00","waived":"0.00","total_balance":"1.00"}] and e==[],d
  except (OSError,UnicodeError,csv.Error,KeyError):return False,d
 finally:shutil.rmtree(h,ignore_errors=True)
def main():
 p=argparse.ArgumentParser();p.add_argument("--workspace",required=True,type=Path);a=p.parse_args();artifact=(a.workspace/"solution/library_state.py").is_file()
 if not artifact:r={"status":"fail","progress_level":0,"main_checks_passed":0,"main_checks_total":5,"edge_check_passed":False,"notes":[]}
 else:
  notes=[]
  try:checks,runnable,parsed,d=maincheck(a.workspace)
  except Exception as exc:checks,runnable,parsed,d=[False]*5,True,False,"malformed main output: "+str(exc)[:500]
  try:edge,ed=edgecheck(a.workspace)
  except Exception as exc:edge,ed=False,"malformed edge output: "+str(exc)[:500]
  n=sum(checks);level=5 if n==5 and edge else 4 if n==5 else 3 if n else 2 if parsed else 1 if runnable else 0
  if d:notes.append("main candidate diagnostic: "+d[:500])
  if ed:notes.append("edge candidate diagnostic: "+ed[:500])
  r={"status":"pass" if level==5 else "fail","progress_level":level,"main_checks_passed":n,"main_checks_total":5,"edge_check_passed":edge,"notes":notes[:2]}
 print(json.dumps(r,sort_keys=True))
if __name__=="__main__":main()
