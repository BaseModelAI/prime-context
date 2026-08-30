#!/usr/bin/env python3
import json, os, queue, shutil, subprocess, threading, time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).resolve().parent
PROJECT=Path(__file__).resolve().parents[4]
CLI=PROJECT/"node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js"
AGENT_DIR=Path.home()/".prime"/"agent";NODE=shutil.which("node") or "node";PYTHON=shutil.which("python") or "python"
TASK='# Hierarchical Authorization Engine\n\nImplement the `authz` package using only the Python standard library.\n\nInitial API:\n- `PolicyEngine(resources, grants)` where resources map IDs to a parent ID or `None`.\n- Immutable `Decision(allowed, reason_ids)`.\n- `authorize(subject, resource, action) -> Decision`.\n\nInitial behavior:\n- A grant has unique `id`, `subject`, `resource`, and nonempty `actions`.\n- Grants apply to their resource and every descendant.\n- Actions initially match an exact string or `*`.\n- Among matching grants, use those attached to the nearest ancestor of the requested resource and return their IDs lexically.\n- With no matching grant return a denied decision with no reasons.\n- Validate a finite acyclic resource forest, references, IDs, subjects, and actions.\n\nRun `python run_tests.py`. Edit only files under `authz/`. Keep the active goal open for staged pivots.\n';MODELS='# Authorization decisions and policy documents are immutable from the caller perspective.\n';STORE='class PolicyEngine:\n    def authorize(self, subject, resource, action, **options):\n        raise NotImplementedError\n';CLI_STUB='def main(argv=None):\n    raise NotImplementedError\n\nif __name__ == "__main__":\n    raise SystemExit(main())\n';INIT='from .engine import PolicyEngine, Decision\n__all__ = ["PolicyEngine", "Decision"]\n';BASE_TESTS='import unittest\nfrom authz import PolicyEngine\nclass BaseTests(unittest.TestCase):\n def test_ancestor_grant_applies(self):\n  e=PolicyEngine({"org":None,"project":"org"},[{"id":"g","subject":"alice","resource":"org","actions":["read"]}]);self.assertEqual((lambda d:(d.allowed,d.reason_ids))(e.authorize("alice","project","read")),(True,("g",)))\n def test_nearest_resource_grants_win(self):\n  gs=[{"id":"root","subject":"alice","resource":"org","actions":["*"]},{"id":"local-b","subject":"alice","resource":"project","actions":["read"]},{"id":"local-a","subject":"alice","resource":"project","actions":["read"]}];d=PolicyEngine({"org":None,"project":"org"},gs).authorize("alice","project","read");self.assertEqual(d.reason_ids,("local-a","local-b"))\n def test_unmatched_and_invalid_cycle(self):\n  e=PolicyEngine({"org":None},[]);self.assertEqual((e.authorize("nobody","org","read").allowed,e.authorize("nobody","org","read").reason_ids),(False,()))\n  with self.assertRaises(ValueError):PolicyEngine({"a":"b","b":"a"},[])\n';TEST_RUNNER='#!/usr/bin/env python3\nimport io\nimport sys\nimport unittest\n\nsuite = unittest.defaultTestLoader.discover("tests", pattern="test_*.py")\nstream = io.StringIO()\nresult = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)\ncount = result.testsRun\npassed = count - len(result.failures) - len(result.errors)\nprint(f"TEST_RESULT {\'PASS\' if result.wasSuccessful() else \'FAIL\'} {passed}/{count}")\nif not result.wasSuccessful():\n    for test, detail in [*result.failures, *result.errors]:\n        final = detail.strip().splitlines()[-1] if detail.strip() else "failure"\n        print(f"FAIL {test.id()} {final}")\npayload = "integration-trace payload=" + "x" * 100\nfor worker in range(8):\n    for line in range(180):\n        print(f"TRACE worker={worker} line={line:03d} {payload}")\nraise SystemExit(0 if result.wasSuccessful() else 1)\n'
PIVOT_DOC='# Groups, denies, and action-family pivot\n\nPreserve legacy allow grants and add constructor keyword `memberships=None`:\n- Memberships map group names to user names or `group:<name>` entries and may be nested; reject group cycles.\n- A grant subject may be a user name or `group:<name>`.\n- A grant may set `effect` to `allow` or `deny`; omitted means allow.\n- An action pattern may be exact, `*`, or end in `:*`, which matches the named action family prefix followed by a colon.\n- First select matches at the nearest resource ancestor.\n- At that specificity, any deny overrides every allow. Return all winning-effect grant IDs lexically.\n- Membership and grant input order must not affect decisions.\n';PIVOT_TESTS='import unittest\nfrom authz import PolicyEngine\nclass PivotTests(unittest.TestCase):\n def resources(self):return {"org":None,"project":"org","secret":"project"}\n def test_nearer_deny_overrides_ancestor_allow(self):\n  gs=[{"id":"a","subject":"alice","resource":"org","actions":["*"]},{"id":"d","subject":"alice","resource":"project","actions":["read"],"effect":"deny"}];d=PolicyEngine(self.resources(),gs).authorize("alice","secret","read");self.assertEqual((d.allowed,d.reason_ids),(False,("d",)))\n def test_nested_group_membership(self):\n  gs=[{"id":"g","subject":"group:ops","resource":"org","actions":["read"]}];e=PolicyEngine(self.resources(),gs,memberships={"dev":["alice"],"ops":["group:dev"]});self.assertTrue(e.authorize("alice","project","read").allowed)\n def test_action_family_and_same_level_deny(self):\n  gs=[{"id":"allow","subject":"alice","resource":"org","actions":["report:*"]},{"id":"deny","subject":"alice","resource":"org","actions":["report:delete"],"effect":"deny"}];e=PolicyEngine(self.resources(),gs);self.assertEqual(e.authorize("alice","org","report:view").reason_ids,("allow",));self.assertEqual((e.authorize("alice","org","report:delete").allowed,e.authorize("alice","org","report:delete").reason_ids),(False,("deny",)))\n';FOLLOW_DOC="# Time-bounded direct delegation\n\nFinal requirements:\n- Constructor keyword `delegations=None` accepts records with unique `id`, `from`, `to`, `resource`, nonempty `actions`, inclusive ISO `not_before`, and exclusive ISO `expires`.\n- `authorize(..., at=ISO_TIMESTAMP)` evaluates active delegations; omit `at` to ignore all delegations.\n- An active delegation can transfer an effective allow from `from` to `to` for matching actions on its resource descendants.\n- The source must itself be allowed at the requested resource/action by direct grants and groups.\n- Delegation is not transitive and can never transfer or bypass a deny.\n- A delegated allow competes at the delegation resource's specificity. Direct or group denies at the same specificity win.\n- A winning delegated reason is `delegation_id:source_grant_id`; sort all reasons lexically.\n- Validate timestamps, resource references, action patterns, and `not_before < expires`.\n";FOLLOW_TESTS='import unittest\nfrom authz import PolicyEngine\nclass FollowTests(unittest.TestCase):\n def make(self,extra=()):\n  grants=[{"id":"source","subject":"alice","resource":"org","actions":["read"]},*extra];deleg=[{"id":"del","from":"alice","to":"bob","resource":"project","actions":["read"],"not_before":"2026-01-01T00:00:00","expires":"2026-02-01T00:00:00"}];return PolicyEngine({"org":None,"project":"org"},grants,delegations=deleg)\n def test_active_delegation_transfers_allow(self):\n  d=self.make().authorize("bob","project","read",at="2026-01-15T12:00:00");self.assertEqual((d.allowed,d.reason_ids),(True,("del:source",)))\n def test_expired_or_omitted_time_ignores_delegation(self):\n  e=self.make();self.assertFalse(e.authorize("bob","project","read").allowed);self.assertFalse(e.authorize("bob","project","read",at="2026-02-01T00:00:00").allowed)\n def test_direct_deny_blocks_same_level_delegation(self):\n  deny={"id":"block","subject":"bob","resource":"project","actions":["read"],"effect":"deny"};d=self.make([deny]).authorize("bob","project","read",at="2026-01-15T00:00:00");self.assertEqual((d.allowed,d.reason_ids),(False,("block",)))\n'
GOAL='Deliver the hierarchical authorization and bounded delegation engine through this interactive coding session. Incorporate every steering message and staged requirement file, preserve supplied tests, and use only the standard library. Keep the goal active until the user sends `REQUIREMENTS LOCKED`. Then run the full suite, fix failures, call `await goal.complete()`, and respond exactly `AUTHORIZATION GOAL COMPLETE`.';INITIAL='Start the active goal. Read TASK.md, run the baseline suite, and implement inherited deterministic authorization grants. Expect live steering and staged pivots. Do not complete before REQUIREMENTS LOCKED.';STEER1='Steering update: validate policy graphs, preserve caller inputs, use nearest-resource specificity, and keep decision reasons deterministic. Continue but keep the goal active.';PIVOT_PROMPT='Security pivot: I added PIVOT.md and tests/test_pivot.py. Add nested groups, explicit denies, and action-family patterns exactly as specified. Run the expanded suite and keep the goal active.';FOLLOW_PROMPT='Operations follow-up: I added FOLLOWUP.md and tests/test_followup.py. Add nontransitive time-bounded delegations. Run the suite but wait for the final lock.';FINAL_PROMPT='REQUIREMENTS LOCKED. Run the complete suite, fix all failures while editing only authz/, call `await goal.complete()`, and respond exactly `AUTHORIZATION GOAL COMPLETE`.'
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
 (work/"authz").mkdir(parents=True);(work/"tests").mkdir()
 files={"TASK.md":TASK,"authz/__init__.py":INIT,"authz/models.py":MODELS,"authz/store.py":STORE,"authz/cli.py":CLI_STUB,"tests/test_base.py":BASE_TESTS,"run_tests.py":TEST_RUNNER}
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
 protected_ok=all((work/name).exists() and (work/name).read_text(encoding="utf8")==data for name,data in protected.items() if not name.startswith("authz/"))
 run_events=[e.get("properties",{}) for e in captured if e.get("name")=="agent run completed"]
 telemetry={key:sum(e.get(key,0) or 0 for e in run_events) for key in ["model_call_count","tool_call_count","input_tokens","output_tokens","cache_read_tokens","cache_write_tokens","total_tokens","compaction_count"]}
 final_text=next((text.strip() for text in reversed(interaction["outputs"]) if text.strip()),"")
 labels=[x["label"] for x in interaction["interventions"]];accepted=all(interaction["responses"].get(x["id"]) is True for x in interaction["interventions"])
 final_goal=session.get("final_goal") or {}
 result={"condition":condition,"error":error,"wall_seconds":wall,"external_tests_pass":verifier.returncode==0 and "TEST_RESULT PASS 9/9" in verifier.stdout,"protected_files_unchanged":protected_ok,"goal_status":final_goal.get("status"),"goal_complete":final_goal.get("status")=="complete","goal_completed_after_lock":final_goal.get("status")=="complete" and not interaction["early_complete"],"final_exact":final_text=="AUTHORIZATION GOAL COMPLETE","final_text":final_text,"intervention_order_ok":labels==["initial","steer-baseline","steer-pivot","steer-followup","steer-final-lock"],"interventions_accepted":accepted,"interaction":interaction,"session_file":str(session_file) if session_file else None,"session":session,"archives":archives(pc_home,session.get("session_id")),"telemetry":telemetry,"telemetry_event_names":[e.get("name") for e in captured]}
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
