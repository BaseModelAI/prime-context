import unittest
from decimal import Decimal as D
from heatplate import HeatPlate, ConvergenceError
class FollowTests(unittest.TestCase):
 def test_already_steady_profile_finishes_one_step(self):
  p=HeatPlate([[D(0),D(50),D(100)]],D("0.25"),{(0,0):D(0),(2,0):D(100)});q,n=p.solve_steady(D(0),10);self.assertEqual(n,1);self.assertEqual(q.temperatures,((D(0),D(50),D(100)),))
 def test_five_cell_profile_and_boundary_flux(self):
  p=HeatPlate([[D(0),D(0),D(0),D(0),D(100)]],D("0.25"),{(0,0):D(0),(4,0):D(100)});q,n=p.solve_steady(D("0.001"),10000);expected=[D(0),D(25),D(50),D(75),D(100)]
  for actual,target in zip(q.temperatures[0],expected):self.assertLessEqual(abs(actual-target),D("0.01"))
  f=q.fixed_fluxes();self.assertLessEqual(abs(f[(0,0)]+f[(4,0)]),D("0.02"));self.assertGreater(n,1)
 def test_solver_errors_and_input_purity(self):
  p=HeatPlate([[D(0),D(0),D(100)]],D("0.25"),{(0,0):D(0),(2,0):D(100)});before=p.temperatures
  with self.assertRaises(ConvergenceError):p.solve_steady(D(0),1)
  self.assertEqual(p.temperatures,before)
  with self.assertRaises(ValueError):HeatPlate([[D(1)]],D("0.1")).solve_steady(D("0.1"),10)
