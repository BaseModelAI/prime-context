#!/usr/bin/env python3
import json, os, queue, shutil, subprocess, threading, time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).resolve().parent
PROJECT=Path(__file__).resolve().parents[4]
CLI=PROJECT/"node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js"
AGENT_DIR=Path.home()/".prime"/"agent";NODE=shutil.which("node") or "node";PYTHON=shutil.which("python") or "python"
TASK='# Stock Reservation Engine\n\nImplement the `stockroom` package using only the Python standard library.\n\nInitial API:\n- Immutable `Line(sku, quantity)` and `Reservation(id, lines, expires_at=None)`.\n- `Inventory(stock)` with `reserve`, `release`, `available`, and `active`.\n\nInitial behavior:\n- Stock quantities are nonnegative integers; line quantities are positive integers.\n- A reservation is atomic across all lines: return `"accepted"` or `"insufficient"`.\n- The first accepted reservation ID wins forever; another reserve with that ID returns `"duplicate"`.\n- Insufficient attempts do not consume the ID.\n- `release(id)` returns `"released"` or `"missing"` and restores held availability.\n- `active()` returns open reservations sorted by ID. Never mutate caller inputs.\n\nRun `python run_tests.py`. Edit only files under `stockroom/`. Keep the active goal open for staged pivots.\n';MODELS='from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Line:\n    sku: str\n    quantity: int\n\n@dataclass(frozen=True)\nclass Reservation:\n    id: str\n    lines: tuple[Line, ...]\n    expires_at: int | None = None\n';STORE='class Inventory:\n    def __init__(self, stock):\n        raise NotImplementedError\n';CLI_STUB='def main(argv=None):\n    raise NotImplementedError\n\nif __name__ == "__main__":\n    raise SystemExit(main())\n';INIT='from .models import Line, Reservation\nfrom .inventory import Inventory\n__all__ = ["Inventory", "Line", "Reservation"]\n';BASE_TESTS='import unittest\nfrom stockroom import Inventory, Line, Reservation\nclass BaseTests(unittest.TestCase):\n def test_atomic_multisku_insufficient(self):\n  i=Inventory({"A":5,"B":1});self.assertEqual(i.reserve(Reservation("r1",(Line("A",3),Line("B",2)))),"insufficient");self.assertEqual((i.available("A"),i.available("B")),(5,1));self.assertEqual(i.reserve(Reservation("r1",(Line("A",3),Line("B",1)))),"accepted")\n def test_duplicate_survives_release(self):\n  i=Inventory({"A":4});r=Reservation("r1",(Line("A",2),));self.assertEqual(i.reserve(r),"accepted");self.assertEqual(i.release("r1"),"released");self.assertEqual(i.available("A"),4);self.assertEqual(i.reserve(r),"duplicate");self.assertEqual(i.release("missing"),"missing")\n def test_active_sorted_and_availability(self):\n  i=Inventory({"A":6});b=Reservation("b",(Line("A",1),));a=Reservation("a",(Line("A",2),));i.reserve(b);i.reserve(a);self.assertEqual(i.active(),[a,b]);self.assertEqual(i.available("A"),3);self.assertEqual(i.available("unknown"),0)\n';TEST_RUNNER='#!/usr/bin/env python3\nimport io\nimport sys\nimport unittest\n\nsuite = unittest.defaultTestLoader.discover("tests", pattern="test_*.py")\nstream = io.StringIO()\nresult = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)\ncount = result.testsRun\npassed = count - len(result.failures) - len(result.errors)\nprint(f"TEST_RESULT {\'PASS\' if result.wasSuccessful() else \'FAIL\'} {passed}/{count}")\nif not result.wasSuccessful():\n    for test, detail in [*result.failures, *result.errors]:\n        final = detail.strip().splitlines()[-1] if detail.strip() else "failure"\n        print(f"FAIL {test.id()} {final}")\npayload = "integration-trace payload=" + "x" * 100\nfor worker in range(8):\n    for line in range(180):\n        print(f"TRACE worker={worker} line={line:03d} {payload}")\nraise SystemExit(0 if result.wasSuccessful() else 1)\n'
PIVOT_DOC='# Expiration, commit, and amendment pivot\n\nPreserve the initial API and add:\n- Inventory time starts at 0. `advance_time(now)` is monotonic and returns IDs newly expired, sorted by `(expires_at, id)`. Expiration occurs when `now >= expires_at` and releases holds once.\n- Reserving with `expires_at <= current time` raises `ValueError`.\n- `commit(id)` returns `"committed"` or `"missing"`. It removes the hold and permanently deducts its quantities from stock. The ID remains seen.\n- `amend(id, lines)` returns `"accepted"`, `"insufficient"`, or `"missing"`. It atomically evaluates the replacement as if the reservation\'s old hold were released. On failure, retain the old reservation unchanged. Preserve its expiration.\n- Aggregate duplicate SKUs within one request before availability checks.\n';PIVOT_TESTS='import unittest\nfrom stockroom import Inventory, Line, Reservation\nclass PivotTests(unittest.TestCase):\n def test_expiry_boundary_order_once(self):\n  i=Inventory({"A":5});i.reserve(Reservation("b",(Line("A",1),),5));i.reserve(Reservation("a",(Line("A",2),),5));self.assertEqual(i.advance_time(4),[]);self.assertEqual(i.advance_time(5),["a","b"]);self.assertEqual(i.available("A"),5);self.assertEqual(i.advance_time(6),[])\n  with self.assertRaises(ValueError):i.advance_time(3)\n def test_commit_is_permanent_and_id_seen(self):\n  i=Inventory({"A":5});r=Reservation("r",(Line("A",3),));i.reserve(r);self.assertEqual(i.commit("r"),"committed");self.assertEqual(i.available("A"),2);self.assertEqual(i.release("r"),"missing");self.assertEqual(i.reserve(r),"duplicate")\n def test_atomic_amendment(self):\n  i=Inventory({"A":5});i.reserve(Reservation("r1",(Line("A",4),),9));i.reserve(Reservation("r2",(Line("A",1),)));self.assertEqual(i.amend("r1",(Line("A",5),)),"insufficient");self.assertEqual(i.available("A"),0);i.release("r2");self.assertEqual(i.amend("r1",(Line("A",2),Line("A",3))),"accepted");self.assertEqual(i.active()[0].expires_at,9);self.assertEqual(i.available("A"),0);self.assertEqual(i.amend("none",()),"missing")\n';FOLLOW_DOC='# Snapshots, previews, and NDJSON CLI\n\nFinal requirements:\n- `snapshot()` returns exactly sorted `stock`, integer `now`, sorted `seen_ids`, and sorted `open` reservation dictionaries. Lines are sorted by SKU.\n- `Inventory.from_snapshot(state)` restores an equivalent inventory.\n- `explain(reservation)` previews reserve without mutation and returns exactly `id`, `status`, `reason`, `shortages`, `expires_at`, and `now`.\n- Decision order: seen ID -> duplicate/id_seen; otherwise shortages -> insufficient/insufficient_stock; otherwise accepted/stock_available. Shortages are sorted dictionaries with `sku`, `requested`, and `available`.\n- CLI: `python -m stockroom.cli --stock JSON` reads NDJSON operations from stdin and writes compact sorted JSON responses.\n- Support `reserve`, `release`, `commit`, `amend`, `advance`, `explain`, and `snapshot` operations.\n';FOLLOW_TESTS='import json, subprocess, sys, unittest\nfrom stockroom import Inventory, Line, Reservation\nclass FollowTests(unittest.TestCase):\n def test_snapshot_roundtrip(self):\n  i=Inventory({"B":1,"A":5});i.reserve(Reservation("r1",(Line("A",2),),5));i.advance_time(2);expected={"stock":{"A":5,"B":1},"now":2,"seen_ids":["r1"],"open":[{"id":"r1","lines":[{"sku":"A","quantity":2}],"expires_at":5}]};self.assertEqual(i.snapshot(),expected);self.assertEqual(Inventory.from_snapshot(expected).snapshot(),expected)\n def test_nonmutating_explain(self):\n  i=Inventory({"A":5});i.reserve(Reservation("held",(Line("A",3),)));before=i.snapshot();self.assertEqual(i.explain(Reservation("new",(Line("A",4),),9)),{"id":"new","status":"insufficient","reason":"insufficient_stock","shortages":[{"sku":"A","requested":4,"available":2}],"expires_at":9,"now":0});self.assertEqual(i.snapshot(),before)\n def test_ndjson_cli(self):\n  data=\'{"op":"reserve","reservation":{"id":"r1","lines":[{"sku":"A","quantity":2}],"expires_at":3}}\\n{"op":"advance","now":3}\\n\';r=subprocess.run([sys.executable,"-m","stockroom.cli","--stock",\'{"A":5}\'],input=data,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stdout,\'{"op":"reserve","status":"accepted"}\\n{"expired":["r1"],"op":"advance"}\\n\')\n'
GOAL='Deliver the stock reservation engine through this interactive coding session. Incorporate every steering message and staged requirement file, preserve supplied tests, and use only the standard library. Keep the goal active until the user sends `REQUIREMENTS LOCKED`. Then run the full suite, fix failures, call `await goal.complete()`, and respond exactly `STOCKROOM GOAL COMPLETE`.';INITIAL='Start the active goal. Read TASK.md, run the baseline suite, and implement current stock-reservation behavior. Expect live steering and staged pivots. Do not complete before REQUIREMENTS LOCKED.';STEER1='Steering update: preserve atomic multi-SKU operations, deterministic ordering, and first-accepted ID semantics. Continue current work but keep the goal active.';PIVOT_PROMPT='Product pivot: I added PIVOT.md and tests/test_pivot.py. Add expiration, commits, and atomic amendments exactly as specified. Run the expanded suite and keep the goal active.';FOLLOW_PROMPT='Follow-up: I added FOLLOWUP.md and tests/test_followup.py. Add portable snapshots, nonmutating reserve previews, and the NDJSON CLI. Run the suite but wait for the final lock.';FINAL_PROMPT='REQUIREMENTS LOCKED. Run the complete suite, fix all failures while editing only stockroom/, call `await goal.complete()`, and respond exactly `STOCKROOM GOAL COMPLETE`.'
telemetry_events=[];telemetry_lock=threading.Lock()
class Handler(BaseHTTPRequestHandler):
 def do_POST(self):
  body=self.rfile.read(int(self.headers.get("content-length","0")))
  try:
   payload=json.loads(body)
   with telemetry_lock:telemetry_events.extend(payload.get("events",[]))
  except Exception:pass
  self.send_response(200);self.end_headers();self.wfile.write(b"{}")
 def log_message(self,*_args):pass
server=ThreadingHTTPServer(("127.0.0.1",0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();ENDPOINT=f"http://127.0.0.1:{server.server_port}/events"

def seed(work):
 (work/"stockroom").mkdir(parents=True);(work/"tests").mkdir()
 files={"TASK.md":TASK,"stockroom/__init__.py":INIT,"stockroom/models.py":MODELS,"stockroom/store.py":STORE,"stockroom/cli.py":CLI_STUB,"tests/test_base.py":BASE_TESTS,"run_tests.py":TEST_RUNNER}
 for name,data in files.items():(work/name).write_text(data,encoding="utf8")
 return files

def add_pivot(work):
 (work/"PIVOT.md").write_text(PIVOT_DOC,encoding="utf8");(work/"tests/test_pivot.py").write_text(PIVOT_TESTS,encoding="utf8")

def add_follow(work):
 (work/"FOLLOWUP.md").write_text(FOLLOW_DOC,encoding="utf8");(work/"tests/test_followup.py").write_text(FOLLOW_TESTS,encoding="utf8")

def make_env(config,pc_home,home):
 env=dict(os.environ)
 for key in list(env):
  if key.startswith("PRIME_AGENT_INTERNAL_"):env.pop(key,None)
 env.pop("PI_OFFLINE",None);env.pop("DO_NOT_TRACK",None)
 env.update({"PRIME_AGENT_CODING_AGENT_DIR":str(config),"PRIME_CONTEXT_HOME":str(pc_home),"PRIME_AGENT_TELEMETRY":"1","PRIME_AGENT_TELEMETRY_ENDPOINT":ENDPOINT,"HOME":str(home),"FORCE_COLOR":"0","NO_COLOR":"1"});return env

def content_text(content):
 if isinstance(content,str):return content
 if not isinstance(content,list):return ""
 return "".join(x.get("text","") for x in content if isinstance(x,dict) and x.get("type")=="text")

def result_text(message):
 result=message.get("result") or {};return content_text(result.get("content"))

def interactive_rpc(args,work,env,run_root):
 q=queue.Queue();outputs=[];interventions=[];responses={};test_runs=[];goal_updates=[];compactions=[];test_calls={};event_number=0
 stderr_path=run_root/"rpc-stderr.txt";events_path=run_root/"rpc-events.jsonl"
 with stderr_path.open("w") as err,events_path.open("w") as event_log:
  proc=subprocess.Popen(args,cwd=work,env=env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=err,text=True,bufsize=1)
  def reader():
   for line in proc.stdout:q.put(line)
   q.put(None)
  threading.Thread(target=reader,daemon=True).start()
  command_counter=0;stage="initial";steer1_sent=False;pivot_sent=False;follow_sent=False;final_sent=False;early_complete=False;goal_complete=False;follow_compaction_count=0
  def send(kind,message,label):
   nonlocal command_counter
   command_counter+=1;rid=f"cmd-{command_counter}-{label}"
   proc.stdin.write(json.dumps({"id":rid,"type":kind,"message":message})+"\n");proc.stdin.flush()
   interventions.append({"label":label,"kind":kind,"id":rid,"event_number":event_number,"compactions_before":len(compactions)})
  send("prompt",INITIAL,"initial")
  deadline=time.monotonic()+1200
  try:
   while True:
    remaining=deadline-time.monotonic()
    if remaining<=0:raise TimeoutError("interactive goal run timed out")
    line=q.get(timeout=remaining)
    if line is None:raise RuntimeError("RPC process exited before goal completion")
    event_log.write(line);event_log.flush()
    try:message=json.loads(line)
    except json.JSONDecodeError:continue
    event_number+=1;kind=message.get("type")
    if kind=="response":
     responses[message.get("id")]=bool(message.get("success"))
    elif kind=="tool_execution_start":
     args_value=message.get("args") or {};code=args_value.get("code","") if isinstance(args_value,dict) else ""
     if message.get("toolName")=="ipython" and "run_tests.py" in code:test_calls[message.get("toolCallId")]=stage
    elif kind=="tool_execution_end" and message.get("toolCallId") in test_calls:
     run_stage=test_calls.pop(message.get("toolCallId"));body=result_text(message)
     test_runs.append({"stage":run_stage,"event_number":event_number,"is_error":bool(message.get("isError")),"result_head":body[:1500],"pass":body.startswith("TEST_RESULT PASS") or "TEST_RESULT PASS" in body[:500]})
     if run_stage=="initial" and not steer1_sent:
      send("steer",STEER1,"steer-baseline");steer1_sent=True
     elif run_stage=="pivot" and not follow_sent:
      add_follow(work);stage="follow";send("steer",FOLLOW_PROMPT,"steer-followup");follow_sent=True;follow_compaction_count=len(compactions)
    elif kind=="compaction_end" and not message.get("aborted"):
     compactions.append({"event_number":event_number,"reason":message.get("reason")})
     if steer1_sent and not pivot_sent:
      add_pivot(work);stage="pivot";send("steer",PIVOT_PROMPT,"steer-pivot");pivot_sent=True
     elif follow_sent and not final_sent and len(compactions)>follow_compaction_count:
      stage="final";send("steer",FINAL_PROMPT,"steer-final-lock");final_sent=True
    elif kind=="goal_update":
     goal=message.get("goal") or {};goal_updates.append({"event_number":event_number,"status":goal.get("status"),"continuationsUsed":goal.get("continuationsUsed"),"tokensUsed":goal.get("tokensUsed")})
     if goal.get("status")=="complete":
      if not final_sent:early_complete=True
      goal_complete=True
    elif kind=="message_end":
     msg=message.get("message") or {}
     if msg.get("role")=="assistant":outputs.append(content_text(msg.get("content")))
    elif kind=="agent_end" and goal_complete:
     break
  finally:
   proc.stdin.close();proc.terminate()
   try:proc.wait(timeout=30)
   except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=10)
 return {"outputs":outputs,"interventions":interventions,"responses":responses,"test_runs":test_runs,"goal_updates":goal_updates,"rpc_compactions":compactions,"early_complete":early_complete,"goal_complete_event":goal_complete,"stderr":stderr_path.read_text()}

def read_session(sessions):
 files=sorted(sessions.rglob("*.jsonl"),key=lambda p:p.stat().st_mtime)
 if not files:return None,{}
 path=files[-1];entries=[json.loads(line) for line in path.read_text().splitlines() if line.strip()]
 header=next((e for e in entries if e.get("type")=="session"),{});assistants=[];tools=[];calls=[];comps=[];goals=[];goal_contexts=0;users=[]
 for entry in entries:
  if entry.get("type")=="compaction":comps.append(entry)
  if entry.get("type")=="custom" and entry.get("customType")=="thread_goal_state":goals.append(entry.get("data") or {})
  if entry.get("type")!="message":continue
  message=entry.get("message",{});role=message.get("role")
  if role=="assistant":
   assistants.append(message)
   for block in message.get("content") or []:
    if isinstance(block,dict) and block.get("type")=="toolCall":calls.append((block.get("name"),block.get("arguments")))
  elif role=="toolResult":tools.append(message)
  elif role=="user":users.append(content_text(message.get("content")))
  elif role=="custom" and message.get("customType")=="goal_context":goal_contexts+=1
 usage={k:0 for k in ["input","output","cacheRead","cacheWrite","totalTokens"]};cost={k:0.0 for k in ["input","output","cacheRead","cacheWrite","total"]}
 for message in assistants:
  item=message.get("usage") or {}
  for key in usage:usage[key]+=item.get(key,0) or 0
  for key in cost:cost[key]+=(item.get("cost") or {}).get(key,0) or 0
 return path,{"session_id":header.get("id"),"model_calls":len(assistants),"tool_calls":len(calls),"tool_results":len(tools),"visible_tool_bytes":sum(len(content_text(m.get("content")).encode()) for m in tools),"compactions":len(comps),"compaction_tokens_before":[e.get("tokensBefore") for e in comps],"usage":{**usage,"cost":cost},"goal_states":goals,"final_goal":goals[-1] if goals else None,"goal_contexts":goal_contexts,"user_messages":users}

def archives(pc_home,session_id):
 index=pc_home/"sessions"/str(session_id)/"index.json"
 if not index.exists():return {"count":0,"source_bytes":0,"compressed_bytes":0}
 items=json.loads(index.read_text()).get("observations",[])
 return {"count":len(items),"source_bytes":sum(x.get("textBytes",0) for x in items),"compressed_bytes":sum((index.parent/x["relativeFile"]).stat().st_size for x in items)}

def run(condition):
 run_root=ROOT/condition
 if run_root.exists():shutil.rmtree(run_root)
 work=run_root/"work";sessions=run_root/"sessions";config=run_root/"config";pc_home=run_root/"pc-home";home=run_root/"home"
 for p in [work,sessions,config,pc_home,home]:p.mkdir(parents=True)
 seed_files=seed(work);shutil.copy2(AGENT_DIR/"auth.json",config/"auth.json")
 settings={"defaultProvider":"openai-codex","defaultModel":"gpt-5.6-sol","defaultThinkingLevel":"medium","telemetry":{"enabled":True,"noticeShown":True},"compaction":{"enabled":True,"reserveTokens":265000,"keepRecentTokens":4000},"packages":[str(PROJECT)] if condition=="prime-context" else []}
 (config/"settings.json").write_text(json.dumps(settings,indent=2)+"\n");env=make_env(config,pc_home,home);socket=run_root/"daemon.sock"
 args=[NODE,str(CLI),"--daemon-socket",str(socket),"--mode","rpc","--cwd",str(work),"--session-dir",str(sessions),"--provider","openai-codex","--model","gpt-5.6-sol","--thinking","medium","--goal",GOAL,"--no-prompt-templates","--no-context-files","--no-themes"]
 if condition=="vanilla":args.append("--no-extensions")
 with telemetry_lock:start_events=len(telemetry_events)
 started=time.monotonic();error=None
 try:interaction=interactive_rpc(args,work,env,run_root)
 except Exception as exc:interaction={"outputs":[],"interventions":[],"responses":{},"test_runs":[],"goal_updates":[],"rpc_compactions":[],"early_complete":False,"goal_complete_event":False,"stderr":""};error=f"{type(exc).__name__}: {exc}"
 subprocess.run([NODE,str(CLI),"--daemon-socket",str(socket),"shutdown","--force"],cwd=work,env=env,capture_output=True,text=True,timeout=60);wall=time.monotonic()-started
 with telemetry_lock:captured=list(telemetry_events[start_events:])
 session_file,session=read_session(sessions)
 verifier=subprocess.run([PYTHON,"run_tests.py"],cwd=work,capture_output=True,text=True,timeout=180)
 protected={**seed_files,"PIVOT.md":PIVOT_DOC,"tests/test_pivot.py":PIVOT_TESTS,"FOLLOWUP.md":FOLLOW_DOC,"tests/test_followup.py":FOLLOW_TESTS}
 protected_ok=all((work/name).exists() and (work/name).read_text(encoding="utf8")==data for name,data in protected.items() if not name.startswith("stockroom/"))
 run_events=[e.get("properties",{}) for e in captured if e.get("name")=="agent run completed"]
 telemetry={key:sum(e.get(key,0) or 0 for e in run_events) for key in ["model_call_count","tool_call_count","input_tokens","output_tokens","cache_read_tokens","cache_write_tokens","total_tokens","compaction_count"]}
 final_text=next((text.strip() for text in reversed(interaction["outputs"]) if text.strip()),"")
 labels=[x["label"] for x in interaction["interventions"]];accepted=all(interaction["responses"].get(x["id"]) is True for x in interaction["interventions"])
 final_goal=session.get("final_goal") or {}
 result={"condition":condition,"error":error,"wall_seconds":wall,"external_tests_pass":verifier.returncode==0 and "TEST_RESULT PASS 9/9" in verifier.stdout,"protected_files_unchanged":protected_ok,"goal_status":final_goal.get("status"),"goal_complete":final_goal.get("status")=="complete","goal_completed_after_lock":final_goal.get("status")=="complete" and not interaction["early_complete"],"final_exact":final_text=="STOCKROOM GOAL COMPLETE","final_text":final_text,"intervention_order_ok":labels==["initial","steer-baseline","steer-pivot","steer-followup","steer-final-lock"],"interventions_accepted":accepted,"interaction":interaction,"session_file":str(session_file) if session_file else None,"session":session,"archives":archives(pc_home,session.get("session_id")),"telemetry":telemetry,"telemetry_event_names":[e.get("name") for e in captured]}
 (run_root/"result.json").write_text(json.dumps(result,indent=2)+"\n");return result

def main():
 status=ROOT/"status.json";results=[]
 for condition in ["vanilla","prime-context"]:
  status.write_text(json.dumps({"state":"running","condition":condition,"completed":[r["condition"] for r in results]},indent=2)+"\n");results.append(run(condition))
 (ROOT/"results.json").write_text(json.dumps({"results":results},indent=2)+"\n");status.write_text(json.dumps({"state":"complete","completed":[r["condition"] for r in results]},indent=2)+"\n")
 print(json.dumps({"results":[{"condition":r["condition"],"tests":r["external_tests_pass"],"goal":r["goal_status"],"final":r["final_exact"],"interventions":r["intervention_order_ok"],"compactions":r["session"]["compactions"],"tokens":r["telemetry"]["total_tokens"],"wall":r["wall_seconds"],"error":r["error"]} for r in results]},indent=2))
if __name__=="__main__":
 try:main()
 finally:server.shutdown()
