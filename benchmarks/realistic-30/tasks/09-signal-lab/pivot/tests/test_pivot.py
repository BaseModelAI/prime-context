import unittest
from signal_lab import SignalAnalyzer, analyze
class PivotTests(unittest.TestCase):
 def test_one_shot_iterator_and_batch_match(self):
  class Once:
   def __init__(self):self.used=False
   def __iter__(self):
    if self.used:raise AssertionError("iterated twice")
    self.used=True;return iter([1,-1,1,0])
  self.assertEqual(analyze(Once(),8000),analyze([1,-1,1,0],8000))
 def test_crossings_survive_chunk_boundaries(self):
  a=SignalAnalyzer(8000);a.feed([1]);a.feed([-1,1]);self.assertEqual(a.finish().zero_crossings,2)
 def test_clipped_runs_cross_chunks_and_finish_closes(self):
  a=SignalAnalyzer(8000,clip_limit=10,min_clip_run=3);a.feed([10,10]);a.feed([10,0,-10,-10,-10]);self.assertEqual(a.finish().clipped_runs,((0,3),(4,7)))
  with self.assertRaises(RuntimeError):a.feed([1])
