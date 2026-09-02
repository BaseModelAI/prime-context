#!/usr/bin/env python3.12
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta
from pathlib import Path

PY = "/usr/bin/python3.12"
CAP = 8000
MAX_REPORT = 2_000_000
SCHEDULE_HEADER = ["appointment_id","patient_id","provider_id","type_id","site_id","room_id","start","end","priority","locked"]
ISSUE_HEADER = ["appointment_id","code","detail"]
CHANGE_HEADER = ["appointment_id","patient_id","change_kind","old_provider_id","new_provider_id","old_room_id","new_room_id","old_start","new_start","minutes_moved"]
UNSCHEDULED_HEADER = ["appointment_id","patient_id","reason"]


def run(argv, cwd, timeout=120):
    with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
        try:
            proc = subprocess.run(
                argv, cwd=cwd, stdout=out, stderr=err, timeout=timeout,
                env={"PATH":"/usr/bin:/bin", "PYTHONHASHSEED":"0"},
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            return 124, str(exc)[:CAP]
        out.seek(0); err.seek(0)
        data = out.read(CAP) + err.read(CAP)
        return proc.returncode, data.decode("utf-8", "replace")


def inject_stage(task, root, name, fixture_kind):
    source = task / "stages" / name
    payload = Path(tempfile.mkdtemp(prefix=f"pcbench27-{name}-"))
    try:
        gen = source / "_generate.py"
        rc, detail = run(
            [PY, "-E", "-S", str(gen), "--output", str(payload), "--fixture", fixture_kind],
            source,
        )
        if rc:
            raise RuntimeError("stage generation failed: " + detail[:300])
        meta = json.loads((source / "stage.json").read_text(encoding="utf-8"))
        for rel in meta["files"]:
            generated = payload / rel
            static = source / rel
            src = generated if generated.is_file() else static
            dst = root / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
    finally:
        shutil.rmtree(payload, ignore_errors=True)


def fixture(task, candidate, fixture_kind, full):
    root = Path(tempfile.mkdtemp(prefix=f"pcbench27-{fixture_kind}-"))
    rc, detail = run(
        [PY, "-E", "-S", str(task / "seed.py"), "--workspace", str(root), "--fixture", fixture_kind],
        task,
    )
    if rc:
        shutil.rmtree(root, ignore_errors=True)
        raise RuntimeError("seed failed: " + detail[:300])
    shutil.copytree(candidate, root / "solution")
    if full:
        for name in ("provider-absence", "urgent-requests", "equipment-outage"):
            inject_stage(task, root, name, fixture_kind)
    return root


def command(root):
    return run([PY, "-E", "-S", "-m", "solution.clinic_schedule", "inputs", "--output", "output"], root)


def csv_rows(path):
    if path.stat().st_size > MAX_REPORT:
        raise ValueError(f"oversized report {path.name}")
    raw = path.read_bytes()
    if b"\r" in raw:
        raise ValueError(f"non-LF line ending in {path.name}")
    text = raw.decode("utf-8")
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return reader.fieldnames, list(reader)


def load_csv(path):
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def iso(value):
    return datetime.fromisoformat(value)


def input_model(root, full):
    inputs = root / "inputs"
    appointments = {r["appointment_id"]: r for r in load_csv(inputs / "appointments.csv")}
    types = {r["type_id"]: r for r in load_csv(inputs / "appointment_types.csv")}
    providers = {r["provider_id"] for r in load_csv(inputs / "providers.csv")}
    availability = load_csv(inputs / "provider_availability.csv")
    patient_windows = {}
    for r in load_csv(inputs / "patient_windows.csv"):
        patient_windows.setdefault(r["patient_id"], []).append((iso(r["start"]), iso(r["end"])))
    rooms = {r["room_id"]: r for r in load_csv(inputs / "rooms.csv")}
    equipment = {(r["room_id"], r["equipment_id"]) for r in load_csv(inputs / "room_equipment.csv")}
    locked = {r["appointment_id"] for r in load_csv(inputs / "locked_appointments.csv")}
    travel = {(r["from_site"],r["to_site"]):int(r["minutes"]) for r in load_csv(inputs / "travel_buffers.csv")}
    slot = int(json.loads((inputs / "settings.json").read_text(encoding="utf-8"))["slot_minutes"])
    urgent = {}
    absence = None
    outage = None
    if full:
        urgent = {r["appointment_id"]:r for r in load_csv(inputs / "urgent_requests.csv")}
        absence = json.loads((inputs / "provider_absence.json").read_text(encoding="utf-8"))
        outage = json.loads((inputs / "equipment_outage.json").read_text(encoding="utf-8"))
    return {"appointments":appointments,"types":types,"providers":providers,"availability":availability,
            "patient_windows":patient_windows,"rooms":rooms,"equipment":equipment,"locked":locked,
            "travel":travel,"slot":slot,"urgent":urgent,"absence":absence,"outage":outage}


def normalized_initial(model):
    rows=[]
    for aid, a in sorted(model["appointments"].items()):
        end = iso(a["start"]) + timedelta(minutes=int(model["types"][a["type_id"]]["duration_minutes"]))
        rows.append({
          "appointment_id":aid,"patient_id":a["patient_id"],"provider_id":a["provider_id"],
          "type_id":a["type_id"],"site_id":a["site_id"],"room_id":a["room_id"],
          "start":a["start"],"end":end.isoformat(timespec="minutes"),"priority":a["priority"],
          "locked":"true" if aid in model["locked"] else "false",
        })
    return rows


def valid_schedule(rows, model, expected_ids, full):
    try:
        if len(rows) != len(expected_ids) or {r["appointment_id"] for r in rows} != expected_ids:
            return False
        if [r["appointment_id"] for r in rows] != sorted(expected_ids):
            return False
        if len({r["appointment_id"] for r in rows}) != len(rows):
            return False
        spans=[]
        for r in rows:
            aid=r["appointment_id"]
            if aid in model["appointments"]:
                src=model["appointments"][aid]
                if any(r[k] != src[k] for k in ("patient_id","type_id","site_id","priority")):
                    return False
                if r["locked"] != ("true" if aid in model["locked"] else "false"):
                    return False
            else:
                src=model["urgent"][aid]
                if (r["patient_id"],r["type_id"],r["site_id"],r["priority"],r["locked"]) != (src["patient_id"],src["type_id"],src["site_id"],src["priority"],"false"):
                    return False
            start=iso(r["start"]); typ=model["types"][r["type_id"]]
            end=start+timedelta(minutes=int(typ["duration_minutes"]))
            if r["end"] != end.isoformat(timespec="minutes"):
                return False
            if start.hour*60+start.minute != ((start.hour*60+start.minute)//model["slot"])*model["slot"] or start.second:
                return False
            if aid in model["urgent"]:
                wins=[(iso(src["window_start"]),iso(src["window_end"]))]
            else:
                wins=model["patient_windows"].get(r["patient_id"],[])
            if not any(lo <= start and end <= hi for lo,hi in wins):
                return False
            if r["provider_id"] not in model["providers"]:
                return False
            available=False
            for av in model["availability"]:
                if av["provider_id"]==r["provider_id"] and av["site_id"]==r["site_id"] and iso(av["start"])<=start and end<=iso(av["end"]):
                    available=True; break
            if not available:
                return False
            if full and model["absence"] and r["provider_id"]==model["absence"]["provider_id"]:
                lo=iso(model["absence"]["start"]); hi=iso(model["absence"]["end"])
                if start < hi and lo < end:
                    return False
            room=model["rooms"].get(r["room_id"])
            if not room or room["site_id"]!=r["site_id"] or room["room_kind"]!=typ["room_kind"]:
                return False
            required=typ["required_equipment"]
            capabilities=model["equipment"]
            if full and model["outage"]:
                capabilities=capabilities-{(model["outage"]["room_id"],model["outage"]["equipment_id"])}
            if required and (r["room_id"],required) not in capabilities:
                return False
            spans.append((r,start,end))
        for i,(a,astart,aend) in enumerate(spans):
            for b,bstart,bend in spans[i+1:]:
                overlap=astart < bend and bstart < aend
                if overlap and (a["provider_id"]==b["provider_id"] or a["room_id"]==b["room_id"]):
                    return False
        by_provider={}
        for r,start,end in spans:
            by_provider.setdefault(r["provider_id"],[]).append((start,end,r["site_id"]))
        for items in by_provider.values():
            items.sort()
            for (_,end,site),(start2,_,site2) in zip(items,items[1:]):
                if end + timedelta(minutes=model["travel"][(site,site2)]) > start2:
                    return False
        for aid in model["locked"]:
            row=next((r for r in rows if r["appointment_id"]==aid),None)
            src=model["appointments"][aid]
            if not row or (row["provider_id"],row["room_id"],row["start"]) != (src["provider_id"],src["room_id"],src["start"]):
                return False
        return True
    except (KeyError,ValueError,TypeError):
        return False


def expected_final(model):
    rows={r["appointment_id"]:r for r in normalized_initial(model)}
    def set_assignment(aid, provider, room, start):
        row=rows[aid].copy(); row["provider_id"]=provider;row["room_id"]=room;row["start"]=start
        duration=int(model["types"][row["type_id"]]["duration_minutes"])
        row["end"]=(iso(start)+timedelta(minutes=duration)).isoformat(timespec="minutes");rows[aid]=row
    set_assignment("A001","P002","N-GEN-1","2025-09-15T09:00")
    set_assignment("A002","P002","N-GEN-1","2025-09-15T09:30")
    set_assignment("A003","P002","N-GEN-1","2025-09-15T10:30")
    set_assignment("A004","P003","N-IMG-2","2025-09-15T14:30")
    for aid,provider,room,start in (("U001","P002","N-GEN-1","2025-09-15T10:00"),("U002","P002","N-GEN-1","2025-09-15T11:00")):
        src=model["urgent"][aid];duration=int(model["types"][src["type_id"]]["duration_minutes"])
        rows[aid]={"appointment_id":aid,"patient_id":src["patient_id"],"provider_id":provider,"type_id":src["type_id"],
          "site_id":src["site_id"],"room_id":room,"start":start,
          "end":(iso(start)+timedelta(minutes=duration)).isoformat(timespec="minutes"),
          "priority":src["priority"],"locked":"false"}
    return [rows[k] for k in sorted(rows)]


def expected_changes():
    values=[
      ["A001","PAT-0001","moved","P001","P002","N-GEN-1","N-GEN-1","2025-09-15T09:00","2025-09-15T09:00","0"],
      ["A002","PAT-0002","moved","P001","P002","N-GEN-1","N-GEN-1","2025-09-15T09:30","2025-09-15T09:30","0"],
      ["A003","PAT-0003","moved","P002","P002","N-GEN-1","N-GEN-1","2025-09-15T10:00","2025-09-15T10:30","30"],
      ["A004","PAT-0004","moved","P003","P003","N-IMG-1","N-IMG-2","2025-09-15T14:00","2025-09-15T14:30","30"],
      ["U001","URG-0001","urgent_scheduled","","P002","","N-GEN-1","","2025-09-15T10:00",""],
      ["U002","URG-0002","urgent_scheduled","","P002","","N-GEN-1","","2025-09-15T11:00",""],
    ]
    return [dict(zip(CHANGE_HEADER,v)) for v in values]


def notice_for_change(r):
    return (f"Appointment {r['appointment_id']}\nPatient {r['patient_id']}\nStatus: {r['change_kind']}\n"
            f"Old: {r['old_provider_id']}|{r['old_room_id']}|{r['old_start']}\n"
            f"New: {r['new_provider_id']}|{r['new_room_id']}|{r['new_start']}\n")


def notices_exact(root, changes, unscheduled):
    folder=root/"output"/"notices"
    files=sorted(p for p in folder.iterdir() if p.is_file())
    expected={}
    for r in changes:
        expected[r["patient_id"]+".txt"]=notice_for_change(r)
    for r in unscheduled:
        expected[r["patient_id"]+".txt"]=(f"Appointment {r['appointment_id']}\nPatient {r['patient_id']}\nStatus: unscheduled\nReason: NO_FEASIBLE_SLOT\n")
    if {p.name for p in files} != set(expected) or len(files)!=len(expected):
        return False
    for p in files:
        if p.stat().st_size>4096 or p.read_text(encoding="utf-8")!=expected[p.name]:
            return False
    return True


def evaluate_main(task, candidate):
    roots=[]; notes=[]; runnable=False; parsed=False; checks=[False]*5
    try:
        initial=fixture(task,candidate,"main",False);roots.append(initial)
        rc,detail=command(initial);runnable=True
        if rc:
            notes.append("initial command failed: "+detail[:500])
            return checks,runnable,parsed,notes,roots
        ih,issues=csv_rows(initial/"output"/"baseline_issues.csv")
        sh,schedule=csv_rows(initial/"output"/"schedule.csv");parsed=True
        model=input_model(initial,False);expected=normalized_initial(model)
        checks[0]=(ih==ISSUE_HEADER and issues==[] and sh==SCHEDULE_HEADER and schedule==expected and len(schedule)==250 and valid_schedule(schedule,model,set(model["appointments"]),False))

        final=fixture(task,candidate,"main",True);roots.append(final)
        rc,detail=command(final)
        if rc:
            notes.append("final command failed: "+detail[:500])
            return checks,runnable,parsed,notes,roots
        ih,issues=csv_rows(final/"output"/"baseline_issues.csv")
        sh,schedule=csv_rows(final/"output"/"schedule.csv")
        ch,changes=csv_rows(final/"output"/"changes.csv")
        uh,unscheduled=csv_rows(final/"output"/"unscheduled.csv");parsed=True
        model=input_model(final,True);smap={r["appointment_id"]:r for r in schedule}
        checks[1]=(all(smap.get(aid,{}).get("provider_id")=="P002" and smap.get(aid,{}).get("start")==start for aid,start in (("A001","2025-09-15T09:00"),("A002","2025-09-15T09:30"))) and all(smap.get(aid,{}).get("room_id")=="N-GEN-1" for aid in ("A001","A002")))
        expected_schedule=expected_final(model)
        unchanged={aid for aid in model["appointments"]}-{ "A001","A002","A003","A004" }
        original={r["appointment_id"]:r for r in normalized_initial(model)}
        locks_ok=all(smap.get(aid)==original[aid] for aid in unchanged)
        checks[2]=(sh==SCHEDULE_HEADER and schedule==expected_schedule and locks_ok and valid_schedule(schedule,model,set(model["appointments"])|set(model["urgent"]),True))
        checks[3]=(smap.get("U001",{}).get("provider_id")=="P002" and smap.get("U001",{}).get("start")=="2025-09-15T10:00" and smap.get("U002",{}).get("start")=="2025-09-15T11:00" and smap.get("A003",{}).get("start")=="2025-09-15T10:30" and not unscheduled)
        exp_changes=expected_changes()
        checks[4]=(ih==ISSUE_HEADER and issues==[] and ch==CHANGE_HEADER and changes==exp_changes and uh==UNSCHEDULED_HEADER and unscheduled==[] and smap.get("A004",{}).get("room_id")=="N-IMG-2" and smap.get("A004",{}).get("start")=="2025-09-15T14:30" and notices_exact(final,changes,unscheduled))
        return checks,runnable,parsed,notes,roots
    except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,KeyError,ValueError,TypeError) as exc:
        notes.append("malformed main output: "+str(exc)[:500])
        return checks,runnable,parsed,notes,roots


def evaluate_edge(task,candidate):
    roots=[]
    try:
        root=fixture(task,candidate,"edge",True);roots.append(root)
        rc,detail=command(root)
        if rc:return False,"edge command failed: "+detail[:500],roots
        ih,issues=csv_rows(root/"output"/"baseline_issues.csv")
        sh,schedule=csv_rows(root/"output"/"schedule.csv")
        ch,changes=csv_rows(root/"output"/"changes.csv")
        uh,unscheduled=csv_rows(root/"output"/"unscheduled.csv")
        model=input_model(root,True);expected=normalized_initial(model)
        edge_uns=[{"appointment_id":"EU001","patient_id":"EDGE-URG","reason":"NO_FEASIBLE_SLOT"}]
        ok=(ih==ISSUE_HEADER and issues==[] and sh==SCHEDULE_HEADER and schedule==expected and
            ch==CHANGE_HEADER and changes==[] and uh==UNSCHEDULED_HEADER and unscheduled==edge_uns and
            valid_schedule(schedule,model,{"E001"},True) and notices_exact(root,changes,unscheduled))
        return ok,"",roots
    except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,KeyError,ValueError,TypeError) as exc:
        return False,"malformed edge output: "+str(exc)[:500],roots


def result(status, level, passed, edge, notes):
    return {"status":status,"progress_level":level,"main_checks_passed":passed,
            "main_checks_total":5,"edge_check_passed":bool(edge),"notes":notes[:2]}


def main():
    parser=argparse.ArgumentParser();parser.add_argument("--workspace",type=Path,required=True);args=parser.parse_args()
    task=Path(__file__).resolve().parent;candidate=args.workspace.resolve()/"solution"
    if not candidate.is_dir() or not (candidate/"clinic_schedule.py").is_file():
        print(json.dumps(result("fail",0,0,False,[]),sort_keys=True));return
    roots=[];notes=[]
    try:
        checks,runnable,parsed,main_notes,main_roots=evaluate_main(task,candidate);roots.extend(main_roots);notes.extend(main_notes)
        edge,edge_note,edge_roots=evaluate_edge(task,candidate);roots.extend(edge_roots)
        if edge_note:notes.append(edge_note)
        passed=sum(bool(x) for x in checks)
        level=5 if passed==5 and edge else 4 if passed==5 else 3 if passed>=2 else 2 if parsed else 1 if runnable else 0
        print(json.dumps(result("pass" if level==5 else "fail",level,passed,edge,notes),sort_keys=True))
    except Exception as exc:
        print(json.dumps(result("error",1,0,False,[str(exc)[:500]]),sort_keys=True))
    finally:
        for root in roots:shutil.rmtree(root,ignore_errors=True)

if __name__=="__main__":main()
