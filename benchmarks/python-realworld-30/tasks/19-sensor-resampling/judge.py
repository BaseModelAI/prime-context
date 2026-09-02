#!/usr/bin/env python3
"""Direct main-and-edge judge for Task 19."""
from __future__ import annotations
import argparse,csv,gzip,json,shutil,subprocess,tempfile
from pathlib import Path
PYTHON=shutil.which("python3.12") or "python3.12"
TASK=Path(__file__).resolve().parent

def invoke(script,*args,timeout=300,cwd=None):
    return subprocess.run([PYTHON,"-E","-S",str(script),*map(str,args)],cwd=cwd,text=True,capture_output=True,timeout=timeout)

def prepare(candidate,fixture):
    holder=Path(tempfile.mkdtemp(prefix=f"task19-{fixture}-"));work=holder/"work";payload=holder/"payload"
    seeded=invoke(TASK/"seed.py","--workspace",work,"--fixture",fixture)
    if seeded.returncode:return work,holder,False,seeded.stderr
    generated=invoke(TASK/"visible"/"_generate.py","--output",payload,"--fixture",fixture)
    if generated.returncode:return work,holder,False,generated.stderr
    shutil.copytree(payload,work,dirs_exist_ok=True)
    source=candidate/"solution"
    if source.is_dir():
        shutil.rmtree(work/"solution");shutil.copytree(source,work/"solution")
    try:
        done=subprocess.run([PYTHON,"-E","-S","-m","solution.sensor_resample","inputs/readings.csv.gz","inputs/sensors.json","--output","output"],cwd=work,text=True,capture_output=True,timeout=240)
    except subprocess.TimeoutExpired:return work,holder,False,"candidate timed out"
    return work,holder,done.returncode==0,done.stderr[-500:]

def read_csv(path,header):
    with path.open(encoding="utf-8",newline="") as handle:
        reader=csv.DictReader(handle)
        if reader.fieldnames!=header:raise ValueError(f"bad header in {path.name}")
        return list(reader)

def read_resampled(path,wanted):
    selected={};last=None;ordered=True;bucketed=True;bad_bucket_absent=True;count=0
    with gzip.open(path,"rt",encoding="utf-8",newline="") as handle:
        reader=csv.DictReader(handle)
        expected=["bucket_start_utc","sensor_id","kind","count","min","max","mean","delta"]
        if reader.fieldnames!=expected:raise ValueError("bad resampled header")
        for row in reader:
            count+=1;key=(row["bucket_start_utc"],row["sensor_id"])
            ordered &= last is None or last < key;last=key
            stamp=row["bucket_start_utc"]
            bucketed &= len(stamp)==20 and stamp.endswith(":00Z") and int(stamp[14:16])%5==0
            if key==("2025-01-01T00:05:00Z","G02"):bad_bucket_absent=False
            if key in wanted:selected[key]=row
    return selected,ordered,bucketed,bad_bucket_absent,count

def main_checks(work):
    notes=[];checks=[False]*5;parseable=False
    wanted={("2025-01-01T00:00:00Z","G01"),("2025-01-01T00:05:00Z","G01"),("2025-01-01T00:00:00Z","C01"),("2025-01-01T00:05:00Z","C01"),("2025-01-01T00:10:00Z","C01"),("2025-01-01T00:30:00Z","C01")}
    try:
        selected,ordered,bucketed,bad_absent,count=read_resampled(work/"output"/"resampled.csv.gz",wanted)
        resets=read_csv(work/"output"/"resets.csv",["sensor_id","previous_timestamp","current_timestamp","previous_value","current_value"])
        gaps=read_csv(work/"output"/"gaps.csv",["sensor_id","start_timestamp","end_timestamp","duration_seconds"])
        parseable=True
    except (OSError,ValueError,csv.Error,UnicodeError) as exc:
        return checks,False,[f"outputs not parseable: {exc}"]
    checks[0]=ordered and bucketed and count>1_000_000
    checks[1]=bad_absent
    checks[2]=selected.get(("2025-01-01T00:00:00Z","G01"))=={"bucket_start_utc":"2025-01-01T00:00:00Z","sensor_id":"G01","kind":"gauge","count":"2","min":"10","max":"14","mean":"12","delta":""} and selected.get(("2025-01-01T00:05:00Z","G01"))=={"bucket_start_utc":"2025-01-01T00:05:00Z","sensor_id":"G01","kind":"gauge","count":"1","min":"20","max":"20","mean":"20","delta":""}
    counter_expected={
        ("2025-01-01T00:00:00Z","C01"):"10",
        ("2025-01-01T00:05:00Z","C01"):"20",
        ("2025-01-01T00:10:00Z","C01"):"5",
        ("2025-01-01T00:30:00Z","C01"):"10",
    }
    checks[3]=all(selected.get(key)=={"bucket_start_utc":key[0],"sensor_id":"C01","kind":"counter","count":"","min":"","max":"","mean":"","delta":delta} for key,delta in counter_expected.items()) and resets==[{"sensor_id":"C01","previous_timestamp":"2025-01-01T00:05:00Z","current_timestamp":"2025-01-01T00:10:00Z","previous_value":"130","current_value":"90"}]
    checks[4]=gaps==[
        {"sensor_id":"G01","start_timestamp":"2025-01-01T00:05:00Z","end_timestamp":"2025-01-01T00:25:00Z","duration_seconds":"1200"},
        {"sensor_id":"C01","start_timestamp":"2025-01-01T00:14:00Z","end_timestamp":"2025-01-01T00:31:00Z","duration_seconds":"1020"},
    ]
    notes.extend(f"main semantic check {index} failed" for index,value in enumerate(checks,1) if not value)
    return checks,parseable,notes

def edge_check(work):
    try:
        selected,ordered,bucketed,bad_absent,count=read_resampled(work/"output"/"resampled.csv.gz",{("2025-01-01T00:00:00Z","G01"),("2025-01-01T00:20:00Z","G01")})
        gaps=read_csv(work/"output"/"gaps.csv",["sensor_id","start_timestamp","end_timestamp","duration_seconds"])
        keys=set(selected)
        return ordered and bucketed and count==2 and bad_absent and keys=={("2025-01-01T00:00:00Z","G01"),("2025-01-01T00:20:00Z","G01")} and gaps==[{"sensor_id":"G01","start_timestamp":"2025-01-01T00:00:00Z","end_timestamp":"2025-01-01T00:22:00Z","duration_seconds":"1320"}]
    except (OSError,ValueError,csv.Error,UnicodeError):return False

def judge(candidate):
    artifact=(candidate/"solution"/"sensor_resample.py").is_file() or (candidate/"solution"/"sensor_resample"/"__main__.py").is_file()
    main_work,main_holder,ran,error=prepare(candidate,"main")
    try:
        if ran:
            checks,parseable,notes=main_checks(main_work)
        else:
            checks=[False]*5
            parseable=False
            notes=["main command failed"] + ([error] if error else [])
    finally:shutil.rmtree(main_holder,ignore_errors=True)
    edge_work,edge_holder,edge_ran,_=prepare(candidate,"edge")
    try:edge=edge_ran and edge_check(edge_work)
    finally:shutil.rmtree(edge_holder,ignore_errors=True)
    passed=sum(checks)
    if passed==5 and edge:level=5
    elif passed==5:level=4
    elif passed:level=3
    elif ran and parseable:level=2
    elif artifact:level=1
    else:level=0
    if not edge:notes.append("BAD-only edge fixture failed")
    return {"status":"pass" if level==5 else "fail","progress_level":level,"main_checks_passed":passed,"main_checks_total":5,"edge_check_passed":bool(edge),"notes":notes}

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--workspace",required=True,type=Path);args=parser.parse_args();print(json.dumps(judge(args.workspace.resolve()),sort_keys=True))
