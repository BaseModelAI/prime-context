import unittest
from fractions import Fraction
from geartrain import GearTrain, InconsistentTrain
class PivotTests(unittest.TestCase):
 def make(self):
  g=GearTrain();g.add_gear("A",20);g.add_gear("B",40);g.add_gear("C",10);g.mesh("A","B");return g
 def test_compatible_multiple_drives(self):
  self.assertEqual(self.make().solve({"A":120,"B":-60}),{"A":Fraction(120),"B":Fraction(-60),"C":None})
 def test_conflicting_multiple_drives(self):
  with self.assertRaises(InconsistentTrain):self.make().solve({"A":120,"B":60})
 def test_disconnected_and_order_independent(self):
  a=self.make();b=GearTrain()
  for name,teeth in [("C",10),("B",40),("A",20)]:b.add_gear(name,teeth)
  b.mesh("B","A");self.assertEqual(a.solve({"A":120}),b.solve({"A":120}));self.assertIsNone(a.solve({"A":120})["C"])
