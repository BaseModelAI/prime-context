import copy, unittest
from jsonmerge3 import merge
class BaseTests(unittest.TestCase):
 def test_nonoverlapping_nested_edits(self):
  b={"user":{"name":"Ada","active":True}};o={"user":{"name":"Lin","active":True}};t={"user":{"name":"Ada","active":False}}
  self.assertEqual(merge(b,o,t),{"document":{"user":{"active":False,"name":"Lin"}},"conflicts":[]})
 def test_equal_edits_and_atomic_lists(self):
  b={"tags":["a"],"x":1};o={"tags":["b"],"x":2};t={"tags":["b"],"x":1}
  self.assertEqual(merge(b,o,t),{"document":{"tags":["b"],"x":2},"conflicts":[]})
 def test_delete_versus_edit_and_purity(self):
  b={"cfg":{"limit":1}};o={};t={"cfg":{"limit":2}};before=copy.deepcopy((b,o,t))
  self.assertEqual(merge(b,o,t),{"document":{},"conflicts":[{"path":"/cfg","kind":"delete-edit"}]});self.assertEqual((b,o,t),before)
