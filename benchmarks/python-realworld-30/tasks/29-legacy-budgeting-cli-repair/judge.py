#!/usr/bin/env python3.12
from __future__ import annotations
import argparse,csv,json,os,shutil,subprocess,tempfile
from decimal import Decimal
from pathlib import Path

PY="/usr/bin/python3.12"; CAP=6000

def run(argv,cwd,timeout=90):
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        try: p=subprocess.run(argv,cwd=cwd,stdout=out,stderr=err,timeout=timeout,env={"PATH":"/usr/bin:/bin","PYTHONHASHSEED":"0"})
        except (OSError,subprocess.TimeoutExpired) as exc:return 124,str(exc)[:CAP]
        out.seek(0);err.seek(0)
        return p.returncode,(out.read(CAP)+err.read(CAP)).decode("utf-8","replace")

def copytree(src,dst):
    if dst.exists(): shutil.rmtree(dst)
    shutil.copytree(src,dst)

def make_fixture(task,candidate,kind):
    root=Path(tempfile.mkdtemp(prefix=f"pcbench29-{kind}-"))
    rc,detail=run([PY,"-E","-S",str(task/"seed.py"),"--workspace",str(root),"--fixture",kind],task)
    if rc: raise RuntimeError("seed failed: "+detail[:300])
    copytree(candidate,root/"budgetdesk")
    # Generators run in a separate directory. Only their declared payload is copied.
    payload=Path(tempfile.mkdtemp(prefix="pcbench29-stage-"))
    try:
        rc,detail=run([PY,"-E","-S",str(task/"stages/splits/_generate.py"),"--output",str(payload),"--fixture",kind],task/"stages/splits")
        if rc: raise RuntimeError("split generator failed: "+detail[:300])
        shutil.copytree(payload,root,dirs_exist_ok=True)
    finally: shutil.rmtree(payload,ignore_errors=True)
    for rel in ("stages/export/EXPORT.md","stages/export/stage.json","stages/export/inputs/export_schema.json"):
        src=task/rel; dst=root/src.relative_to(task/"stages/export")
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
    return root

def command(root,*args): return run([PY,"-E","-S","-m","budgetdesk",*args],root)

def money(v): return Decimal(str(v)).quantize(Decimal("0.01"))

def read_exports(root):
    with (root/"output/transactions.csv").open(encoding="utf-8",newline="") as f:
        rd=csv.DictReader(f); header=rd.fieldnames; rows=list(rd)
    data=json.loads((root/"output/transactions.json").read_text(encoding="utf-8"))
    report=json.loads((root/"output/monthly.json").read_text(encoding="utf-8"))
    errors=json.loads((root/"output/split_errors.json").read_text(encoding="utf-8"))
    return header,rows,data,report,errors

def evaluate(task,candidate,kind):
    root=make_fixture(task,candidate,kind); logs=[]; runnable=False
    try:
        cmds=[
          ("import", "workspace/budget.db","inputs/accounts.json","inputs/statements"),
          ("import", "workspace/budget.db","inputs/accounts.json","inputs/statements"),
          ("report","workspace/budget.db","--month","2025-05","--output","output/monthly.json"),
          ("export","workspace/budget.db","--format","csv","--output","output/transactions.csv"),
          ("export","workspace/budget.db","--format","json","--output","output/transactions.json"),
        ]
        for args in cmds:
            rc,detail=command(root,*args); logs.append(detail)
            if args[0]=="import": runnable=True
            if rc: return [False]*5,runnable,False,"command failed: "+detail[:500],root
        header,rows,data,report,errors=read_exports(root)
        parsed=True
        if kind=="edge":
            rent=[r for r in rows if r.get("source_account")=="checking-001" and r.get("source_id")=="a-rent"]
            util=[r for r in rows if r.get("source_account")=="savings-01" and r.get("source_id")=="b-util"]
            ok=(len(rent)==1 and rent[0].get("split_part","")=="" and len(util)==2 and
                {r.get("split_part") for r in util}=={"1","2"} and isinstance(errors,list) and len(errors)==1 and
                errors[0].get("source_account")=="checking-001" and errors[0].get("source_id")=="a-rent")
            return ok,runnable,parsed,"",root
        columns=["source_account","source_id","date","description","amount","category","kind","split_part","split_amount","split_category"]
        identities={(r.get("source_account"),r.get("source_id")) for r in rows}
        check1=(identities=={("legacy-card","legacy-april"),("checking-001","a-pay"),("checking-001","a-rent"),("checking-001","a-grocery"),("checking-001","shared-7"),("savings-01","shared-7"),("savings-01","b-freelance"),("savings-01","b-grocery"),("savings-01","b-util")} and
          any(r.get("date")=="2025-05-20" and r.get("description")=="Freelance payment" for r in rows))
        # Repeated import stays at nine parents. Two parents expand to two parts, hence eleven export rows.
        check2=len(rows)==11 and len([r for r in rows if r.get("source_id")=="a-grocery"])==1
        expected={"income":"4100.00","spending":"1438.50","transfers_in":"500.00","transfers_out":"500.00"}
        cats={"Groceries":"118.50","Home Office":"200.00","Housing":"1000.00","Internet":"40.00","Utilities":"80.00"}
        variance={"Groceries":"81.50","Home Office":"50.00","Housing":"300.00","Internet":"20.00","Utilities":"70.00"}
        check3=(report.get("month")=="2025-05" and all(str(report.get(k))==v for k,v in expected.items()) and report.get("categories")==cats and report.get("budget_variance")==variance)
        rent=sorted((r.get("split_part"),r.get("split_amount"),r.get("split_category")) for r in rows if r.get("source_id")=="a-rent")
        util=sorted((r.get("split_part"),r.get("split_amount"),r.get("split_category")) for r in rows if r.get("source_id")=="b-util")
        check4=(errors==[] and rent==[("1","-1000.00","Housing"),("2","-200.00","Home Office")] and util==[("1","-80.00","Utilities"),("2","-40.00","Internet")])
        expected_order=sorted(rows,key=lambda r:(r["date"],r["source_account"],r["source_id"],int(r["split_part"] or 0)))
        check5=(header==columns and rows==expected_order and data==rows and (root/"output/transactions.json").read_bytes().endswith(b"\n"))
        return [check1,check2,check3,check4,check5],runnable,parsed,"",root
    except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,KeyError,ValueError,TypeError) as exc:
        return ([False]*5 if kind=="main" else False),runnable,False,"malformed output: "+str(exc)[:500],root

def main():
    p=argparse.ArgumentParser();p.add_argument("--workspace",type=Path,required=True);a=p.parse_args()
    task=Path(__file__).resolve().parent; candidate=a.workspace.resolve()/"budgetdesk"
    if not candidate.is_dir() or not any(candidate.glob("*.py")):
        print(json.dumps({"status":"fail","progress_level":0,"main_checks_passed":0,"main_checks_total":5,"edge_check_passed":False,"notes":[]}));return
    roots=[];notes=[]
    try:
        checks,runnable,parsed,detail,root=evaluate(task,candidate,"main");roots.append(root)
        if detail:notes.append(detail)
        edge,_,_,detail,root=evaluate(task,candidate,"edge");roots.append(root)
        if detail:notes.append(detail)
        passed=sum(bool(x) for x in checks)
        level=5 if passed==5 and edge else 4 if passed==5 else 3 if passed>=2 else 2 if parsed else 1 if runnable else 0
        result={"status":"pass" if level==5 else "fail","progress_level":level,"main_checks_passed":passed,"main_checks_total":5,"edge_check_passed":bool(edge),"notes":notes[:2]}
        print(json.dumps(result,sort_keys=True))
    except Exception as exc:
        print(json.dumps({"status":"error","progress_level":1,"main_checks_passed":0,"main_checks_total":5,"edge_check_passed":False,"notes":[str(exc)[:500]]},sort_keys=True))
    finally:
        for root in roots:shutil.rmtree(root,ignore_errors=True)
if __name__=="__main__":main()
