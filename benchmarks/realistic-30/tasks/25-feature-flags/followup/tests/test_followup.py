import json, subprocess, sys, tempfile, unittest
from pathlib import Path
from featureflags import evaluate, explain
CFG={"flags":{"new-dashboard":{"default":False,"targets":[{"when":{"country":"US"},"value":True}],"rollout":2,"tenant_overrides":{"acme":False,"beta":True}}}}
class FollowTests(unittest.TestCase):
 def test_override_precedence(self):
  self.assertIs(evaluate(CFG,"new-dashboard",{"tenant":"acme","country":"US","subject":"bob"}),False);self.assertIs(evaluate(CFG,"new-dashboard",{"tenant":"beta"}),True)
 def test_exact_explanations(self):
  self.assertEqual(explain(CFG,"new-dashboard",{"tenant":"acme"}),{"flag":"new-dashboard","value":False,"reason":"tenant_override","tenant":"acme"})
  self.assertEqual(explain(CFG,"new-dashboard",{"country":"US"}),{"flag":"new-dashboard","value":True,"reason":"target","rule_index":0})
  self.assertEqual(explain(CFG,"new-dashboard",{"subject":"bob"}),{"flag":"new-dashboard","value":True,"reason":"rollout","bucket":166,"percentage":2})
  self.assertEqual(explain(CFG,"new-dashboard",{}),{"flag":"new-dashboard","value":False,"reason":"default"})
 def test_cli(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"flags.json";p.write_text(json.dumps(CFG))
   ctx=json.dumps({"tenant":"acme","country":"US","subject":"bob"})
   r=subprocess.run([sys.executable,"-m","featureflags.cli",str(p),"new-dashboard","--context",ctx,"--explain"],capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(json.loads(r.stdout),{"flag":"new-dashboard","value":False,"reason":"tenant_override","tenant":"acme"})
