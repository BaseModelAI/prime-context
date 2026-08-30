import unittest
from decimal import Decimal as D
from heatplate import HeatPlate
class BaseTests(unittest.TestCase):
 def test_center_impulse(self):
  p=HeatPlate([[D(0),D(0),D(0)],[D(0),D(100),D(0)],[D(0),D(0),D(0)]],D("0.25")).step();self.assertEqual(p.temperatures,((D(0),D(25),D(0)),(D(25),D(0),D(25)),(D(0),D(25),D(0))))
 def test_insulated_edges_conserve_heat(self):
  p=HeatPlate([[D(100),D(0)],[D(0),D(0)]],D("0.25")).step();self.assertEqual(p.temperatures,((D(50),D(25)),(D(25),D(0))));self.assertEqual(sum(map(sum,p.temperatures)),D(100))
 def test_fixed_cell_and_validation(self):
  original=HeatPlate([[D(100),D(0),D(0)]],D("0.25"),{(0,0):D(100)});self.assertEqual(original.step().temperatures,((D(100),D(25),D(0)),));self.assertEqual(original.temperatures,((D(100),D(0),D(0)),))
  with self.assertRaises(ValueError):HeatPlate([[D(1)],[D(1),D(2)]],D("0.1"))
  with self.assertRaises(ValueError):HeatPlate([[D(1)]],D("0.3"))
