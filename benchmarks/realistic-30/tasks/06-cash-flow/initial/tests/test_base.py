import unittest
from decimal import Decimal as D
from cashflow_math import amortize
class BaseTests(unittest.TestCase):
 def test_zero_rate_four_periods(self):
  rows=amortize(D(100),D(0),4);self.assertEqual([r.payment for r in rows],[D("25.00")]*4);self.assertEqual([r.closing for r in rows],[D("75.00"),D("50.00"),D("25.00"),D("0.00")])
 def test_one_month_interest(self):
  row=amortize(D(1000),D("0.12"),1)[0];self.assertEqual(row.interest,D("10.00"));self.assertEqual(row.payment,D("1010.00"));self.assertEqual(row.closing,D("0.00"))
 def test_rounding_final_adjustment_and_validation(self):
  self.assertEqual([r.payment for r in amortize(D(100),D(0),3)],[D("33.33"),D("33.33"),D("33.34")])
  with self.assertRaises(ValueError):amortize(D(-1),D(0),3)
  with self.assertRaises((TypeError,ValueError)):amortize(100.0,D(0),3)
