import unittest
from decimal import Decimal
from miniworkbook import Workbook, CycleError
class BaseTests(unittest.TestCase):
 def test_arithmetic_precedence(self):
  w=Workbook();w.set("A1",2);w.set("B1","3");w.set("C1","=A1+B1*2");self.assertEqual(w.get("C1"),Decimal("8"))
 def test_sum_range_and_unset_zero(self):
  w=Workbook()
  for c,v in {"A1":1,"B1":2,"A2":3,"B2":4}.items():w.set(c,v)
  w.set("C1","=SUM(A1:B2)+Z9");self.assertEqual(w.get("C1"),Decimal("10"))
 def test_updates_and_cycle_detection(self):
  w=Workbook();w.set("A1",1);w.set("B1","=A1+1");self.assertEqual(w.get("B1"),Decimal("2"));w.set("A1",5);self.assertEqual(w.get("B1"),Decimal("6"))
  with self.assertRaises(CycleError):w.set("A1","=B1")
