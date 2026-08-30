import unittest
from bank_reconcile import reconcile
class FollowTests(unittest.TestCase):
 def e(self,id,amount):return {"id":id,"date":"2026-01-01","amount":amount,"reference":"DEP"}
 def test_one_bank_to_split_ledger(self):
  r=reconcile([self.e("b","100")],[self.e("l1","40"),self.e("l2","60")],max_bundle=3);self.assertEqual(r["matches"],[{"bank_ids":["b"],"ledger_ids":["l1","l2"]}])
 def test_split_bank_to_one_ledger(self):
  r=reconcile([self.e("b1","25"),self.e("b2","75")],[self.e("l","100")],max_bundle=2);self.assertEqual(r["matches"],[{"bank_ids":["b1","b2"],"ledger_ids":["l"]}])
 def test_global_selection_prefers_more_covered_entries(self):
  b=[self.e("b1","100"),self.e("b2","40")];l=[self.e("l1","40"),self.e("l2","60")];r=reconcile(b,l,max_bundle=2);self.assertEqual(r["matches"],[{"bank_ids":["b1"],"ledger_ids":["l1","l2"]}]);self.assertEqual(r["unmatched_bank"],["b2"])
