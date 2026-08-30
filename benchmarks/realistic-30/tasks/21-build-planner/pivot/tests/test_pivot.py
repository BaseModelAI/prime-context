import unittest
from buildplan import BuildPlanner
CFG={"modules":{"base":{"deps":[],"sources":["src/base.py"]},"api":{"deps":["base"],"sources":["src/api.py","shared/schema.json"]},"web":{"deps":["api"],"sources":["web/main.py","shared/schema.json"]},"docs":{"deps":["base"],"sources":["docs/index.md"]}}}
class IncrementalTests(unittest.TestCase):
 def test_reverse_dependents_rebuild(self):self.assertEqual(BuildPlanner.from_dict(CFG).affected(["src/base.py"]),["base","api","docs","web"])
 def test_shared_and_normalized_sources(self):
  p=BuildPlanner.from_dict(CFG);self.assertEqual(p.affected(["./shared\\schema.json"]),["api","web"])
 def test_unknown_change_is_empty(self):self.assertEqual(BuildPlanner.from_dict(CFG).affected(["README.md"]),[])
