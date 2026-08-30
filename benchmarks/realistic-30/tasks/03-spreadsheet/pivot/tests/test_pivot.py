import unittest
from miniworkbook import Workbook, CycleError
class PivotTests(unittest.TestCase):
 def test_only_transitive_dependents_recalculate(self):
  w=Workbook();w.set_many({"A1":1,"B1":"=A1+1","C1":"=B1+1","Z1":"=10+1"});w.get("C1");w.get("Z1");w.reset_evaluation_counts();w.set("A1",5);self.assertEqual(w.get("C1"),7);self.assertEqual(w.evaluation_counts().get("B1"),1);self.assertEqual(w.evaluation_counts().get("C1"),1);self.assertEqual(w.evaluation_counts().get("Z1",0),0)
 def test_diamond_evaluates_each_formula_once(self):
  w=Workbook();w.set_many({"A1":1,"B1":"=A1+1","C1":"=A1+2","D1":"=B1+C1"});w.get("D1");w.reset_evaluation_counts();w.set("A1",4);self.assertEqual(w.get("D1"),11);self.assertEqual({k:w.evaluation_counts().get(k) for k in ["B1","C1","D1"]},{"B1":1,"C1":1,"D1":1})
 def test_set_many_cycle_is_atomic(self):
  w=Workbook();w.set_many({"A1":1,"B1":"=A1+1"});self.assertEqual(w.get("B1"),2);w.reset_evaluation_counts()
  with self.assertRaises(CycleError):w.set_many({"A1":"=B1","B1":"=A1"})
  self.assertEqual(w.get("A1"),1);self.assertEqual(w.get("B1"),2);self.assertEqual(w.evaluation_counts().get("B1",0),0)
