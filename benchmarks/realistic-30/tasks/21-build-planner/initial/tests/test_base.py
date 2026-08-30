import copy, tempfile, unittest
from pathlib import Path
from buildplan import BuildPlanner

CONFIG={"modules":{"app":{"deps":["core","ui"],"sources":["app.py"]},"core":{"deps":[],"sources":["core.py"]},"ui":{"deps":["core"],"sources":["ui.py"]},"tool":{"deps":[],"sources":["tool.py"]}}}
class BaseTests(unittest.TestCase):
 def test_all_and_target_plans_are_stable(self):
  p=BuildPlanner.from_dict(CONFIG);self.assertEqual(p.plan(),["core","tool","ui","app"]);self.assertEqual(p.plan(["app"]),["core","ui","app"])
 def test_input_is_not_mutated_and_load_works(self):
  original=copy.deepcopy(CONFIG);p=BuildPlanner.from_dict(CONFIG);self.assertEqual(CONFIG,original)
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/"graph.json";path.write_text(__import__('json').dumps(CONFIG));self.assertEqual(BuildPlanner.load(path).plan(["ui"]),["core","ui"])
 def test_unknown_and_cycle_are_clear(self):
  with self.assertRaisesRegex(ValueError,"missing"):BuildPlanner.from_dict({"modules":{"a":{"deps":["missing"],"sources":[]}}})
  p=BuildPlanner.from_dict({"modules":{"a":{"deps":["b"],"sources":[]},"b":{"deps":["a"],"sources":[]}}})
  with self.assertRaisesRegex(ValueError,"a|b"):p.plan()
