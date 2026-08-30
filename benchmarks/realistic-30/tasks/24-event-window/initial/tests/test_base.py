import unittest
from eventwindow import Event, EventWindow, Window
class BaseTests(unittest.TestCase):
 def test_id_deduplication(self):
  w=EventWindow(10);self.assertEqual(w.add(Event("e1",3,"a",5)),"accepted");self.assertEqual(w.add(Event("e1",7,"a",99)),"duplicate");self.assertEqual(w.current(),[Window(0,10,"a",1,5)])
 def test_half_open_boundaries(self):
  w=EventWindow(10)
  for e in [Event("a",0,"x",1),Event("b",9,"x",2),Event("c",10,"x",4)]:w.add(e)
  self.assertEqual(w.current(),[Window(0,10,"x",2,3),Window(10,20,"x",1,4)])
 def test_stable_order_per_key_totals(self):
  w=EventWindow(10)
  for e in [Event("a",21,"b",-1),Event("b",11,"z",2),Event("c",11,"a",3)]:w.add(e)
  self.assertEqual(w.current(),[Window(10,20,"a",1,3),Window(10,20,"z",1,2),Window(20,30,"b",1,-1)])
