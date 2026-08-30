import unittest
from decimal import Decimal
from miniworkbook import Workbook
class FollowTests(unittest.TestCase):
 def test_scenarios_do_not_mutate_workbook(self):
  w=Workbook();w.set_many({"A1":10,"B1":"=A1*2"});self.assertEqual(w.get("B1"),20);self.assertEqual(w.evaluate_scenarios([{"A1":3},{"A1":7}],["B1"]),[{"B1":Decimal("6")},{"B1":Decimal("14")}]);self.assertEqual(w.get("B1"),20)
 def test_multiple_overrides_and_normal_cache_counts(self):
  w=Workbook();w.set_many({"A1":2,"A2":3,"B1":"=A1+A2","B2":"=A1*A2"});w.get("B1");w.get("B2");w.reset_evaluation_counts();r=w.evaluate_scenarios([{"A1":4,"A2":5},{"A2":10}],["B1","B2"]);self.assertEqual(r,[{"B1":Decimal("9"),"B2":Decimal("20")},{"B1":Decimal("12"),"B2":Decimal("20")}]);self.assertEqual(sum(w.evaluation_counts().values()),0)
 def test_decimal_goal_seek_and_bracket_error(self):
  w=Workbook();w.set_many({"A1":0,"B1":"=A1*3+2"});x=w.goal_seek("A1","B1",Decimal("20"),Decimal("0"),Decimal("10"),Decimal("0.0001"));self.assertLessEqual(abs(x-Decimal("6")),Decimal("0.0001"));self.assertEqual(w.get("A1"),0)
  with self.assertRaises(ValueError):w.goal_seek("A1","B1",Decimal("50"),Decimal("0"),Decimal("10"),Decimal("0.0001"))
