import unittest
from stockroom import Inventory, Line, Reservation
class PivotTests(unittest.TestCase):
 def test_expiry_boundary_order_once(self):
  i=Inventory({"A":5});i.reserve(Reservation("b",(Line("A",1),),5));i.reserve(Reservation("a",(Line("A",2),),5));self.assertEqual(i.advance_time(4),[]);self.assertEqual(i.advance_time(5),["a","b"]);self.assertEqual(i.available("A"),5);self.assertEqual(i.advance_time(6),[])
  with self.assertRaises(ValueError):i.advance_time(3)
 def test_commit_is_permanent_and_id_seen(self):
  i=Inventory({"A":5});r=Reservation("r",(Line("A",3),));i.reserve(r);self.assertEqual(i.commit("r"),"committed");self.assertEqual(i.available("A"),2);self.assertEqual(i.release("r"),"missing");self.assertEqual(i.reserve(r),"duplicate")
 def test_atomic_amendment(self):
  i=Inventory({"A":5});i.reserve(Reservation("r1",(Line("A",4),),9));i.reserve(Reservation("r2",(Line("A",1),)));self.assertEqual(i.amend("r1",(Line("A",5),)),"insufficient");self.assertEqual(i.available("A"),0);i.release("r2");self.assertEqual(i.amend("r1",(Line("A",2),Line("A",3))),"accepted");self.assertEqual(i.active()[0].expires_at,9);self.assertEqual(i.available("A"),0);self.assertEqual(i.amend("none",()),"missing")
