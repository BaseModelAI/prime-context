import unittest
from jsonmerge3 import merge
class FollowTests(unittest.TestCase):
 def test_choose_theirs_for_scalar_conflict(self):
  self.assertEqual(merge({"x":1},{"x":2},{"x":3},resolutions={"/x":"theirs"}),{"document":{"x":3},"conflicts":[],"patch":[{"op":"replace","path":"/x","value":3}]})
 def test_delete_entity_conflict(self):
  b={"items":[{"id":"a","v":1}]};o={"items":[]};t={"items":[{"id":"a","v":2}]}
  self.assertEqual(merge(b,o,t,entities={"/items":"id"},resolutions={"/items/a":"delete"}),{"document":{"items":[]},"conflicts":[],"patch":[]})
 def test_mixed_resolutions_and_sorted_patch(self):
  b={"a":1,"b":1,"c":1};o={"a":2,"b":2};t={"a":3,"b":3,"c":2};r={"/a":"theirs","/b":{"strategy":"value","value":5},"/c":"theirs"}
  self.assertEqual(merge(b,o,t,resolutions=r),{"document":{"a":3,"b":5,"c":2},"conflicts":[],"patch":[{"op":"replace","path":"/a","value":3},{"op":"replace","path":"/b","value":5},{"op":"add","path":"/c","value":2}]})
