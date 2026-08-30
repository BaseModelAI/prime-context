import unittest
from stockroom import Inventory, Line, Reservation
class BaseTests(unittest.TestCase):
 def test_atomic_multisku_insufficient(self):
  i=Inventory({"A":5,"B":1});self.assertEqual(i.reserve(Reservation("r1",(Line("A",3),Line("B",2)))),"insufficient");self.assertEqual((i.available("A"),i.available("B")),(5,1));self.assertEqual(i.reserve(Reservation("r1",(Line("A",3),Line("B",1)))),"accepted")
 def test_duplicate_survives_release(self):
  i=Inventory({"A":4});r=Reservation("r1",(Line("A",2),));self.assertEqual(i.reserve(r),"accepted");self.assertEqual(i.release("r1"),"released");self.assertEqual(i.available("A"),4);self.assertEqual(i.reserve(r),"duplicate");self.assertEqual(i.release("missing"),"missing")
 def test_active_sorted_and_availability(self):
  i=Inventory({"A":6});b=Reservation("b",(Line("A",1),));a=Reservation("a",(Line("A",2),));i.reserve(b);i.reserve(a);self.assertEqual(i.active(),[a,b]);self.assertEqual(i.available("A"),3);self.assertEqual(i.available("unknown"),0)
