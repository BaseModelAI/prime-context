import unittest
from subscription_invoice import generate_invoice
class PivotTests(unittest.TestCase):
 def plan(self,id,monthly,tiers=None):
  p={"id":id,"monthly":monthly}
  if tiers is not None:p["tiers"]=tiers
  return p
 def sub(self):return {"start":"2026-01-01","plan":self.plan("a","31.00")}
 def test_plan_change_splits_recurring_lines(self):
  e=[{"id":"p","type":"plan_change","at":"2026-01-16","plan":self.plan("b","62.00")}];r=generate_invoice("2026-01",self.sub(),e);self.assertEqual([(x["plan"],x["amount"]) for x in r["lines"]],[ ("a","15.00"),("b","32.00")])
 def test_graduated_usage(self):
  s={"start":"2026-01-01","plan":self.plan("m","0",[{"up_to":10,"unit_price":"1.00"},{"up_to":None,"unit_price":"0.50"}])};e=[{"id":"u","type":"usage","at":"2026-01-10","units":14}];line=generate_invoice("2026-01",s,e)["lines"][1];self.assertEqual((line["kind"],line["units"],line["amount"]),("usage",14,"12.00"))
 def test_usage_tiers_reset_at_change_and_order_is_irrelevant(self):
  tiers=[{"up_to":2,"unit_price":"1"},{"up_to":None,"unit_price":"0"}];s={"start":"2026-01-01","plan":self.plan("a","0",tiers)};e=[{"id":"u2","type":"usage","at":"2026-01-20","units":2},{"id":"p","type":"plan_change","at":"2026-01-16","plan":self.plan("b","0",tiers)},{"id":"u1","type":"usage","at":"2026-01-10","units":2}];r=generate_invoice("2026-01",s,e);self.assertEqual([x["amount"] for x in r["lines"] if x["kind"]=="usage"],["2.00","2.00"]);self.assertEqual(r,generate_invoice("2026-01",s,reversed(e)))
