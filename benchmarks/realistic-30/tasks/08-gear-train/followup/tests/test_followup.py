import unittest
from fractions import Fraction
from geartrain import GearTrain
class FollowTests(unittest.TestCase):
 def make(self):
  g=GearTrain();g.add_gear("sun",30);g.add_gear("ring",90);g.add_gear("carrier",1);g.add_planetary("P","sun","ring","carrier",30,90);return g
 def test_fixed_ring_reduction(self):
  self.assertEqual(self.make().solve({"sun":120,"ring":0}),{"carrier":Fraction(30),"ring":Fraction(0),"sun":Fraction(120)})
 def test_fixed_carrier_reversal(self):
  self.assertEqual(self.make().solve({"sun":120,"carrier":0}),{"carrier":Fraction(0),"ring":Fraction(-40),"sun":Fraction(120)})
 def test_equal_inputs_and_ordinary_mesh_propagation(self):
  g=self.make();g.add_gear("output",60);g.mesh("sun","output");self.assertEqual(g.solve({"sun":50,"ring":50}),{"carrier":Fraction(50),"output":Fraction(-25),"ring":Fraction(50),"sun":Fraction(50)})
