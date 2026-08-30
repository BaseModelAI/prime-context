import unittest
from committee import allocate
class PivotTests(unittest.TestCase):
 def test_threshold_inclusive_uses_total(self):
  self.assertEqual(allocate(10,{"A":800,"B":100,"C":99,"D":1},min_basis_points=1000),{"A":9,"B":1,"C":0,"D":0})
 def test_cap_reapportions_remaining(self):
  self.assertEqual(allocate(10,{"A":80,"B":15,"C":5},caps={"A":5}),{"A":5,"B":4,"C":1})
 def test_caps_cannot_cover(self):
  with self.assertRaisesRegex(ValueError,"^eligible caps cannot cover seats$"):allocate(4,{"A":5,"B":5},caps={"A":1,"B":2})
