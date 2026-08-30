import unittest
from eventwindow import Event, EventWindow, Window
class WatermarkTests(unittest.TestCase):
 def test_finalization_threshold_once(self):
  w=EventWindow(10,2);w.add(Event("a",1,"x",5));self.assertEqual(w.advance_watermark(11),[]);self.assertEqual(w.advance_watermark(12),[Window(0,10,"x",1,5)]);self.assertEqual(w.advance_watermark(20),[]);self.assertEqual(w.current(),[])
 def test_bounded_late_then_final(self):
  w=EventWindow(10,2);w.add(Event("a",1,"x",1));w.advance_watermark(11);self.assertEqual(w.add(Event("b",9,"x",2)),"accepted");self.assertEqual(w.advance_watermark(12),[Window(0,10,"x",2,3)]);self.assertEqual(w.add(Event("c",8,"x",7)),"late")
 def test_monotonic_watermark(self):
  w=EventWindow(10);self.assertEqual(w.advance_watermark(7),[]);self.assertEqual(w.advance_watermark(7),[])
  with self.assertRaises(ValueError):w.advance_watermark(6)
