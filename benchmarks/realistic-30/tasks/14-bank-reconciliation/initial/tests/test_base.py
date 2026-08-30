import copy, unittest
from bank_reconcile import reconcile
class BaseTests(unittest.TestCase):
 def e(self,id,date,amount,reference):return {"id":id,"date":date,"amount":amount,"reference":reference}
 def test_normalized_exact_matches(self):
  b=[self.e("b1","2026-01-02","10.00","dep-01")];l=[self.e("l1","2026-01-03","10.00","DEP 01")];self.assertEqual(reconcile(b,l),{"matches":[{"bank_ids":["b1"],"ledger_ids":["l1"]}],"unmatched_bank":[],"unmatched_ledger":[]})
 def test_global_distance_then_lexical_choice(self):
  b=[self.e("b2","2026-01-01","5","R"),self.e("b1","2026-01-01","5","R")];l=[self.e("l2","2026-01-02","5","R"),self.e("l1","2026-01-01","5","R")];self.assertEqual(reconcile(b,l)["matches"],[{"bank_ids":["b1"],"ledger_ids":["l1"]},{"bank_ids":["b2"],"ledger_ids":["l2"]}])
 def test_unmatched_and_input_purity(self):
  b=[self.e("b","2026-01-01","1","A")];l=[self.e("l","2026-02-01","1","A")];before=copy.deepcopy((b,l));self.assertEqual(reconcile(b,l),{"matches":[],"unmatched_bank":["b"],"unmatched_ledger":["l"]});self.assertEqual((b,l),before)
