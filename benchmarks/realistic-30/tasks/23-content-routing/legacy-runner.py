#!/usr/bin/env python3
import json, os, queue, shutil, subprocess, threading, time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
ROOT=Path(__file__).resolve().parent
PROJECT=Path(__file__).resolve().parents[4]
CLI=PROJECT/"node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js"
AGENT_DIR=Path.home()/".prime"/"agent";NODE=shutil.which("node") or "node";PYTHON=shutil.which("python") or "python"
TASK='# Content Routing Engine\n\nImplement the `contentrouter` package with only the Python standard library.\n\nInitial API:\n- `NoRoute(LookupError)`.\n- Immutable `Resolution(route_id, text, params, locale="*")`.\n- `ContentRouter.from_dict(config)` and `resolve(path, values=None)`.\n\nInitial config has `routes` with `id`, `path`, and `text`.\n- Paths contain literal segments or whole-segment captures such as `{slug}`.\n- Captures match one nonempty segment.\n- Render text with `string.Template.substitute` using captures, then caller values; caller values win.\n- Route declaration order breaks otherwise equal matches.\n- Reject duplicate IDs and malformed patterns with `ValueError`.\n\nRun `python run_tests.py`. Edit only files under `contentrouter/`. Keep the active goal open for staged pivots.\n';MODELS='from dataclasses import dataclass\n\nclass NoRoute(LookupError):\n    pass\n\n@dataclass(frozen=True)\nclass Resolution:\n    route_id: str\n    text: str\n    params: dict[str, str]\n    locale: str = "*"\n';STORE='from __future__ import annotations\n\nclass ContentRouter:\n    @classmethod\n    def from_dict(cls, config):\n        raise NotImplementedError\n\n    def resolve(self, path, *, values=None):\n        raise NotImplementedError\n';CLI_STUB='def main(argv=None):\n    raise NotImplementedError\n\nif __name__ == "__main__":\n    raise SystemExit(main())\n';INIT='from .models import NoRoute, Resolution\nfrom .router import ContentRouter\n__all__ = ["ContentRouter", "NoRoute", "Resolution"]\n';BASE_TESTS='import unittest\nfrom contentrouter import ContentRouter, NoRoute, Resolution\nclass BaseTests(unittest.TestCase):\n def test_literal(self):\n  r=ContentRouter.from_dict({"routes":[{"id":"home","path":"/","text":"Home"}]});self.assertEqual(r.resolve("/"),Resolution("home","Home",{},"*"))\n def test_capture_render(self):\n  r=ContentRouter.from_dict({"routes":[{"id":"article","path":"/articles/{slug}","text":"Article: $slug by $author"}]});self.assertEqual(r.resolve("/articles/intro",values={"author":"Ada"}),Resolution("article","Article: intro by Ada",{"slug":"intro"},"*"))\n def test_miss(self):\n  r=ContentRouter.from_dict({"routes":[]})\n  with self.assertRaises(NoRoute):r.resolve("/missing")\n';TEST_RUNNER='#!/usr/bin/env python3\nimport io\nimport sys\nimport unittest\n\nsuite = unittest.defaultTestLoader.discover("tests", pattern="test_*.py")\nstream = io.StringIO()\nresult = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)\ncount = result.testsRun\npassed = count - len(result.failures) - len(result.errors)\nprint(f"TEST_RESULT {\'PASS\' if result.wasSuccessful() else \'FAIL\'} {passed}/{count}")\nif not result.wasSuccessful():\n    for test, detail in [*result.failures, *result.errors]:\n        final = detail.strip().splitlines()[-1] if detail.strip() else "failure"\n        print(f"FAIL {test.id()} {final}")\npayload = "integration-trace payload=" + "x" * 100\nfor worker in range(8):\n    for line in range(180):\n        print(f"TRACE worker={worker} line={line:03d} {payload}")\nraise SystemExit(0 if result.wasSuccessful() else 1)\n'
PIVOT_DOC='# Locale fallback and named-template pivot\n\nPreserve the initial API and add:\n- Config may have `default_locale` and `templates`.\n- Routes may have `locale`, and exactly one of `text` or `template`. A template route may have `content` values.\n- Normalize locales to lowercase and replace `_` with `-`. Missing route locale is `*`.\n- `resolve(..., locale=None)` uses this chain with duplicates removed: requested locale, less-specific parents, default locale, then `*`. Omitted locale starts at default locale.\n- Select the first path match in the best locale-chain entry.\n- Named templates must exist.\n- Render precedence is route content, captures, caller values.\n- Resolution locale reports the normalized selected route locale.\n';PIVOT_TESTS='import unittest\nfrom contentrouter import ContentRouter\nclass LocaleTests(unittest.TestCase):\n def test_exact_locale(self):\n  r=ContentRouter.from_dict({"default_locale":"en","routes":[{"id":"en","path":"/welcome","locale":"en","text":"Hello"},{"id":"fr","path":"/welcome","locale":"fr","text":"Salut"}]});x=r.resolve("/welcome",locale="FR");self.assertEqual((x.route_id,x.text,x.locale),("fr","Salut","fr"))\n def test_parent_then_default_fallback(self):\n  r=ContentRouter.from_dict({"default_locale":"en","routes":[{"id":"en","path":"/welcome","locale":"en","text":"Hello"},{"id":"fr","path":"/welcome","locale":"fr","text":"Salut"}]});self.assertEqual(r.resolve("/welcome",locale="fr-CA").route_id,"fr");self.assertEqual(r.resolve("/welcome",locale="es-MX").route_id,"en")\n def test_named_template(self):\n  r=ContentRouter.from_dict({"default_locale":"en","templates":{"card":"$title [$slug]"},"routes":[{"id":"post","path":"/posts/{slug}","locale":"en","template":"card","content":{"title":"News"}}]});x=r.resolve("/posts/launch");self.assertEqual((x.text,x.params,x.locale),("News [launch]",{"slug":"launch"},"en"))\n';FOLLOW_DOC='# Precedence, explanations, and JSON CLI\n\nFinal requirements:\n- Routes have integer `priority`, default 0.\n- Rank path matches by lowest locale-chain index, highest priority, most literal path segments, then earliest declaration.\n- `explain(path, locale=None, values=None)` returns `locale_chain`, selected route ID, and best-first candidates. Each candidate has exactly `id`, `locale_rank`, `priority`, `literal_segments`, `order`, and `selected`.\n- Include only path matches whose locale is in the chain. Raise `NoRoute` when none match.\n- CLI: `python -m contentrouter.cli CONFIG.json PATH [--locale LOCALE] [--values JSON_OBJECT] [--explain]`.\n- Print one compact sorted JSON line. Resolution keys are `route_id`, `text`, `params`, `locale`. Explain mode prints the explanation.\n- Success exits 0; invalid input or no route prints a short stderr error and exits 2.\n';FOLLOW_TESTS='import json, subprocess, sys, tempfile, unittest\nfrom pathlib import Path\nfrom contentrouter import ContentRouter\nCFG={"default_locale":"en","routes":[{"id":"dynamic","path":"/docs/{slug}","locale":"en","priority":10,"text":"D $slug"},{"id":"static","path":"/docs/start","locale":"en","priority":0,"text":"S"}]}\nclass FollowTests(unittest.TestCase):\n def test_precedence_priority_specificity_order(self):\n  self.assertEqual(ContentRouter.from_dict(CFG).resolve("/docs/start").route_id,"dynamic")\n  equal={"default_locale":"en","routes":[{"id":"dynamic","path":"/docs/{slug}","locale":"en","text":"D"},{"id":"static","path":"/docs/start","locale":"en","text":"S"},{"id":"static2","path":"/docs/start","locale":"en","text":"S2"}]};self.assertEqual(ContentRouter.from_dict(equal).resolve("/docs/start").route_id,"static")\n def test_explain(self):\n  e=ContentRouter.from_dict(CFG).explain("/docs/start");self.assertEqual([x["id"] for x in e["candidates"]],["dynamic","static"]);self.assertEqual({k:e["candidates"][0][k] for k in ["locale_rank","priority","literal_segments","order"]},{"locale_rank":0,"priority":10,"literal_segments":1,"order":0});self.assertTrue(e["candidates"][0]["selected"]);self.assertFalse(e["candidates"][1]["selected"])\n def test_json_cli(self):\n  cfg={"default_locale":"en","routes":[{"id":"article","path":"/a/{slug}","locale":"en","text":"Hi $slug"}]}\n  with tempfile.TemporaryDirectory() as d:\n   p=Path(d)/"router.json";p.write_text(json.dumps(cfg));r=subprocess.run([sys.executable,"-m","contentrouter.cli",str(p),"/a/x","--locale","EN"],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(r.stderr,"");self.assertEqual(r.stdout,\'{"locale":"en","params":{"slug":"x"},"route_id":"article","text":"Hi x"}\\n\')\n'
GOAL='Deliver the content router through this interactive coding session. Incorporate every steering message and staged requirement file, preserve supplied tests, and use only the standard library. Keep the goal active until the user sends `REQUIREMENTS LOCKED`. Then run the full suite, fix failures, call `await goal.complete()`, and respond exactly `CONTENT ROUTER GOAL COMPLETE`.';INITIAL='Start the active goal. Read TASK.md, run the baseline suite, and implement current content-routing behavior. Expect live steering and staged pivots. Do not complete before REQUIREMENTS LOCKED.';STEER1='Steering update: preserve deterministic declaration ordering, immutable result records, and the public resolve API. Continue current work but keep the goal active.';PIVOT_PROMPT='Product pivot: I added PIVOT.md and tests/test_pivot.py. Add locale fallback and named templates exactly as specified. Run the expanded suite and keep the goal active.';FOLLOW_PROMPT='Follow-up: I added FOLLOWUP.md and tests/test_followup.py. Add precedence ranking, explanations, and the JSON CLI. Run the suite but wait for the final lock.';FINAL_PROMPT='REQUIREMENTS LOCKED. Run the complete suite, fix all failures while editing only contentrouter/, call `await goal.complete()`, and respond exactly `CONTENT ROUTER GOAL COMPLETE`.'
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
 (work/"contentrouter").mkdir(parents=True);(work/"tests").mkdir()
 files={"TASK.md":TASK,"contentrouter/__init__.py":INIT,"contentrouter/models.py":MODELS,"contentrouter/store.py":STORE,"contentrouter/cli.py":CLI_STUB,"tests/test_base.py":BASE_TESTS,"run_tests.py":TEST_RUNNER}
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
 protected_ok=all((work/name).exists() and (work/name).read_text(encoding="utf8")==data for name,data in protected.items() if not name.startswith("contentrouter/"))
 run_events=[e.get("properties",{}) for e in captured if e.get("name")=="agent run completed"]
 telemetry={key:sum(e.get(key,0) or 0 for e in run_events) for key in ["model_call_count","tool_call_count","input_tokens","output_tokens","cache_read_tokens","cache_write_tokens","total_tokens","compaction_count"]}
 final_text=next((text.strip() for text in reversed(interaction["outputs"]) if text.strip()),"")
 labels=[x["label"] for x in interaction["interventions"]];accepted=all(interaction["responses"].get(x["id"]) is True for x in interaction["interventions"])
 final_goal=session.get("final_goal") or {}
 result={"condition":condition,"error":error,"wall_seconds":wall,"external_tests_pass":verifier.returncode==0 and "TEST_RESULT PASS 9/9" in verifier.stdout,"protected_files_unchanged":protected_ok,"goal_status":final_goal.get("status"),"goal_complete":final_goal.get("status")=="complete","goal_completed_after_lock":final_goal.get("status")=="complete" and not interaction["early_complete"],"final_exact":final_text=="CONTENT ROUTER GOAL COMPLETE","final_text":final_text,"intervention_order_ok":labels==["initial","steer-baseline","steer-pivot","steer-followup","steer-final-lock"],"interventions_accepted":accepted,"interaction":interaction,"session_file":str(session_file) if session_file else None,"session":session,"archives":archives(pc_home,session.get("session_id")),"telemetry":telemetry,"telemetry_event_names":[e.get("name") for e in captured]}
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
