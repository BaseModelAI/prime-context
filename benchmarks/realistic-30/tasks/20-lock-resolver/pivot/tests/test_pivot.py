import unittest
from lockresolve import resolve, ResolutionError
class PivotTests(unittest.TestCase):
 def repo(self):return {"a":{"1.0.0":{"b":">=1.0.0"},"2.0.0":{"b":">=1.0.0"}},"b":{"1.0.0":{},"2.0.0":{}}}
 def test_keeps_valid_locked_versions(self):
  self.assertEqual(resolve(self.repo(),{"a":">=1.0.0"},locked={"a":"1.0.0","b":"1.0.0"}),{"a":"1.0.0","b":"1.0.0"})
 def test_changes_only_invalid_locked_package(self):
  self.assertEqual(resolve(self.repo(),{"a":">=2.0.0"},locked={"a":"1.0.0","b":"1.0.0"}),{"a":"2.0.0","b":"1.0.0"})
 def test_exact_pin(self):
  self.assertEqual(resolve(self.repo(),{"a":">=1.0.0"},pins={"b":"1.0.0"}),{"a":"2.0.0","b":"1.0.0"})
