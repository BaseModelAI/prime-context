import unittest
from fractions import Fraction as F
from rhythm import Note, engrave
class FollowTests(unittest.TestCase):
 def test_greedy_lowest_voice_reuse(self):
  notes=[Note(60,F(0),F(1)),Note(62,F(1,2),F(1)),Note(64,F(1),F(1))];f=engrave(notes,F(4));voices={x.pitch:x.voice for x in f};self.assertEqual(voices,{60:0,62:1,64:0})
 def test_identical_span_is_a_chord(self):
  notes=[Note(60,F(0),F(1,2)),Note(64,F(0),F(1,2)),Note(67,F(0),F(3,4))];f=engrave(notes,F(4));self.assertEqual({x.pitch:x.voice for x in f},{60:0,64:0,67:1})
 def test_cross_bar_tie_fragments(self):
  f=engrave([Note(60,F(3,4),F(1,2))],F(1));self.assertEqual([(x.start,x.duration,x.tie_in,x.tie_out,x.voice) for x in f],[(F(3,4),F(1,4),False,True,0),(F(1),F(1,4),True,False,0)])
