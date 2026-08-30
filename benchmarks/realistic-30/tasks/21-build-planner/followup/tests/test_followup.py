import json, subprocess, sys, tempfile, unittest
from pathlib import Path
from buildplan import BuildPlanner
CFG={"modules":{"core":{"deps":[],"sources":["core.py"]},"api":{"deps":["core"],"sources":["api.py"]},"web":{"deps":["api"],"sources":["web.py"]}}}
class FollowTests(unittest.TestCase):
 def test_explain_reasons(self):
  x=BuildPlanner.from_dict(CFG).explain(["./core.py"]);self.assertEqual(x,{"changed":["core.py"],"direct":["core"],"rebuild":["core","api","web"],"reasons":{"api":["core"],"core":["core"],"web":["core"]}})
 def test_two_direct_reasons(self):
  x=BuildPlanner.from_dict(CFG).explain(["core.py","api.py"]);self.assertEqual(x["reasons"]["web"],["api","core"])
 def test_cli(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/"graph.json";p.write_text(json.dumps(CFG))
   def run(*a):
    r=subprocess.run([sys.executable,"-m","buildplan.cli",str(p),*a],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr);return json.loads(r.stdout)
   self.assertEqual(run("plan","web"),["core","api","web"]);self.assertEqual(run("affected","core.py"),["core","api","web"]);self.assertEqual(run("explain","api.py")["direct"],["api"])
