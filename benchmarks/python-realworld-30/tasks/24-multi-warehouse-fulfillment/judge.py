#!/usr/bin/env python3.12
import argparse,csv,itertools,json,shutil,subprocess,tempfile
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
PY="/usr/bin/python3.12";HERE=Path(__file__).resolve().parent;CAP=3000
ALLOC="order_id,line_id,warehouse_id,quantity,status".split(",");BACK="order_id,line_id,sku,requested_qty,allocated_qty,backorder_qty".split(",");INV="warehouse_id,sku,on_hand,allocated_qty,remaining_qty".split(",");CHANGE="stage,order_id,line_id,warehouse_id,status,before_qty,after_qty,delta_qty".split(",")
def rows(p):
 with p.open(newline="",encoding="utf8") as f:return list(csv.DictReader(f))
def head(p):
 with p.open(newline="",encoding="utf8") as f:return next(csv.reader(f),[])
def run(argv,cwd,timeout=45):
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
 h=Path(tempfile.mkdtemp(prefix=f"pcbench-24-{fixture}-"));w=h/"workspace";code,d=run([PY,"-E","-S",str(HERE/"seed.py"),"--workspace",str(w),"--fixture",fixture],HERE)
 if code:return h,code,d
 for rel in (Path("solution/__init__.py"),Path("solution/fulfill.py")):
  src=candidate/rel
  if src.is_file():dst=w/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
 for n in ("warehouse-outage","expedite"):
  s=HERE/"stages"/n;p=h/("payload-"+n);p.mkdir();copy(s,p);code,d=run([PY,"-E","-S",str(s/"_generate.py"),"--output",str(p),"--fixture",fixture],s)
  if code:return h,code,d
  copy(p,w)
 return h,*run([PY,"-E","-S","-m","solution.fulfill","inputs","--output","output"],w,75)
def data(inp):
 orders={r["order_id"]:r for r in rows(inp/"orders.csv")}; lines=rows(inp/"order_lines.csv");by=defaultdict(list)
 for r in lines:by[r["order_id"]].append(r)
 physical={(r["warehouse_id"],r["sku"]):int(r["on_hand"]) for r in rows(inp/"inventory.csv")};ship={r["warehouse_id"]:(Decimal(r["base_cost"]),Decimal(r["per_unit_cost"])) for r in rows(inp/"shipping_cost.csv")};existing=rows(inp/"existing_allocations.csv")
 return orders,lines,by,physical,ship,existing
def aggregate(rs):
 d=defaultdict(int)
 for r in rs:d[(r["order_id"],r["line_id"],r["warehouse_id"],r["status"])]+=int(r["quantity"])
 return d
def plan(inp,preserved,disabled=None,urgent=()):
 orders,lines,by,physical,ship,_=data(inp);wh=sorted(ship);alloc=aggregate(preserved);avail=physical.copy();sku={(r["order_id"],r["line_id"]):r["sku"] for r in lines}
 for (oid,lid,w,status),q in alloc.items():avail[w,sku[oid,lid]]-=q
 rank={"urgent":0,"high":1,"normal":2};urgent=set(urgent)
 ordered=sorted(orders,key=lambda o:(0 if o in urgent else rank[orders[o]["priority"]],orders[o]["due_date"],o))
 for oid in ordered:
  wanted={r["line_id"]:int(r["requested_qty"]) for r in by[oid]};filled=defaultdict(int);used=set();baseqty=defaultdict(int)
  for (o,l,w,s),q in alloc.items():
   if o==oid:filled[l]+=q;used.add(w);baseqty[w]+=q
  rem={l:max(0,q-filled[l]) for l,q in wanted.items()}
  if not any(rem.values()):continue
  allowed=[w for w in wh if w!=disabled];candidates=[]
  for size in range(0,4):
   for subset in itertools.combinations(allowed,size):
    if len(used|set(subset))>3:continue
    take={};actual=set(used);total=0;complete=0;perwh=baseqty.copy()
    for r in by[oid]:
     lid=r["line_id"];need=rem[lid];left=need
     for w in sorted(subset,key=lambda x:(ship[x][1],x)):
      q=min(left,avail.get((w,r["sku"]),0))
      if q:take[lid,w]=q;left-=q;actual.add(w);perwh[w]+=q
     total+=need-left;complete+=left==0
    cost=sum(ship[w][0]+ship[w][1]*perwh[w] for w in actual);full=complete==len(rem)
    if full:key=(0,len(actual),cost,tuple(sorted(actual)))
    elif orders[oid]["allow_partial"]=="true":key=(1,-complete,-total,len(actual),cost,tuple(sorted(actual)))
    else:continue
    candidates.append((full,key,take))
  full=[c for c in candidates if c[0]];pool=full if full else candidates
  if not pool:continue
  _,_,chosen=min(pool,key=lambda c:c[1])
  for (lid,w),q in chosen.items():alloc[oid,lid,w,"reserved"]+=q;avail[w,sku[oid,lid]]-=q
 out=[dict(zip(ALLOC,[*k[:3],str(q),k[3]])) for k,q in sorted(alloc.items()) if q>0]
 back=[]
 totals=defaultdict(int)
 for (o,l,w,s),q in alloc.items():totals[o,l]+=q
 for r in sorted(lines,key=lambda x:(x["order_id"],x["line_id"])):
  req=int(r["requested_qty"]);got=totals[r["order_id"],r["line_id"]]
  if got<req:back.append(dict(zip(BACK,[r["order_id"],r["line_id"],r["sku"],str(req),str(got),str(req-got)])))
 usedstock=defaultdict(int)
 for (o,l,w,s),q in alloc.items():usedstock[w,sku[o,l]]+=q
 inventory=[dict(zip(INV,[w,s,str(q),str(usedstock[w,s]),str(q-usedstock[w,s])])) for (w,s),q in sorted(physical.items())]
 return out,back,inventory
def changes(stage,before,after):
 a=aggregate(before);b=aggregate(after);out=[]
 for k in sorted(set(a)|set(b)):
  if a[k]!=b[k]:out.append(dict(zip(CHANGE,[stage,*k,str(a[k]),str(b[k]),str(b[k]-a[k])])))
 return out
def expected(inp):
 *_,existing=data(inp);initial=plan(inp,existing); outage=json.loads((inp/"warehouse_outage.json").read_text())["warehouse_id"]
 keep=[r for r in initial[0] if r["status"]=="shipped" or r["warehouse_id"]!=outage];out=plan(inp,keep,outage);urgent=[r["order_id"] for r in rows(inp/"expedite.csv")];shipped=[r for r in out[0] if r["status"]=="shipped"];final=plan(inp,shipped,outage,urgent)
 return final,changes("warehouse_outage",initial[0],out[0])+changes("expedite",out[0],final[0]),initial,out
def maincheck(candidate):
 h,code,d=fresh(candidate,"main")
 try:
  out=h/"workspace/output";struct=code==0 and all((out/n).is_file() for n in ("allocations.csv","backorders.csv","inventory_after.csv","allocation_changes.csv"))
  if not struct:return [False]*5,code==0,False,d
  try:
   ga=rows(out/"allocations.csv");gb=rows(out/"backorders.csv");gi=rows(out/"inventory_after.csv");gc=rows(out/"allocation_changes.csv");parsed=head(out/"allocations.csv")==ALLOC and head(out/"backorders.csv")==BACK and head(out/"inventory_after.csv")==INV and head(out/"allocation_changes.csv")==CHANGE
   final,ec,initial,outage=expected(h/"workspace/inputs");ea,eb,ei=final;am={(r["order_id"],r["line_id"],r["warehouse_id"],r["status"]):r for r in ga};bm={(r["order_id"],r["line_id"]):r for r in gb}
  except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,KeyError,ValueError):return [False]*5,True,False,d
  check1=any(r["order_id"]=="O0499" and r["warehouse_id"]=="W-A" and r["quantity"]=="6" for r in ga) and bm.get(("O0010","L01"),{}).get("backorder_qty")=="6" and any(r["order_id"]=="O0500" and r["warehouse_id"]=="W-C" and r["quantity"]=="7" for r in ga)
  check2=am.get(("O0001","L01","W-A","reserved"),{}).get("quantity")=="9" and ("O0002","L01") in bm and ("O0002","L02") in bm and ("O0006","L01") in bm
  # Whole-fixture conservation and no line over-allocation.
  orders,lines,by,physical,ship,existing=data(h/"workspace/inputs");requested={(r["order_id"],r["line_id"]):int(r["requested_qty"]) for r in lines};byline=defaultdict(int);bystock=defaultdict(int);sk={(r["order_id"],r["line_id"]):r["sku"] for r in lines}
  valid=True
  for r in ga:
   q=int(r["quantity"]);byline[r["order_id"],r["line_id"]]+=q;bystock[r["warehouse_id"],sk[r["order_id"],r["line_id"]]]+=q
  valid=all(q<=requested[k] for k,q in byline.items()) and all(q<=physical[k] for k,q in bystock.items())
  check3=valid and gi==ei
  outage_changes=[r for r in gc if r["stage"]=="warehouse_outage"];expected_outage=[r for r in ec if r["stage"]=="warehouse_outage"]
  check4=outage_changes==expected_outage and am.get(("O0003","L01","W-B","shipped"),{}).get("quantity")=="4" and not any(r["warehouse_id"]=="W-B" and r["status"]=="reserved" for r in ga)
  check5=parsed and ga==ea and gb==eb and gc==ec
  return [check1,check2,check3,check4,check5],True,parsed,d
 finally:shutil.rmtree(h,ignore_errors=True)
def edgecheck(candidate):
 h,code,d=fresh(candidate,"edge")
 try:
  if code:return False,d
  try:
   a=rows(h/"workspace/output/allocations.csv");b=rows(h/"workspace/output/backorders.csv");i=rows(h/"workspace/output/inventory_after.csv")
   return a==[] and b==[{"order_id":"E0001","line_id":"L01","sku":"EDGE001","requested_qty":"5","allocated_qty":"0","backorder_qty":"5"}] and all(r["remaining_qty"]==r["on_hand"] for r in i),d
  except (OSError,UnicodeError,csv.Error,KeyError):return False,d
 finally:shutil.rmtree(h,ignore_errors=True)
def main():
 p=argparse.ArgumentParser();p.add_argument("--workspace",required=True,type=Path);a=p.parse_args();artifact=(a.workspace/"solution/fulfill.py").is_file()
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
