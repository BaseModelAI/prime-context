import unittest
from decimal import Decimal as D
from cashflow_math import amortize
class PivotTests(unittest.TestCase):
 def test_extra_payment_shortens_schedule(self):
  rows=amortize(D(100),D(0),4,extra_payments={2:D(30)});self.assertEqual([r.payment for r in rows],[D("25.00"),D("55.00"),D("20.00")]);self.assertEqual(rows[-1].closing,D("0.00"))
 def test_oversized_extra_is_capped(self):
  rows=amortize(D(100),D(0),4,extra_payments={1:D(100)});self.assertEqual(len(rows),1);self.assertEqual(rows[0].payment,D("100.00"));self.assertEqual(rows[0].closing,D("0.00"))
 def test_rate_reset_changes_interest_not_contract(self):
  rows=amortize(D(100),D(0),2,rate_changes={2:D("0.12")});self.assertEqual([(r.payment,r.interest,r.closing) for r in rows],[(D("50.00"),D("0.00"),D("50.00")),(D("50.50"),D("0.50"),D("0.00"))])
