import unittest
from bank_reconcile import reconcile
class PivotTests(unittest.TestCase):
 def e(self,id,date,amount,reference):return {"id":id,"date":date,"amount":amount,"reference":reference}
 def test_reference_aliases(self):
  b=[self.e("b","2026-01-01","10","store-1")];l=[self.e("l","2026-01-01","10","ACME")];self.assertEqual(len(reconcile(b,l,reference_aliases={"STORE 1":"acme"})["matches"]),1)
 def test_global_minimum_amount_discrepancy(self):
  b=[self.e("b1","2026-01-01","10.00","R"),self.e("b2","2026-01-01","10.04","R")];l=[self.e("l1","2026-01-01","10.01","R"),self.e("l2","2026-01-01","10.03","R")];m=reconcile(b,l,amount_tolerance="0.05")["matches"];self.assertEqual(m,[{"bank_ids":["b1"],"ledger_ids":["l1"]},{"bank_ids":["b2"],"ledger_ids":["l2"]}])
 def test_order_independent_tolerant_tie(self):
  b=[self.e("b2","2026-01-01","10","R"),self.e("b1","2026-01-01","10","R")];l=[self.e("l2","2026-01-01","10.01","R"),self.e("l1","2026-01-01","10.01","R")];self.assertEqual(reconcile(b,l,amount_tolerance=".01"),reconcile(reversed(b),reversed(l),amount_tolerance=".01"))
