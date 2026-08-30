import unittest
from fractions import Fraction
from geartrain import GearTrain, InconsistentTrain
class BaseTests(unittest.TestCase):
 def test_simple_ratio(self):
  g=GearTrain();g.add_gear("A",20);g.add_gear("B",40);g.mesh("A","B");self.assertEqual(g.solve_speed("A",120),{"A":Fraction(120),"B":Fraction(-60)})
 def test_mesh_and_coaxial_chain(self):
  g=GearTrain()
  for name,teeth in [("A",20),("B",40),("C",10),("D",50)]:g.add_gear(name,teeth)
  g.mesh("A","B");g.coaxial("B","C");g.mesh("C","D");self.assertEqual(g.solve_speed("A",120),{"A":Fraction(120),"B":Fraction(-60),"C":Fraction(-60),"D":Fraction(12)})
 def test_contradictory_cycle(self):
  g=GearTrain()
  for n in "ABC":g.add_gear(n,20)
  g.mesh("A","B");g.mesh("B","C");g.mesh("C","A")
  with self.assertRaises(InconsistentTrain):g.solve_speed("A",1)
