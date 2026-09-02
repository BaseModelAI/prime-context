#!/usr/bin/env python3.12
from __future__ import annotations
import argparse,csv,json,os,shutil,signal,subprocess,tempfile,time,urllib.error,urllib.parse,urllib.request
from pathlib import Path
PY="/usr/bin/python3.12";CAP=6000

def run(argv,cwd,timeout=180):
 with tempfile.TemporaryFile() as out,tempfile.TemporaryFile() as err:
  try:p=subprocess.run(argv,cwd=cwd,stdout=out,stderr=err,timeout=timeout,env={"PATH":"/usr/bin:/bin","PYTHONHASHSEED":"0"})
  except (OSError,subprocess.TimeoutExpired) as exc:return 124,str(exc)[:CAP]
  out.seek(0);err.seek(0);return p.returncode,(out.read(CAP)+err.read(CAP)).decode("utf-8","replace")

def last_json(text):
 for line in reversed(text.splitlines()):
  try:
   value=json.loads(line)
   if isinstance(value,dict):return value
  except json.JSONDecodeError:pass
 raise ValueError("no JSON command summary")

def inject(task,root,name,kind):
 source=task/"stages"/name;payload=Path(tempfile.mkdtemp(prefix="pcbench30-stage-"))
 try:
  gen=source/"_generate.py"
  if gen.is_file():
   rc,d=run([PY,"-E","-S",str(gen),"--output",str(payload),"--fixture",kind],source)
   if rc:raise RuntimeError("generator failed: "+d[:300])
  for item in source.rglob("*"):
   if item.is_file() and item.name!="_generate.py":
    dst=payload/item.relative_to(source);dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(item,dst)
  shutil.copytree(payload,root,dirs_exist_ok=True)
 finally:shutil.rmtree(payload,ignore_errors=True)

def fixture(task,candidate,kind):
 root=Path(tempfile.mkdtemp(prefix=f"pcbench30-{kind}-"))
 rc,d=run([PY,"-E","-S",str(task/"seed.py"),"--workspace",str(root),"--fixture",kind],task)
 if rc:raise RuntimeError("seed failed: "+d[:300])
 shutil.copytree(candidate,root/"service")
 for name in ("mail","sla","search","maintenance"):inject(task,root,name,kind)
 return root

def cli(root,*args,timeout=180):return run([PY,"-E","-S","-m","helpdesk",*args],root/"service",timeout)

class Service:
 def __init__(self,root):self.root=root;self.p=None;self.base=None
 def __enter__(self):
  self.p=subprocess.Popen([PY,"-E","-S","-m","helpdesk","serve","--db","../workspace/helpdesk.db","--port","0"],cwd=self.root/"service",stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,start_new_session=True,env={"PATH":"/usr/bin:/bin","PYTHONHASHSEED":"0"})
  deadline=time.monotonic()+8;seen=[]
  while time.monotonic()<deadline and self.p.poll() is None:
   import select
   ready,_,_=select.select([self.p.stdout],[],[],0.2)
   if not ready:continue
   line=self.p.stdout.readline();seen.append(line)
   if line.startswith("LISTENING "):
    port=int(line.split()[1]);self.base=f"http://127.0.0.1:{port}";return self
  self.close();raise RuntimeError("service did not report LISTENING: "+"".join(seen)[:300])
 def close(self):
  if self.p and self.p.poll() is None:
   try:os.killpg(self.p.pid,signal.SIGTERM);self.p.wait(timeout=3)
   except Exception:
    try:os.killpg(self.p.pid,signal.SIGKILL)
    except Exception:pass
  if self.p and self.p.stdout:self.p.stdout.close()
 def __exit__(self,*a):self.close()
 def request(self,method,path,body=None):
  data=None if body is None else json.dumps(body).encode();headers={"Content-Type":"application/json"} if data is not None else {}
  req=urllib.request.Request(self.base+path,data=data,method=method,headers=headers)
  try:
   with urllib.request.urlopen(req,timeout=5) as r:raw=r.read(2_000_000);return r.status,json.loads(raw or b"null")
  except urllib.error.HTTPError as e:
   raw=e.read(10000)
   try:value=json.loads(raw)
   except Exception:value={"raw":raw.decode("utf-8","replace")}
   return e.code,value

def readcsv(path):
 with path.open(encoding="utf-8",newline="") as f:r=csv.DictReader(f);return r.fieldnames,list(r)

def evaluate_main(task,candidate):
 root=fixture(task,candidate,"main");runnable=False
 try:
  rc,d=cli(root,"create-agent","../workspace/helpdesk.db","--email","agent@example.test");runnable=True
  if rc:return [False]*5,runnable,False,"create-agent failed: "+d[:500],root
  agent=last_json(d)
  rc,d1=cli(root,"import-mail","../workspace/helpdesk.db","../inputs/archive.mbox");
  if rc:return [False]*5,runnable,False,"mail import failed: "+d1[:500],root
  rc,d2=cli(root,"import-mail","../workspace/helpdesk.db","../inputs/archive.mbox");
  if rc:return [False]*5,runnable,False,"mail reimport failed: "+d2[:500],root
  first,second=last_json(d1),last_json(d2)
  rc,d=cli(root,"escalations","../workspace/helpdesk.db","--as-of","2025-05-28T17:00:00Z","--output","../output/escalations.csv")
  if rc:return [False]*5,runnable,False,"escalations failed: "+d[:500],root
  rc,d=cli(root,"export","../workspace/helpdesk.db","--status","open","--output","../output/tickets.csv")
  if rc:return [False]*5,runnable,False,"export failed: "+d[:500],root
  rc,d=cli(root,"maintenance","../workspace/helpdesk.db","--as-of","2025-06-02T17:00:00Z","--output","../output/maintenance.json")
  if rc:return [False]*5,runnable,False,"maintenance failed: "+d[:500],root
  eh,erows=readcsv(root/"output/escalations.csv");xh,xrows=readcsv(root/"output/tickets.csv");maint=json.loads((root/"output/maintenance.json").read_text())
  parsed=True
  with Service(root) as svc:
   # Mail anchors and preserved records.
   c,t1=svc.request("GET","/tickets/1");c2,t2=svc.request("GET","/tickets/2");c3,t3=svc.request("GET","/tickets/3");c44,t44=svc.request("GET","/tickets/44")
   mail_ok=(first=={"imported":4999,"skipped":1,"created_tickets":1,"created_comments":4998} and second=={"imported":0,"skipped":5000,"created_tickets":0,"created_comments":0} and c==c2==c44==200 and t2.get("status")=="open" and len(t1.get("comments",[]))==4997 and len(t44.get("comments",[]))==1 and t44.get("subject")=="VPN Café access")
   # Core create, update, filter, and reopen behavior against the same durable service.
   body={"subject":"New monitor request","body":"Screen flickers","requester_email":"new@example.test","priority":"normal","created_at":"2025-06-03T09:00:00Z","assignee_id":agent.get("id")}
   cr,new=svc.request("POST","/tickets",body);nid=new.get("id")
   pr,pending=svc.request("PATCH",f"/tickets/{nid}",{"status":"pending_customer","updated_at":"2025-06-03T10:00:00Z"}) if nid else (0,{})
   lr,listed=svc.request("GET",f"/tickets?status=pending_customer&assignee={agent.get('id')}")
   rr,resolved=svc.request("PATCH",f"/tickets/{nid}",{"status":"resolved","updated_at":"2025-06-03T11:00:00Z"}) if nid else (0,{})
   cm,comment=svc.request("POST",f"/tickets/{nid}/comments",{"author_email":"new@example.test","author_type":"customer","body":"Still broken","created_at":"2025-06-03T12:00:00Z"}) if nid else (0,{})
   gr,final=svc.request("GET",f"/tickets/{nid}") if nid else (0,{})
   check1=(cr==201 and isinstance(nid,int) and pr==200 and lr==200 and any(x.get("id")==nid for x in listed.get("tickets",listed if isinstance(listed,list) else [])) and rr==200 and cm==201 and gr==200 and final.get("status")=="open" and final.get("updated_at")=="2025-06-03T12:00:00Z" and t1.get("subject")=="Printer paper jam")
   check2=mail_ok
   sr,sprinter=svc.request("GET","/search?"+urllib.parse.urlencode({"q":"printer grinding"}));sv,s_vpn=svc.request("GET","/search?"+urllib.parse.urlencode({"q":"VPN café"}))
   check4=(sr==sv==200 and sprinter.get("tickets") and sprinter["tickets"][0].get("id")==1 and sprinter["tickets"][0].get("score")==8 and s_vpn.get("tickets") and s_vpn["tickets"][0].get("id")==44 and s_vpn["tickets"][0].get("score")==11 and xh==["ticket_id","subject","status","priority","assignee_email","requester_email","created_at","updated_at","sla_due_at"] and [r["ticket_id"] for r in xrows]==["1","2","44"])
   check5=(maint=={"as_of":"2025-06-02T17:00:00Z","closed_ticket_ids":[3]} and c3==200 and t3.get("status")=="closed" and t3.get("updated_at")=="2025-06-02T17:00:00Z")
  expected_escalations={
   "1":("urgent","2025-05-23T09:30:00Z","1410",""),
   "2":("normal","2025-05-27T11:00:00Z","840","legacy@example.test"),
   "3":("low","2025-05-20T17:00:00Z","2400","legacy@example.test"),
   "44":("normal","2025-05-27T12:00:00Z","780","")}
  actual={r["ticket_id"]:(r["priority"],r["due_at"],r["minutes_overdue"],r["assignee_email"]) for r in erows}
  check3=(eh==["ticket_id","priority","due_at","minutes_overdue","assignee_email"] and actual==expected_escalations)
  return [check1,check2,check3,check4,check5],runnable,parsed,"",root
 except (OSError,UnicodeError,csv.Error,json.JSONDecodeError,KeyError,ValueError,TypeError) as exc:return [False]*5,runnable,False,"malformed output: "+str(exc)[:500],root

def evaluate_edge(task,candidate):
 root=fixture(task,candidate,"edge");runnable=False
 try:
  rc,d1=cli(root,"import-mail","../workspace/helpdesk.db","../inputs/archive-a.mbox");runnable=True
  if rc:return False,runnable,False,d1[:500],root
  rc,d2=cli(root,"import-mail","../workspace/helpdesk.db","../inputs/archive-b.mbox")
  if rc:return False,runnable,False,d2[:500],root
  one,two=last_json(d1),last_json(d2)
  with Service(root) as svc:status,t=svc.request("GET","/tickets/1")
  ok=(one.get("imported")==1 and one.get("skipped")==0 and two.get("imported")==0 and two.get("skipped")==1 and status==200 and len(t.get("comments",[]))==2)
  return ok,runnable,True,"",root
 except Exception as exc:return False,runnable,False,"edge malformed: "+str(exc)[:500],root

def main():
 p=argparse.ArgumentParser();p.add_argument("--workspace",type=Path,required=True);a=p.parse_args();task=Path(__file__).resolve().parent;candidate=a.workspace.resolve()/"service"
 if not (candidate/"helpdesk/__main__.py").is_file():
  print(json.dumps({"status":"fail","progress_level":0,"main_checks_passed":0,"main_checks_total":5,"edge_check_passed":False,"notes":[]}));return
 roots=[];notes=[]
 try:
  checks,runnable,parsed,d,r=evaluate_main(task,candidate);roots.append(r)
  if d:notes.append(d)
  edge,_,_,d,r=evaluate_edge(task,candidate);roots.append(r)
  if d:notes.append(d)
  n=sum(map(bool,checks));level=5 if n==5 and edge else 4 if n==5 else 3 if n>=2 else 2 if parsed else 1 if runnable else 0
  print(json.dumps({"status":"pass" if level==5 else "fail","progress_level":level,"main_checks_passed":n,"main_checks_total":5,"edge_check_passed":bool(edge),"notes":notes[:2]},sort_keys=True))
 except Exception as exc:print(json.dumps({"status":"error","progress_level":1,"main_checks_passed":0,"main_checks_total":5,"edge_check_passed":False,"notes":[str(exc)[:500]]},sort_keys=True))
 finally:
  for r in roots:shutil.rmtree(r,ignore_errors=True)
if __name__=="__main__":main()
