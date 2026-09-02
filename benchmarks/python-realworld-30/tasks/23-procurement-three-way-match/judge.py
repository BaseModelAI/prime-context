#!/usr/bin/env python3.12
import argparse,csv,json,shutil,subprocess,tempfile,xml.etree.ElementTree as ET
from collections import defaultdict
from decimal import Decimal,ROUND_HALF_UP
from pathlib import Path
PY="/usr/bin/python3.12"; HERE=Path(__file__).resolve().parent; CAP=3000; CENT=Decimal(".01")
def money(x):return f"{x.quantize(CENT,rounding=ROUND_HALF_UP):.2f}"
def number(x):
 s=format(x,"f");return s.rstrip("0").rstrip(".") if "." in s else s
def csvrows(path):
 with path.open(newline="",encoding="utf-8") as f:return list(csv.DictReader(f))
def header(path):
 with path.open(newline="",encoding="utf-8") as f:return next(csv.reader(f),[])
def run(argv,cwd,timeout=30):
 with tempfile.TemporaryFile() as out,tempfile.TemporaryFile() as err:
  try:p=subprocess.run(argv,cwd=cwd,stdout=out,stderr=err,timeout=timeout)
  except (OSError,subprocess.TimeoutExpired) as e:return 124,str(e)[:CAP]
  out.seek(0);err.seek(0); text=(out.read(CAP)+err.read(CAP)).decode("utf-8","replace")
  return p.returncode,text
def copytree(src,dst):
 for p in sorted(src.rglob("*")):
  if p.name=="_generate.py":continue
  q=dst/p.relative_to(src)
  if p.is_dir():q.mkdir(parents=True,exist_ok=True)
  elif p.is_file():q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
def fresh(candidate,fixture):
 holder=Path(tempfile.mkdtemp(prefix=f"pcbench-23-{fixture}-")); work=holder/"workspace"
 code,diag=run([PY,"-E","-S",str(HERE/"seed.py"),"--workspace",str(work),"--fixture",fixture],HERE)
 if code:return holder,code,diag
 for rel in (Path("solution/__init__.py"),Path("solution/three_way_match.py")):
  src=candidate/rel
  if src.is_file():dst=work/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
 for name in ("receipt-corrections","credit-notes"):
  stage=HERE/"stages"/name; payload=holder/("payload-"+name);payload.mkdir();copytree(stage,payload)
  gen=stage/"_generate.py"; code,diag=run([PY,"-E","-S",str(gen),"--output",str(payload),"--fixture",fixture],stage)
  if code:return holder,code,diag
  copytree(payload,work)
 return holder,*run([PY,"-E","-S","-m","solution.three_way_match","inputs","--output","output"],work,45)
def expected(inp):
 items={r["item_id"]:Decimal(r["eaches_per_case"]) for r in csvrows(inp/"items.csv")}
 pos=csvrows(inp/"purchase_orders.csv"); rec=json.loads((inp/"goods_receipts.json").read_text())["receipts"]
 if (inp/"receipt_corrections.json").exists():
  by={r["receipt_id"]:r for r in rec}
  for c in json.loads((inp/"receipt_corrections.json").read_text())["corrections"]:
   by.pop(c["record_id"],None)
   if c["action"]=="replace":by[c["replacement"]["receipt_id"]]=c["replacement"]
  rec=list(by.values())
 received=defaultdict(Decimal); po_item={(r["po_id"],r["line_id"]):r["item_id"] for r in pos}
 for r in rec:
  q=Decimal(r["quantity"]); key=(r["po_id"],r["line_id"]); received[key]+=q*(items[po_item[key]] if r["unit"]=="case" else 1)
 invoices=[]; line_nodes={}
 for inv in ET.parse(inp/"supplier_invoices.xml").getroot():
  freight=Decimal(inv.attrib["freight"]);tax=Decimal(inv.attrib["tax"])
  invoices.append((inv.attrib["supplier_id"],inv.attrib["currency"],freight,tax))
  for n in inv.findall("line"):
   factor=items[n.attrib["item_id"]]; q=Decimal(n.attrib["quantity"]);price=Decimal(n.attrib["unit_price"])
   baseq=q*(factor if n.attrib["unit"]=="case" else 1);ext=q*price
   key=(inv.attrib["po_id"],n.attrib["po_line_id"])
   line_nodes[n.attrib["invoice_line_id"]]=(key,inv.attrib["supplier_id"],ext)
 credits=defaultdict(Decimal); excess=defaultdict(Decimal); header_credit=defaultdict(Decimal)
 if (inp/"credit_notes.xml").exists():
  for c in ET.parse(inp/"credit_notes.xml").getroot():
   amount=Decimal(c.attrib["amount"]); supplier=c.attrib["supplier_id"]
   if c.tag=="header_credit":header_credit[supplier]+=amount
   else:
    key,owner,ext=line_nodes[c.attrib["invoice_line_id"]]; applied=min(amount,ext);credits[key]+=applied;excess[supplier]+=amount-applied
 invqty=defaultdict(Decimal);gross=defaultdict(Decimal)
 for key,supplier,ext in line_nodes.values():pass
 for inv in ET.parse(inp/"supplier_invoices.xml").getroot():
  for n in inv.findall("line"):
   key=(inv.attrib["po_id"],n.attrib["po_line_id"]);q=Decimal(n.attrib["quantity"]);factor=items[n.attrib["item_id"]]
   invqty[key]+=q*(factor if n.attrib["unit"]=="case" else 1);gross[key]+=q*Decimal(n.attrib["unit_price"])
 lines=[]; exceptions=[]
 for po in sorted(pos,key=lambda r:(r["po_id"],r["line_id"])):
  key=(po["po_id"],po["line_id"]);factor=items[po["item_id"]]
  oq=Decimal(po["ordered_qty"])*(factor if po["unit"]=="case" else 1);pp=Decimal(po["unit_price"])/(factor if po["unit"]=="case" else 1)
  iq=invqty[key];ip=gross[key]/iq if iq else Decimal(0); qv=abs(received[key]-iq);pv=abs(ip-pp);qp=qv<=Decimal(".02")*oq; ppass=pv<=Decimal(".01")*pp
  row={"po_id":key[0],"line_id":key[1],"supplier_id":po["supplier_id"],"item_id":po["item_id"],"ordered_qty":number(oq),"received_qty":number(received[key]),"invoiced_qty":number(iq),"po_unit_price":money(pp),"invoice_unit_price":money(ip),"quantity_variance":number(qv),"price_variance":money(pv),"quantity_pass":str(qp).lower(),"price_pass":str(ppass).lower(),"credit_applied":money(credits[key]),"line_payable":money(gross[key]-credits[key]),"status":"pass" if qp and ppass else "exception"};lines.append(row)
  if not qp:exceptions.append({"po_id":key[0],"line_id":key[1],"reason":"quantity","quantity_variance":number(qv),"price_variance":money(pv)})
  if not ppass:exceptions.append({"po_id":key[0],"line_id":key[1],"reason":"price","quantity_variance":number(qv),"price_variance":money(pv)})
 exceptions.sort(key=lambda r:(r["po_id"],r["line_id"],r["reason"]))
 sumv=defaultdict(lambda:{"line_gross":Decimal(0),"credit_applied":Decimal(0),"line_payable":Decimal(0),"freight":Decimal(0),"tax":Decimal(0)})
 currencies={}
 for inv in ET.parse(inp/"supplier_invoices.xml").getroot():
  s=inv.attrib["supplier_id"];currencies[s]=inv.attrib["currency"];sumv[s]["freight"]+=Decimal(inv.attrib["freight"]);sumv[s]["tax"]+=Decimal(inv.attrib["tax"])
 for r in lines:
  s=r["supplier_id"];sumv[s]["line_gross"]+=Decimal(r["line_payable"])+Decimal(r["credit_applied"]);sumv[s]["credit_applied"]+=Decimal(r["credit_applied"]);sumv[s]["line_payable"]+=Decimal(r["line_payable"])
 summaries=[]
 for s in sorted(sumv):
  v=sumv[s]; subtotal=v["line_payable"]+v["freight"]+v["tax"];hc=header_credit[s]; applied_header=min(hc,subtotal);unapplied=excess[s]+hc-applied_header
  summaries.append({"supplier_id":s,"currency":currencies[s],"line_gross":money(v["line_gross"]),"credit_applied":money(v["credit_applied"]),"line_payable":money(v["line_payable"]),"freight":money(v["freight"]),"tax":money(v["tax"]),"header_credit":money(hc),"unapplied_credit":money(unapplied),"final_payable":money(subtotal-applied_header)})
 return lines,exceptions,{"suppliers":summaries}
LINE_HEAD="po_id,line_id,supplier_id,item_id,ordered_qty,received_qty,invoiced_qty,po_unit_price,invoice_unit_price,quantity_variance,price_variance,quantity_pass,price_pass,credit_applied,line_payable,status".split(",")
EX_HEAD="po_id,line_id,reason,quantity_variance,price_variance".split(",")
def maincheck(candidate):
 holder,code,diag=fresh(candidate,"main");parsed=False
 try:
  out=holder/"workspace/output"; structural=code==0 and all((out/n).is_file() for n in ("line_matches.csv","exceptions.csv","supplier_summary.json"))
  if not structural:return [False]*5,code==0,False,diag
  try:
   got=csvrows(out/"line_matches.csv");exc=csvrows(out/"exceptions.csv");summary=json.loads((out/"supplier_summary.json").read_text());parsed=header(out/"line_matches.csv")==LINE_HEAD and header(out/"exceptions.csv")==EX_HEAD and isinstance(summary.get("suppliers"),list)
   exp,eexc,esummary=expected(holder/"workspace/inputs"); gm={(r["po_id"],r["line_id"]):r for r in got};em={(r["po_id"],r["line_id"]):r for r in exp}
  except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,KeyError,ET.ParseError):return [False]*5,True,False,diag
  qfields=["ordered_qty","received_qty","invoiced_qty","quantity_variance"]
  check1=parsed and list(gm)==list(em) and all(all(gm.get(k,{}).get(f)==em[k][f] for f in qfields) for k in em)
  pfields=["po_unit_price","invoice_unit_price","price_variance","quantity_pass","price_pass","status"]
  check2=exc==eexc and all(all(gm.get(k,{}).get(f)==em[k][f] for f in pfields) for k in em)
  check3=gm.get(("PO-100","L01"),{}).get("received_qty")=="102" and gm.get(("PO-100","L02"),{}).get("received_qty")=="235.2"
  cfields=["credit_applied","line_payable"]
  check4=all(all(gm.get(k,{}).get(f)==em[k][f] for f in cfields) for k in em) and gm.get(("PO-100","L01"),{}).get("credit_applied")=="100.00" and gm.get(("PO-200","L02"),{}).get("credit_applied")=="50.00"
  check5=summary==esummary and all(Decimal(s["final_payable"])==Decimal(s["line_payable"])+Decimal(s["freight"])+Decimal(s["tax"])-min(Decimal(s["header_credit"]),Decimal(s["line_payable"])+Decimal(s["freight"])+Decimal(s["tax"])) for s in summary["suppliers"])
  return [check1,check2,check3,check4,check5],True,parsed,diag
 finally:shutil.rmtree(holder,ignore_errors=True)
def edgecheck(candidate):
 holder,code,diag=fresh(candidate,"edge")
 try:
  if code:return False,diag
  try:
   rows=csvrows(holder/"workspace/output/line_matches.csv");data=json.loads((holder/"workspace/output/supplier_summary.json").read_text()); line=rows[0];s=data["suppliers"][0]
   return len(rows)==1 and line["line_payable"]=="0.00" and line["credit_applied"]=="100.00" and s["unapplied_credit"]=="50.00" and s["final_payable"]=="5.00",diag
  except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,KeyError,IndexError):return False,diag
 finally:shutil.rmtree(holder,ignore_errors=True)
def main():
 p=argparse.ArgumentParser();p.add_argument("--workspace",required=True,type=Path);a=p.parse_args();artifact=(a.workspace/"solution/three_way_match.py").is_file()
 if not artifact:result={"status":"fail","progress_level":0,"main_checks_passed":0,"main_checks_total":5,"edge_check_passed":False,"notes":[]}
 else:
  notes=[]
  try:checks,runnable,parsed,diag=maincheck(a.workspace)
  except Exception as exc:checks,runnable,parsed,diag=[False]*5,True,False,"malformed main output: "+str(exc)[:500]
  try:edge,ediag=edgecheck(a.workspace)
  except Exception as exc:edge,ediag=False,"malformed edge output: "+str(exc)[:500]
  n=sum(checks);level=5 if n==5 and edge else 4 if n==5 else 3 if n else 2 if parsed else 1 if runnable else 0
  if diag:notes.append("main candidate diagnostic: "+diag[:500])
  if ediag:notes.append("edge candidate diagnostic: "+ediag[:500])
  result={"status":"pass" if level==5 else "fail","progress_level":level,"main_checks_passed":n,"main_checks_total":5,"edge_check_passed":edge,"notes":notes[:2]}
 print(json.dumps(result,sort_keys=True))
if __name__=="__main__":main()
