import unittest
from fractions import Fraction as F
from rhythm import Note, SwingGrid, quantize
class PivotTests(unittest.TestCase):
 def test_swing_grid_points(self):
  q=quantize([Note(60,F(3,5),F(1,2)),Note(61,F(1,4),F(1,2))],F(1,4),grid=SwingGrid());self.assertEqual([n.start for n in q],[F(0),F(2,3)])
 def test_cluster_chooses_joint_best_point(self):
  notes=[Note(60,F(3,25),F(1,2)),Note(64,F(13,50),F(1,2))];q=quantize(notes,F(1,4),chord_tolerance=F(3,20));self.assertEqual([n.start for n in q],[F(1,4),F(1,4)])
 def test_clustering_is_transitive(self):
  notes=[Note(60,F(0),F(1,2)),Note(61,F(1,10),F(1,2)),Note(62,F(1,5),F(1,2))];q=quantize(notes,F(1,4),chord_tolerance=F(11,100));self.assertEqual(len({n.start for n in q}),1);independent=quantize(notes,F(1,4),chord_tolerance=F(0));self.assertGreater(len({n.start for n in independent}),1)
