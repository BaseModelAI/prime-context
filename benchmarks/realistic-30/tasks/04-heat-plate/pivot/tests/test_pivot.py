import unittest
from decimal import Decimal as D
from heatplate import HeatPlate
class PivotTests(unittest.TestCase):
 def test_uniform_conductivity_reproduces_base(self):
  t=[[D(100),D(0)],[D(0),D(0)]];k=[[D(1),D(1)],[D(1),D(1)]];self.assertEqual(HeatPlate(t,D("0.25"),conductivity=k).step().temperatures,((D(50),D(25)),(D(25),D(0))))
 def test_symmetric_mixed_material_flux(self):
  p=HeatPlate([[D(100),D(0)]],D("0.25"),conductivity=[[D(1),D(3)]]).step();self.assertEqual(p.temperatures,((D("62.500"),D("37.500")),));self.assertEqual(sum(p.temperatures[0]),D(100))
 def test_cutout_and_validation(self):
  p=HeatPlate([[D(100),None,D(0)]],D("0.25"),conductivity=[[D(1),None,D(2)]]);self.assertEqual(p.step().temperatures,p.temperatures)
  with self.assertRaises(ValueError):HeatPlate([[D(1),None]],D("0.1"),conductivity=[[D(1),D(1)]])
  with self.assertRaises(ValueError):HeatPlate([[D(1)]],D("0.1"),conductivity=[[D(0)]])
