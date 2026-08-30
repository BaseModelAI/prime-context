import unittest
from decimal import Decimal as D
from cashflow_math import npv, irr
class FollowTests(unittest.TestCase):
 def test_one_period_yield(self):
  r=irr([D(-100),D(110)]);self.assertLessEqual(abs(r-D("0.1")),D("1e-10"));self.assertLessEqual(abs(npv(r,[D(-100),D(110)])),D("1e-12"))
 def test_two_period_yield(self):
  r=irr([D(-100),D(0),D(121)]);self.assertLessEqual(abs(r-D("0.1")),D("1e-10"));self.assertLessEqual(abs(npv(r,[D(-100),D(0),D(121)])),D("1e-12"))
 def test_invalid_signs_and_brackets(self):
  for flows in ([D(10),D(20)],[D(-100),D(300),D(-250)]):
   with self.assertRaises(ValueError):irr(flows)
  with self.assertRaises(ValueError):irr([D(-100),D(110)],low=D("0.2"),high=D("0.5"))
