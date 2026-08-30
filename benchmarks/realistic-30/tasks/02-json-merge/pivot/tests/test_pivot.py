import unittest
from jsonmerge3 import merge
class PivotTests(unittest.TestCase):
 def test_different_entities_merge_independently(self):
  b={"items":[{"id":"a","v":1},{"id":"b","v":1}]};o={"items":[{"id":"a","v":2},{"id":"b","v":1}]};t={"items":[{"id":"a","v":1},{"id":"b","v":3}]}
  self.assertEqual(merge(b,o,t,entities={"/items":"id"}),{"document":{"items":[{"id":"a","v":2},{"id":"b","v":3}]},"conflicts":[]})
 def test_concurrent_additions_have_stable_order(self):
  b={"items":[{"id":"base","v":0}]};o={"items":[{"id":"base","v":0},{"id":"o2","v":2},{"id":"o1","v":1}]};t={"items":[{"id":"base","v":0},{"id":"t1","v":3}]}
  self.assertEqual([x["id"] for x in merge(b,o,t,entities={"/items":"id"})["document"]["items"]],["base","o2","o1","t1"])
 def test_entity_delete_edit_conflict_path(self):
  b={"items":[{"id":"a","v":1}]};o={"items":[]};t={"items":[{"id":"a","v":2}]}
  self.assertEqual(merge(b,o,t,entities={"/items":"id"}),{"document":{"items":[]},"conflicts":[{"path":"/items/a","kind":"delete-edit"}]})
