import unittest
from subscription_invoice import generate_invoice
class FollowTests(unittest.TestCase):
 def sub(self,**kw):return {"start":"2026-01-01","plan":{"id":"p","monthly":"10.00"},**kw}
 def test_discount_then_tax(self):
  r=generate_invoice("2026-01",self.sub(discount_percent=50,tax_percent="10"));line=r["lines"][0];self.assertEqual((line["amount"],line["discount"],line["net"],line["tax"]),("10.00","5.00","5.00","0.50"));self.assertEqual(r["total"],"5.50")
 def test_half_even_tax_is_per_line(self):
  s={"start":"2026-01-01","plan":{"id":"a","monthly":"0.05"},"tax_percent":"10"};e=[{"id":"p","type":"plan_change","at":"2026-01-16","plan":{"id":"b","monthly":"0.05"}}];r=generate_invoice("2026-01",s,e);self.assertEqual(r["tax_total"],"0.00")
 def test_credit_application_and_remainder(self):
  r=generate_invoice("2026-01",self.sub(credit_balance="12.00"));self.assertEqual((r["pre_credit_total"],r["credit_applied"],r["ending_credit"],r["total"]),("10.00","10.00","2.00","0.00"))
