#!/usr/bin/env python3
"""Direct main-and-edge judge for Task 08."""
from __future__ import annotations
import argparse,csv,json,shutil,subprocess,sys,tempfile
from datetime import date,datetime,timedelta,timezone
from decimal import Decimal
from itertools import combinations
from pathlib import Path
from zoneinfo import ZoneInfo
TASK_DIR=Path(__file__).resolve().parent
TF=["segment_id","type","revision","start_local","end_local","start_timezone","end_timezone","start_utc","end_utc","origin","destination","booking_ref","selected_alternative_id"]
RF=["original_segment_id","alternative_id","price","arrival_utc"]
AF=["alternative_id","replaces_segment_id","start_local","end_local","start_timezone","end_timezone","origin","destination","price"]

def instant(text,tz): return datetime.fromisoformat(text).replace(tzinfo=ZoneInfo(tz)).astimezone(timezone.utc)
def utc(value): return value.strftime("%Y-%m-%dT%H:%M:%SZ")
def readcsv(path,fields):
    raw=path.read_bytes()
    if b"\r" in raw or (raw and not raw.endswith(b"\n")): raise ValueError("line endings")
    with path.open(encoding="utf-8",newline="") as h:
        r=csv.DictReader(h)
        if r.fieldnames!=fields: raise ValueError("header")
        return raw,list(r)

def load_reference(inputs):
    itinerary=json.loads((inputs/"itinerary.json").read_text()); rules=json.loads((inputs/"connection_rules.json").read_text())
    segments={item["segment_id"]:{**item,"selected_alternative_id":""} for item in itinerary["segments"]}
    updates=json.loads((inputs/"updates.json").read_text()); highest={}
    for update in updates:
        sid=update["segment_id"]
        if sid not in highest or int(update["revision"])>int(highest[sid]["revision"]): highest[sid]=update
    for sid,update in highest.items():
        if sid in segments: segments[sid].update(update)
    segments={sid:s for sid,s in segments.items() if s.get("status")!="cancelled"}
    def bounds(s): return instant(s["start_local"],s["start_timezone"]),instant(s["end_local"],s["end_timezone"])
    transports=sorted((s for s in segments.values() if s["type"] in {"flight","train"}),key=lambda s:(bounds(s)[0],s["segment_id"]))
    previous={transports[i]["segment_id"]:transports[i-1] for i in range(1,len(transports))}
    _,alternatives=readcsv(inputs/"alternatives.csv",AF); rebook=[]
    for sid in sorted(highest):
        current=segments.get(sid); prior=previous.get(sid)
        if not current or not prior or current["type"] not in {"flight","train"}: continue
        p_end=bounds(prior)[1]; c_start=bounds(current)[0]
        key=f'{prior["type"]}>{current["type"]}'; required=int(rules["minimum_connection_minutes"].get(key,0))
        if prior["destination"]!=current["origin"]: required+=int(rules["airport_change_minutes"])
        if (c_start-p_end).total_seconds()/60>=required: continue
        valid=[]
        for alt in alternatives:
            if alt["replaces_segment_id"]!=sid or alt["origin"]!=prior["destination"]: continue
            start=instant(alt["start_local"],alt["start_timezone"]); end=instant(alt["end_local"],alt["end_timezone"])
            extra=int(rules["airport_change_minutes"]) if prior["destination"]!=alt["origin"] else 0
            need=int(rules["minimum_connection_minutes"].get(f'{prior["type"]}>{current["type"]}',0))+extra
            if (start-p_end).total_seconds()/60>=need: valid.append((end,Decimal(alt["price"]),alt["alternative_id"],alt))
        if valid:
            end,price,aid,alt=min(valid); current.update({field:alt[field] for field in ["start_local","end_local","start_timezone","end_timezone","origin","destination"]}); current["selected_alternative_id"]=aid
            rebook.append({"original_segment_id":sid,"alternative_id":aid,"price":alt["price"],"arrival_utc":utc(end)})
    return itinerary,rules,segments,rebook,bounds

def expected(inputs):
    itinerary,rules,segments,rebook,bounds=load_reference(inputs)
    ordered=sorted(segments.values(),key=lambda s:(bounds(s)[0],s["segment_id"]))
    timeline=[]
    for s in ordered:
        start,end=bounds(s); timeline.append({field:str(value) for field,value in [("segment_id",s["segment_id"]),("type",s["type"]),("revision",s["revision"]),("start_local",s["start_local"]),("end_local",s["end_local"]),("start_timezone",s["start_timezone"]),("end_timezone",s["end_timezone"]),("start_utc",utc(start)),("end_utc",utc(end)),("origin",s["origin"]),("destination",s["destination"]),("booking_ref",s["booking_ref"]),("selected_alternative_id",s.get("selected_alternative_id",""))]})
    issues=[]
    for a,b in combinations(ordered,2):
        sa,ea=bounds(a); sb,eb=bounds(b)
        if sa<eb and sb<ea: issues.append({"type":"overlap","segment_ids":sorted([a["segment_id"],b["segment_id"]])})
    bookings={}
    for s in ordered:
        if s["booking_ref"]: bookings.setdefault(s["booking_ref"],[]).append(s["segment_id"])
    for ids in bookings.values():
        for a,b in combinations(sorted(ids),2): issues.append({"type":"duplicate_booking","segment_ids":[a,b]})
    transport=[s for s in ordered if s["type"] in {"flight","train"}]
    for first,second in zip(transport,transport[1:]):
        pair=[first["segment_id"],second["segment_id"]]; required=int(rules["minimum_connection_minutes"].get(f'{first["type"]}>{second["type"]}',0))
        if first["destination"]!=second["origin"]:
            required+=int(rules["airport_change_minutes"]); issues.append({"type":"airport_change","segment_ids":pair})
        if (bounds(second)[0]-bounds(first)[1]).total_seconds()/60<required: issues.append({"type":"insufficient_connection","segment_ids":pair})
    hotels=[s for s in ordered if s["type"]=="hotel"]
    night=date.fromisoformat(itinerary["trip_start_date"]); stop=date.fromisoformat(itinerary["trip_end_date"])
    while night<stop:
        midnight=datetime.combine(night+timedelta(days=1),datetime.min.time())
        covered=any(datetime.fromisoformat(h["start_local"])<midnight<datetime.fromisoformat(h["end_local"]) for h in hotels)
        if not covered: issues.append({"type":"night_without_lodging","segment_ids":[],"night":night.isoformat()})
        night+=timedelta(days=1)
    issues.sort(key=lambda item:(item["type"],"|".join(item["segment_ids"]),item.get("night","")))
    rebook.sort(key=lambda r:r["original_segment_id"])
    return timeline,issues,rebook

def generate(root,fixture):
    for command in [[sys.executable,str(TASK_DIR/"seed.py"),"--workspace",str(root),"--fixture",fixture],[sys.executable,str(TASK_DIR/"visible/_generate.py"),"--output",str(root),"--fixture",fixture],[sys.executable,str(TASK_DIR/"stages/updates/_generate.py"),"--output",str(root),"--fixture",fixture]]: subprocess.run(command,check=True,capture_output=True,timeout=20)

def execute(candidate,fixture):
    temporary=tempfile.TemporaryDirectory(prefix=f"pcbench-08-{fixture}-"); root=Path(temporary.name); generate(root,fixture)
    if (candidate/"solution").is_dir(): shutil.rmtree(root/"solution"); shutil.copytree(candidate/"solution",root/"solution")
    run=subprocess.run([sys.executable,"-E","-S","-m","solution.itinerary_check","inputs","--output","output"],cwd=root,text=True,capture_output=True,timeout=40)
    return root,run,temporary

def read_rebook(path):
    raw=path.read_bytes()
    if b"\r" in raw or (raw and not raw.endswith(b"\n")): raise ValueError("line endings")
    with path.open(encoding="utf-8",newline="") as h:
        reader=csv.DictReader(h); fields=reader.fieldnames or []; rows=list(reader)
    original=next((name for name in ("original_segment_id","segment_id","replaces_segment_id") if name in fields),None)
    alternative=next((name for name in ("alternative_id","selected_alternative_id","replacement_id") if name in fields),None)
    if original is None or alternative is None: raise ValueError("rebook header")
    return raw,[{"original_segment_id":row[original],"alternative_id":row[alternative],"price":row.get("price",""),"arrival_utc":row.get("arrival_utc","")} for row in rows]

def outputs(root):
    tr,tl=readcsv(root/"output/timeline.csv",TF); rr,rb=read_rebook(root/"output/rebook.csv"); raw=(root/"output/issues.json").read_bytes(); value=json.loads(raw)
    if not isinstance(value,dict) or not isinstance(value.get("issues"),list) or not raw.endswith(b"\n"): raise ValueError("issues")
    return tr,tl,rr,rb,raw,value["issues"]

def module_imports(root):
    result=subprocess.run([sys.executable,"-E","-S","-c","import solution.itinerary_check"],cwd=root,text=True,capture_output=True,timeout=10)
    return result.returncode==0

def main():
    parser=argparse.ArgumentParser(); parser.add_argument("--workspace",required=True,type=Path); args=parser.parse_args(); candidate=args.workspace.resolve()
    artifact=(candidate/"solution/itinerary_check.py").is_file(); checks=[False]*5; notes=[]; runnable=parseable=False; mt=et=None
    try:
        if artifact:
            root,run,mt=execute(candidate,"main"); runnable=run.returncode==0 or module_imports(root)
            if not runnable: notes.append("main command failed")
            else:
                try:
                    tr,timeline,rr,rebook,ir,issues=outputs(root); etimeline,eissues,erebook=expected(root/"inputs"); parseable=True
                    checks[0]=timeline==etimeline and all(row["start_utc"].endswith("Z") and row["end_utc"].endswith("Z") for row in timeline)
                    ids={row["segment_id"]:row for row in timeline}; checks[1]="A1" not in ids and ids.get("F2",{}).get("revision")=="3"
                    checks[2]=issues==eissues and {item["type"] for item in issues}=={"airport_change","duplicate_booking"}
                    checks[3]=len(rebook)==1 and rebook[0]["original_segment_id"]=="F2" and rebook[0]["alternative_id"]=="ALT-C" and (not rebook[0]["price"] or rebook[0]["price"]=="220.00") and (not rebook[0]["arrival_utc"] or rebook[0]["arrival_utc"]=="2025-03-02T18:50:00Z") and ids["F2"]["selected_alternative_id"]=="ALT-C"
                    checks[4]=(timeline==sorted(timeline,key=lambda r:(r["start_utc"],r["segment_id"])) and rebook==sorted(rebook,key=lambda r:r["original_segment_id"]) and all(list(item)==sorted(item) for item in issues) and all(b"\r" not in raw and raw.endswith(b"\n") for raw in (tr,rr,ir)))
                except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,ValueError,KeyError) as exc: notes.append(f"main outputs invalid: {type(exc).__name__}")
        edge=False
        if artifact:
            eroot,erun,et=execute(candidate,"edge")
            if erun.returncode==0:
                try:
                    _,timeline,_,rebook,_,issues=outputs(eroot); expected_t,expected_i,expected_r=expected(eroot/"inputs")
                    edge=timeline==expected_t and issues==expected_i==[] and rebook==expected_r==[] and len(timeline)==2 and timeline[0]["end_utc"]==timeline[1]["start_utc"]
                except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,ValueError,KeyError): pass
            else: notes.append("edge command failed")
    except (OSError,subprocess.SubprocessError) as exc: edge=False; notes.append(f"judge execution failed: {type(exc).__name__}")
    finally:
        if mt: mt.cleanup()
        if et: et.cleanup()
    passed=sum(checks)
    if not artifact or not runnable: level=0
    elif not parseable: level=1
    elif passed==5: level=5 if edge else 4
    elif passed: level=3
    else: level=2
    print(json.dumps({"status":"pass" if level==5 else "fail","progress_level":level,"main_checks_passed":passed,"main_checks_total":5,"edge_check_passed":edge,"notes":notes},sort_keys=True))

if __name__=="__main__": main()
