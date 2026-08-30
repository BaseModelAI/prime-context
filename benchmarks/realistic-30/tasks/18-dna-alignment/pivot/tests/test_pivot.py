import unittest
from dna_align import align_global
class PivotTests(unittest.TestCase):
 def test_affine_prefers_one_contiguous_gap(self):
  x=align_global("AAAA","AA",gap_open=-3,gap_extend=-1);self.assertEqual((x.score,x.aligned_a,x.aligned_b),(0,"AAAA","--AA"))
 def test_ambiguous_base_scores_zero(self):
  self.assertEqual(align_global("AN","AG").score,2)
 def test_linear_mode_remains_compatible(self):
  self.assertEqual(align_global("AC","A",gap=-2),align_global("AC","A",gap_open=-2,gap_extend=-2))
