import copy, unittest
from subscription_invoice import generate_invoice
class BaseTests(unittest.TestCase):
 def sub(self,start="2026-01-01",end=None,monthly="31.00"):
  x={"start":start,"plan":{"id":"basic","monthly":monthly}}
  if end:x["end"]=end
  return x
 def test_full_month(self):
  r=generate_invoice("2026-01",self.sub());self.assertEqual((r["lines"][0]["amount"],r["subtotal"],r["total"]),("31.00","31.00","31.00"))
 def test_midmonth_proration(self):
  r=generate_invoice("2026-01",self.sub(start="2026-01-16"));self.assertEqual((r["lines"][0]["start"],r["lines"][0]["end"],r["lines"][0]["amount"]),("2026-01-16","2026-02-01","16.00"))
 def test_exclusive_end_empty_and_pure(self):
  s=self.sub(start="2026-01-10",end="2026-01-10");before=copy.deepcopy(s);self.assertEqual(generate_invoice("2026-01",s)["lines"],[]);self.assertEqual(s,before)
