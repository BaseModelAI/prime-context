import unittest
from fractions import Fraction as F
from rhythm import Note, quantize
class BaseTests(unittest.TestCase):
 def test_start_and_end_snap_independently(self):
  q=quantize([Note(60,F(1,10),F(3,10))],F(1,4))[0];self.assertEqual((q.start,q.duration),(F(0),F(1,2)))
 def test_exact_tie_snaps_earlier(self):
  q=quantize([Note(60,F(1,8),F(1,4))],F(1,4))[0];self.assertEqual(q.start,F(0))
 def test_short_note_extends_and_validation(self):
  q=quantize([Note(60,F(24,100),F(2,100))],F(1,4))[0];self.assertEqual((q.start,q.duration),(F(1,4),F(1,4)))
  with self.assertRaises(ValueError):quantize([Note(60,F(0),F(1))],F(0))
  with self.assertRaises(ValueError):Note(128,F(0),F(1))
