import unittest
from lockresolve import resolve, ResolutionError
class BaseTests(unittest.TestCase):
 def test_highest_transitive_versions(self):
  repo={"app":{"1.0.0":{"lib":">=1.0.0"}},"lib":{"1.0.0":{},"2.0.0":{}}};self.assertEqual(resolve(repo,{"app":">=1.0.0"}),{"app":"1.0.0","lib":"2.0.0"})
 def test_backtracks_from_incompatible_high_version(self):
  repo={"app":{"1.0.0":{"lib":"<2.0.0"},"2.0.0":{"lib":">=2.0.0"}},"lib":{"1.0.0":{},"2.0.0":{}}};self.assertEqual(resolve(repo,{"app":">=1.0.0","lib":"<2.0.0"}),{"app":"1.0.0","lib":"1.0.0"})
 def test_unsatisfiable(self):
  with self.assertRaises(ResolutionError):resolve({"a":{"1.0.0":{}}},{"a":">=2.0.0"})
