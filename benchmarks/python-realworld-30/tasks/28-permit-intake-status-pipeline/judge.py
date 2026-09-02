#!/usr/bin/env python3.12
from __future__ import annotations
import argparse,csv,json,shutil,subprocess,tempfile
from pathlib import Path
PY="/usr/bin/python3.12";CAP=6000

def run(argv,cwd,timeout=120):
    with tempfile.TemporaryFile() as out,tempfile.TemporaryFile() as err:
        try:p=subprocess.run(argv,cwd=cwd,stdout=out,stderr=err,timeout=timeout,env={"PATH":"/usr/bin:/bin","PYTHONHASHSEED":"0"})
        except (OSError,subprocess.TimeoutExpired) as exc:return 124,str(exc)[:CAP]
        out.seek(0);err.seek(0);return p.returncode,(out.read(CAP)+err.read(CAP)).decode("utf-8","replace")

def stage(task,root,name,kind):
    source=task/"stages"/name; payload=Path(tempfile.mkdtemp(prefix="pcbench28-stage-"))
    try:
        gen=source/"_generate.py"
        if gen.is_file():
            rc,d=run([PY,"-E","-S",str(gen),"--output",str(payload),"--fixture",kind],source)
            if rc:raise RuntimeError(d[:300])
        for item in source.rglob("*"):
            if item.is_file() and item.name!="_generate.py":
                dst=payload/item.relative_to(source);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(item,dst)
        shutil.copytree(payload,root,dirs_exist_ok=True)
    finally:shutil.rmtree(payload,ignore_errors=True)

def fixture(task,candidate,kind):
    root=Path(tempfile.mkdtemp(prefix=f"pcbench28-{kind}-"))
    rc,d=run([PY,"-E","-S",str(task/"seed.py"),"--workspace",str(root),"--fixture",kind],task)
    if rc:raise RuntimeError("seed failed "+d[:300])
    target=root/"permitflow"
    if target.exists():shutil.rmtree(target)
    shutil.copytree(candidate,target)
    for name in ("ordinance-update","correction-batch","final-status"):stage(task,root,name,kind)
    return root

def cmd(root,*args):return run([PY,"-E","-S","-m","permitflow",*args],root)
def csvrows(path):
    with path.open(encoding="utf-8",newline="") as f:r=csv.DictReader(f);return r.fieldnames,list(r)

def evaluate(task,candidate,kind):
    root=fixture(task,candidate,kind);runnable=False
    try:
        for args in [("import","inputs","workspace/permits.db"),("import","inputs","workspace/permits.db"),("validate","workspace/permits.db","--output","output")]:
            rc,d=cmd(root,*args);runnable=True
            if rc:return ([False]*5 if kind=="main" else False),runnable,False,"command failed: "+d[:500],root
        ah,apps=csvrows(root/"output/applications.csv");ih,issues=csvrows(root/"output/validation_issues.csv");fh,fees=csvrows(root/"output/fees.csv")
        oh,impacts=csvrows(root/"output/ordinance_impacts.csv");sh,status=csvrows(root/"output/status.csv")
        parsed=True
        if kind=="edge":
            codes={(r.get("code"),r.get("detail")) for r in issues}
            s=status[0] if len(status)==1 else {}
            letter=(root/"output/notices/1.txt").read_text(encoding="utf-8")
            ok=(len(apps)==1 and apps[0].get("source_id")=="APP-EDGE" and codes=={("PARCEL_NOT_FOUND","PX-ABSENT")} and s.get("status")=="manual_review" and "Status: manual_review\n" in letter)
            return ok,runnable,parsed,"",root
        amap={r["source_id"]:r for r in apps}; bysrc={}
        for r in issues:bysrc.setdefault(r["source_id"],set()).add((r["code"],r["detail"]))
        smap={r["source_id"]:r for r in status}; fmap={r["source_id"]:r for r in fees}
        # Highest revisions are retained and the correction merge removes exactly one survivor.
        check1=(ah==["application_id","source_id","revision","parcel_id","owner_id","permit_type","submitted_date","closed_date"] and len(apps)==994 and len({r["application_id"] for r in apps})==994 and amap.get("APP-0006",{}).get("revision")=="3" and amap.get("APP-0006",{}).get("owner_id")=="OWN-0007")
        check2=(bysrc.get("APP-0005")=={("ZONING_INCOMPATIBLE","I/sign")} and ("OWNER_MISMATCH","OWN-0007") in bysrc.get("APP-0006",set()) and {("MISSING_DOCUMENT","ENERGY"),("MISSING_DOCUMENT","PLAN")} <= bysrc.get("APP-0003",set()) and not any(code=="PARCEL_NOT_FOUND" for rows in bysrc.values() for code,_ in rows))
        expected=set()
        residential={1,3,8,9}|{i for i in range(11,996) if i%7==0 and i%17!=0}
        for i in residential:
            aid=str(i);src=f"APP-{i:04d}"
            expected.add((aid,src,"documents","PLAN","ENERGY+PLAN"));expected.add((aid,src,"fee","100.00","125.00"))
        actual={(r.get("application_id"),r.get("source_id"),r.get("field"),r.get("before"),r.get("after")) for r in impacts}
        check3=(oh==["application_id","source_id","field","before","after"] and actual==expected and all(r["source_id"]!="APP-0007" for r in impacts))
        check4=("APP-0010" not in amap and amap.get("APP-0009",{}).get("application_id")=="9" and amap.get("APP-0002",{}).get("revision")=="2" and amap.get("APP-0002",{}).get("owner_id")=="OWN-0002" and not any(code in {"MISSING_DOCUMENT","EXPIRED_DOCUMENT"} for code,_ in bysrc.get("APP-0009",set())))
        anchors={"APP-0001":("approved","25.00"),"APP-0002":("approved","0.00"),"APP-0003":("needs_information","25.00"),"APP-0005":("manual_review","0.00"),"APP-0007":("approved","0.00"),"APP-0008":("needs_information","25.00"),"APP-0009":("approved","25.00")}
        anchor_ok=all(smap.get(src,{}).get("status")==st and smap.get(src,{}).get("fee_due")==due and fmap.get(src,{}).get("fee_due")==due for src,(st,due) in anchors.items())
        notices=list((root/"output/notices").glob("*.txt"))
        letters_ok=len(notices)==994
        for src,(st,due) in anchors.items():
            if src not in amap:letters_ok=False;continue
            aid=amap[src]["application_id"]; rows=sorted(bysrc.get(src,set()))
            issue_lines="\n".join(f"- {c}: {d}" for c,d in rows) if rows else "- none"
            expected_letter=f"Permit application {src}\nStatus: {st}\nFee due: {due}\nOutstanding issues:\n{issue_lines}\n"
            try:letters_ok &= (root/f"output/notices/{aid}.txt").read_text(encoding="utf-8")==expected_letter
            except OSError:letters_ok=False
        check5=(sh==["application_id","source_id","status","fee_due"] and fh==["application_id","source_id","required_fee","paid_fee","fee_due"] and anchor_ok and letters_ok)
        return [check1,check2,check3,check4,check5],runnable,parsed,"",root
    except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,KeyError,ValueError,TypeError) as exc:
        return ([False]*5 if kind=="main" else False),runnable,False,"malformed output: "+str(exc)[:500],root

def main():
    p=argparse.ArgumentParser();p.add_argument("--workspace",type=Path,required=True);a=p.parse_args();task=Path(__file__).resolve().parent;candidate=a.workspace.resolve()/"permitflow"
    if not candidate.is_dir() or not (candidate/"__main__.py").is_file():
        print(json.dumps({"status":"fail","progress_level":0,"main_checks_passed":0,"main_checks_total":5,"edge_check_passed":False,"notes":[]}));return
    roots=[];notes=[]
    try:
        checks,runnable,parsed,d,r=evaluate(task,candidate,"main");roots.append(r)
        if d:notes.append(d)
        edge,_,_,d,r=evaluate(task,candidate,"edge");roots.append(r)
        if d:notes.append(d)
        n=sum(map(bool,checks));level=5 if n==5 and edge else 4 if n==5 else 3 if n>=2 else 2 if parsed else 1 if runnable else 0
        print(json.dumps({"status":"pass" if level==5 else "fail","progress_level":level,"main_checks_passed":n,"main_checks_total":5,"edge_check_passed":bool(edge),"notes":notes[:2]},sort_keys=True))
    except Exception as exc:print(json.dumps({"status":"error","progress_level":1,"main_checks_passed":0,"main_checks_total":5,"edge_check_passed":False,"notes":[str(exc)[:500]]},sort_keys=True))
    finally:
        for r in roots:shutil.rmtree(r,ignore_errors=True)
if __name__=="__main__":main()
